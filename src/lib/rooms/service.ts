import { randomUUID } from "node:crypto";
import type { Db } from "../db";
import { AppError } from "../errors";
import { LIMITS } from "../limits";
import { hashToken, randomCode, randomToken } from "../auth/tokens";
import {
  addTopicSchema,
  createRoomSchema,
  joinRoomSchema,
  nicknameSchema,
  type CreateRoomInput,
} from "./schemas";
import type {
  DrawResult,
  EndMode,
  NameMode,
  RevealItem,
  RoomStatus,
  RoomSummary,
  RoomView,
} from "./types";
import { parseOrThrow } from "../validation";

interface RoomRow {
  code: string;
  status: RoomStatus;
  end_mode: EndMode;
  draw_limit: number | null;
  name_mode: NameMode;
  draw_count: number;
  expires_at: Date | string;
  [key: string]: unknown;
}

interface ParticipantRow {
  id: string;
  nickname: string | null;
  is_host: boolean;
  [key: string]: unknown;
}

export interface Session {
  code: string;
  token: string;
  participantId: string;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function toSummary(r: RoomRow): RoomSummary {
  return {
    code: r.code,
    status: r.status,
    endMode: r.end_mode,
    drawLimit: r.draw_limit,
    nameMode: r.name_mode,
    drawCount: r.draw_count,
    expiresAt: new Date(r.expires_at).toISOString(),
  };
}

export async function purgeExpiredRooms(db: Db): Promise<void> {
  await db.query("DELETE FROM rooms WHERE expires_at < now()");
}

// Expired rooms are invisible right away (every read filters on expires_at);
// this actually deletes their rows, at most every few minutes per process.
const PURGE_EVERY_MS = 5 * 60 * 1000;
let lastPurge = 0;
async function purgeIfDue(db: Db) {
  const now = Date.now();
  if (now - lastPurge < PURGE_EVERY_MS) return;
  lastPurge = now;
  await purgeExpiredRooms(db).catch((err) => console.error("Failed to purge expired rooms", err));
}

async function loadRoom(db: Db, code: string, forUpdate = false): Promise<RoomRow> {
  const rows = await db.query<RoomRow>(
    `SELECT * FROM rooms WHERE code = $1 AND expires_at > now()${forUpdate ? " FOR UPDATE" : ""}`,
    [normalizeCode(code)],
  );
  const room = rows[0];
  if (!room) throw new AppError("not_found", "ルームが見つかりません。期限が切れたか、コードが間違っている可能性があります");
  return room;
}

async function authenticate(db: Db, room: RoomRow, token: string | null): Promise<ParticipantRow> {
  if (!token) throw new AppError("unauthorized", "このルームに参加していません");
  const rows = await db.query<ParticipantRow>(
    "SELECT id, nickname, is_host FROM participants WHERE room_code = $1 AND token_hash = $2",
    [room.code, hashToken(token)],
  );
  const me = rows[0];
  if (!me) throw new AppError("unauthorized", "このルームに参加していません");
  return me;
}

function requireHost(me: ParticipantRow) {
  if (!me.is_host) throw new AppError("forbidden", "この操作はホストだけができます");
}

function resolveNickname(nameMode: NameMode, raw: string | undefined, fallback: string | null) {
  if (nameMode === "none") return null;
  if (fallback !== null && (raw === undefined || raw.trim() === "")) return fallback;
  return parseOrThrow(nicknameSchema, raw ?? "");
}

export async function createRoom(db: Db, input: CreateRoomInput): Promise<Session> {
  const data = parseOrThrow(createRoomSchema, input);
  const hostNickname = resolveNickname(data.nameMode, data.hostNickname, "ホスト");
  const drawLimit = data.endMode === "count" ? (data.drawLimit ?? null) : null;

  await purgeExpiredRooms(db);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(6);
    const token = randomToken();
    const participantId = randomUUID();
    try {
      await db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO rooms (code, end_mode, draw_limit, name_mode, expires_at)
           VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))`,
          [code, data.endMode, drawLimit, data.nameMode, LIMITS.roomTtlHours],
        );
        await tx.query(
          `INSERT INTO participants (id, room_code, nickname, is_host, token_hash)
           VALUES ($1, $2, $3, true, $4)`,
          [participantId, code, hostNickname, hashToken(token)],
        );
      });
      return { code, token, participantId };
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new AppError("conflict", "ルームを作成できませんでした。もう一度お試しください");
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

export async function joinRoom(db: Db, code: string, input: unknown): Promise<Session> {
  const data = parseOrThrow(joinRoomSchema, input);
  await purgeIfDue(db);
  return db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    if (room.status === "ended") throw new AppError("conflict", "このルームのガチャはもう終わっています");
    const nickname = resolveNickname(room.name_mode, data.nickname, null);
    const [{ n }] = await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM participants WHERE room_code = $1",
      [room.code],
    );
    if (n >= LIMITS.participantsPerRoom) {
      throw new AppError("limit_reached", `このルームは満員です（最大${LIMITS.participantsPerRoom}人）`);
    }
    const token = randomToken();
    const participantId = randomUUID();
    await tx.query(
      `INSERT INTO participants (id, room_code, nickname, is_host, token_hash)
       VALUES ($1, $2, $3, false, $4)`,
      [participantId, room.code, nickname, hashToken(token)],
    );
    return { code: room.code, token, participantId };
  });
}

export async function getRoomView(db: Db, code: string, token: string | null): Promise<RoomView> {
  await purgeIfDue(db);
  // One snapshot for all the reads, so counts and drawn cards always agree.
  return db.transaction(async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    const room = await loadRoom(tx, code);
    const me = await authenticate(tx, room, token);
    return buildView(tx, room, me);
  });
}

async function buildView(db: Db, room: RoomRow, me: ParticipantRow): Promise<RoomView> {
  const [counts] = await db.query<{ participants: number; topics: number; remaining: number }>(
    `SELECT
       (SELECT count(*)::int FROM participants WHERE room_code = $1) AS participants,
       (SELECT count(*)::int FROM room_topics WHERE room_code = $1) AS topics,
       (SELECT count(*)::int FROM room_topics WHERE room_code = $1 AND drawn_order IS NULL) AS remaining`,
    [room.code],
  );

  const myTopics = await db.query<{ id: string; text: string }>(
    `SELECT id, text FROM room_topics
     WHERE room_code = $1 AND participant_id = $2 ORDER BY created_at, id`,
    [room.code, me.id],
  );

  const drawn = me.is_host
    ? await db.query<{ id: string; text: string; order: number }>(
        `SELECT id, text, drawn_order AS "order" FROM room_topics
         WHERE room_code = $1 AND drawn_order IS NOT NULL ORDER BY drawn_order`,
        [room.code],
      )
    : [];

  const reveal = room.status === "ended" ? await loadReveal(db, room) : null;

  return {
    role: me.is_host ? "host" : "participant",
    room: toSummary(room),
    me: { id: me.id, nickname: me.nickname },
    counts,
    myTopics,
    drawn,
    reveal,
  };
}

async function loadReveal(db: Db, room: RoomRow): Promise<RevealItem[]> {
  const rows = await db.query<{ id: string; text: string; order: number | null; nickname: string | null }>(
    `SELECT t.id, t.text, t.drawn_order AS "order", p.nickname
     FROM room_topics t JOIN participants p ON p.id = t.participant_id
     WHERE t.room_code = $1
     ORDER BY t.drawn_order NULLS LAST, t.id`, // ids are random, so undrawn topics do not cluster by author
    [room.code],
  );
  const named = room.name_mode === "named";
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    order: r.order,
    author: named ? r.nickname : null,
  }));
}

export async function addTopic(db: Db, code: string, token: string | null, input: unknown) {
  const { text } = parseOrThrow(addTopicSchema, input);
  return db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    if (room.status !== "collecting") {
      throw new AppError("conflict", "受付は締め切られました");
    }
    const [{ mine, total }] = await tx.query<{ mine: number; total: number }>(
      `SELECT count(*) FILTER (WHERE participant_id = $2)::int AS mine, count(*)::int AS total
       FROM room_topics WHERE room_code = $1`,
      [room.code, me.id],
    );
    if (mine >= LIMITS.topicsPerParticipant) {
      throw new AppError("limit_reached", `投稿できるのは1人${LIMITS.topicsPerParticipant}件までです`);
    }
    if (total >= LIMITS.topicsPerRoom) {
      throw new AppError("limit_reached", `このルームの投稿は上限（${LIMITS.topicsPerRoom}件）に達しました`);
    }
    const id = randomUUID();
    await tx.query(
      "INSERT INTO room_topics (id, room_code, participant_id, text) VALUES ($1, $2, $3, $4)",
      [id, room.code, me.id, text],
    );
    return { id, text };
  });
}

export async function deleteTopic(db: Db, code: string, token: string | null, topicId: string) {
  await db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    if (room.status !== "collecting") {
      throw new AppError("conflict", "受付が締め切られたあとは取り消せません");
    }
    const rows = await tx.query(
      "DELETE FROM room_topics WHERE id = $1 AND room_code = $2 AND participant_id = $3 RETURNING id",
      [topicId, room.code, me.id],
    );
    if (rows.length === 0) throw new AppError("not_found", "トピックが見つかりません");
  });
}

export async function startDrawing(db: Db, code: string, token: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    requireHost(me);
    if (room.status !== "collecting") throw new AppError("conflict", "すでにガチャが始まっています");
    const [{ n }] = await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM room_topics WHERE room_code = $1",
      [room.code],
    );
    if (n === 0) throw new AppError("conflict", "トピックが1件もありません。投稿が集まるまで待ちましょう");
    await tx.query("UPDATE rooms SET status = 'drawing' WHERE code = $1", [room.code]);
  });
}

export async function drawCard(db: Db, code: string, token: string | null): Promise<DrawResult> {
  return db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    requireHost(me);
    if (room.status !== "drawing") {
      throw new AppError("conflict", room.status === "ended" ? "ガチャは終了しています" : "まだガチャが始まっていません");
    }

    const order = room.draw_count + 1;
    const picked = await tx.query<{ id: string; text: string }>(
      `UPDATE room_topics SET drawn_order = $2, drawn_at = now()
       WHERE id = (
         SELECT id FROM room_topics
         WHERE room_code = $1 AND drawn_order IS NULL
         ORDER BY random() LIMIT 1
       )
       RETURNING id, text`,
      [room.code, order],
    );
    const card = picked[0];
    if (!card) throw new AppError("conflict", "引けるカードが残っていません");

    const [{ remaining }] = await tx.query<{ remaining: number }>(
      "SELECT count(*)::int AS remaining FROM room_topics WHERE room_code = $1 AND drawn_order IS NULL",
      [room.code],
    );
    const reachedLimit = room.end_mode === "count" && room.draw_limit !== null && order >= room.draw_limit;
    const ended = remaining === 0 || reachedLimit;

    await tx.query(
      `UPDATE rooms SET draw_count = $2,
         status = CASE WHEN $3::boolean THEN 'ended' ELSE status END,
         ended_at = CASE WHEN $3::boolean THEN now() ELSE ended_at END
       WHERE code = $1`,
      [room.code, order, ended],
    );

    return { card: { id: card.id, text: card.text, order }, remaining, ended };
  });
}

export async function endRoom(db: Db, code: string, token: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    requireHost(me);
    if (room.status === "ended") return;
    await tx.query("UPDATE rooms SET status = 'ended', ended_at = now() WHERE code = $1", [room.code]);
  });
}

/**
 * Public facts needed to render the join screen. Once a room has ended, its
 * list is public to anyone with the code, so people who lost their session
 * (another browser, a cleared tab) still get the reveal.
 */
export async function getRoomPublicInfo(db: Db, code: string) {
  await purgeIfDue(db);
  const room = await loadRoom(db, code);
  return {
    code: room.code,
    status: room.status,
    nameMode: room.name_mode,
    reveal: room.status === "ended" ? await loadReveal(db, room) : null,
  };
}
