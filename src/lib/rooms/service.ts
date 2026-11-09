import { randomUUID } from "node:crypto";
import type { Db } from "../db";
import { AppError } from "../errors";
import { LIMITS } from "../limits";
import { rollRare } from "../rarity";
import { hashToken, randomCode, randomToken } from "../auth/tokens";
import {
  addTopicSchema,
  answersSchema,
  createRoomSchema,
  drawSchema,
  endRoomSchema,
  joinRoomSchema,
  nicknameSchema,
  type CreateRoomInput,
} from "./schemas";
import type {
  DrawnCard,
  DrawResult,
  EndMode,
  NameMode,
  RevealItem,
  RoomPublicInfo,
  RoomStatus,
  RoomSummary,
  RoomUnchanged,
  RoomView,
} from "./types";
import { parseOrThrow } from "../validation";

/** How long the list waits for the host's せーの after the room ends. */
export const REVEAL_HOLD_MINUTES = 15;
/** The せーの countdown, from the host's tap to the moment every phone opens the list. */
export const REVEAL_COUNTDOWN_SECONDS = 5;

interface RoomRow {
  code: string;
  status: RoomStatus;
  end_mode: EndMode;
  draw_limit: number | null;
  name_mode: NameMode;
  draw_count: number;
  expires_at: Date | string;
  version: number;
  reveal_at: Date | string | null;
  authors_shown: number | null;
  misses_since_rare: number;
  /** The database clock, read with the row. */
  server_now: Date | string;
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

function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
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
    authorsShown: r.authors_shown ?? 0,
  };
}

/**
 * Whether the room's topics may be shown to anyone. A room that ended before
 * the せーの release existed has no reveal time and counts as released.
 */
function isReleased(r: RoomRow): boolean {
  if (r.status !== "ended") return false;
  return r.reveal_at === null || new Date(r.reveal_at).getTime() <= new Date(r.server_now).getTime();
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
    `SELECT *, now() AS server_now FROM rooms WHERE code = $1 AND expires_at > now()${forUpdate ? " FOR UPDATE" : ""}`,
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

/** Marks a change that someone's screen should pick up. Call inside the change's transaction. */
async function bumpVersion(db: Db, code: string) {
  await db.query("UPDATE rooms SET version = version + 1 WHERE code = $1", [code]);
}

async function countRemaining(db: Db, code: string): Promise<number> {
  const [{ remaining }] = await db.query<{ remaining: number }>(
    "SELECT count(*)::int AS remaining FROM room_topics WHERE room_code = $1 AND drawn_order IS NULL",
    [code],
  );
  return remaining;
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
    if (room.status === "ended") throw new AppError("conflict", "このルームはもう終わっています");
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
    await bumpVersion(tx, room.code);
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

/**
 * A poll from a device that already has `knownVersion`. When nothing has
 * changed this costs one single-row read; otherwise it is a full view.
 * Errors (unknown room, bad token) come from the full read.
 */
export async function pollRoomView(
  db: Db,
  code: string,
  token: string | null,
  knownVersion: number,
): Promise<RoomView | RoomUnchanged> {
  if (token) {
    const rows = await db.query<{ version: number; me: string | null }>(
      `SELECT r.version, p.id AS me
       FROM rooms r LEFT JOIN participants p ON p.room_code = r.code AND p.token_hash = $2
       WHERE r.code = $1 AND r.expires_at > now()`,
      [normalizeCode(code), hashToken(token)],
    );
    const row = rows[0];
    if (row?.me && row.version === knownVersion) return { unchanged: true, version: row.version };
  }
  return getRoomView(db, code, token);
}

async function buildView(db: Db, room: RoomRow, me: ParticipantRow): Promise<RoomView> {
  const [counts] = await db.query<{ participants: number; topics: number; remaining: number }>(
    `SELECT
       (SELECT count(*)::int FROM participants WHERE room_code = $1) AS participants,
       (SELECT count(*)::int FROM room_topics WHERE room_code = $1) AS topics,
       (SELECT count(*)::int FROM room_topics WHERE room_code = $1 AND drawn_order IS NULL) AS remaining`,
    [room.code],
  );

  // Only this person's own topics, so "drawn" says nothing about anyone else's.
  const myTopics = await db.query<{ id: string; text: string; drawn: boolean }>(
    `SELECT id, text, drawn_order IS NOT NULL AS drawn FROM room_topics
     WHERE room_code = $1 AND participant_id = $2 ORDER BY created_at, id`,
    [room.code, me.id],
  );

  const drawn = me.is_host
    ? await db.query<{ id: string; text: string; order: number; rare: boolean }>(
        `SELECT id, text, drawn_order AS "order", rare FROM room_topics
         WHERE room_code = $1 AND drawn_order IS NOT NULL ORDER BY drawn_order`,
        [room.code],
      )
    : [];

  // Held for everyone, the host included, until the reveal time.
  const reveal = isReleased(room) ? await loadReveal(db, room) : null;

  return {
    role: me.is_host ? "host" : "participant",
    room: toSummary(room),
    me: { id: me.id, nickname: me.nickname },
    counts,
    myTopics,
    drawn,
    reveal,
    revealAt: iso(room.reveal_at),
    serverNow: iso(room.server_now)!,
    version: room.version,
  };
}

async function loadReveal(db: Db, room: RoomRow): Promise<RevealItem[]> {
  const rows = await db.query<{
    id: string;
    text: string;
    order: number | null;
    rare: boolean;
    nickname: string | null;
  }>(
    `SELECT t.id, t.text, t.drawn_order AS "order", t.rare, p.nickname
     FROM room_topics t JOIN participants p ON p.id = t.participant_id
     WHERE t.room_code = $1
     ORDER BY t.drawn_order NULLS LAST, t.id`, // ids are random, so undrawn topics do not cluster by author
    [room.code],
  );
  // Named rooms reveal authors one by one (答え合わせ), in this same order.
  const shown = room.name_mode === "named" ? (room.authors_shown ?? 0) : 0;
  return rows.map((r, i) => ({
    id: r.id,
    text: r.text,
    order: r.order,
    rare: r.rare,
    author: i < shown ? r.nickname : null,
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
    await bumpVersion(tx, room.code);
    return { id, text, drawn: false };
  });
}

export async function deleteTopic(db: Db, code: string, token: string | null, topicId: string) {
  await db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    if (room.status !== "collecting") {
      throw new AppError("conflict", "受付が締め切られたあとは取り消せません");
    }
    // Deleting a topic that is already gone (a double tap) or not yours
    // changes nothing and is not an error.
    const rows = await tx.query(
      "DELETE FROM room_topics WHERE id = $1 AND room_code = $2 AND participant_id = $3 RETURNING id",
      [topicId, room.code, me.id],
    );
    if (rows.length > 0) await bumpVersion(tx, room.code);
  });
}

export async function startDrawing(db: Db, code: string, token: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    requireHost(me);
    if (room.status !== "collecting") throw new AppError("conflict", "もうめくり始めています");
    const [{ n }] = await tx.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM room_topics WHERE room_code = $1",
      [room.code],
    );
    if (n === 0) throw new AppError("conflict", "トピックが1件もありません。投稿が集まるまで待ちましょう");
    await tx.query("UPDATE rooms SET status = 'drawing', version = version + 1 WHERE code = $1", [room.code]);
  });
}

/**
 * Draws the next card. The host sends `expectedOrder` (the draw it means);
 * if that draw already happened, because a reply got lost and the host
 * tapped again, the same card comes back instead of a new one.
 */
export async function drawCard(
  db: Db,
  code: string,
  token: string | null,
  input: unknown = {},
  random: () => number = Math.random,
): Promise<DrawResult> {
  const { expectedOrder } = parseOrThrow(drawSchema, input);
  return db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    requireHost(me);

    // An older draw than the latest: this device is behind (another host
    // device drew meanwhile). Replaying it would look like a new card.
    if (expectedOrder !== undefined && expectedOrder < room.draw_count) {
      throw new AppError("conflict", "ほかの端末でめくられていました。画面を新しくします");
    }
    if (expectedOrder !== undefined && room.draw_count === expectedOrder) {
      const rows = await tx.query<{ id: string; text: string; order: number; rare: boolean }>(
        `SELECT id, text, drawn_order AS "order", rare FROM room_topics
         WHERE room_code = $1 AND drawn_order = $2`,
        [room.code, expectedOrder],
      );
      if (rows[0]) {
        return {
          card: rows[0],
          remaining: await countRemaining(tx, room.code),
          ended: room.status === "ended",
          revealAt: iso(room.reveal_at),
        };
      }
    }

    if (room.status !== "drawing") {
      throw new AppError("conflict", room.status === "ended" ? "もう終わっています" : "まだ始まっていません");
    }

    const order = room.draw_count + 1;
    // Rarity belongs to the draw, never to the topic (see rarity.ts).
    const rare = rollRare(room.misses_since_rare, random);
    const picked = await tx.query<{ id: string; text: string }>(
      `UPDATE room_topics SET drawn_order = $2, drawn_at = now(), rare = $3
       WHERE id = (
         SELECT id FROM room_topics
         WHERE room_code = $1 AND drawn_order IS NULL
         ORDER BY random() LIMIT 1
       )
       RETURNING id, text`,
      [room.code, order, rare],
    );
    const picked0 = picked[0];
    if (!picked0) throw new AppError("conflict", "めくれるカードが残っていません");
    const card: DrawnCard = { id: picked0.id, text: picked0.text, order, rare };

    const remaining = await countRemaining(tx, room.code);
    const reachedLimit = room.end_mode === "count" && room.draw_limit !== null && order >= room.draw_limit;
    const ended = remaining === 0 || reachedLimit;

    const [updated] = await tx.query<{ reveal_at: Date | string | null }>(
      `UPDATE rooms SET draw_count = $2, version = version + 1,
         misses_since_rare = CASE WHEN $4::boolean THEN 0 ELSE misses_since_rare + 1 END,
         status = CASE WHEN $3::boolean THEN 'ended' ELSE status END,
         ended_at = CASE WHEN $3::boolean THEN now() ELSE ended_at END,
         reveal_at = CASE WHEN $3::boolean THEN ${HOLD_UNTIL("$5")} ELSE reveal_at END
       WHERE code = $1
       RETURNING reveal_at`,
      [room.code, order, ended, rare, REVEAL_HOLD_MINUTES],
    );

    return { card, remaining, ended, revealAt: iso(updated.reveal_at) };
  });
}

/**
 * SQL for when a held list opens by itself: REVEAL_HOLD_MINUTES (the given
 * parameter) after the end, but always a minute before the room expires, so
 * a room ended late in its life is not deleted with its list unseen.
 */
const HOLD_UNTIL = (minutesParam: string) =>
  `GREATEST(now(), LEAST(now() + make_interval(mins => ${minutesParam}), expires_at - interval '1 minute'))`;

/** Moves the release to a few seconds from now, unless it is already sooner. */
async function startCountdown(db: Db, code: string) {
  await db.query(
    `UPDATE rooms SET reveal_at = now() + make_interval(secs => $2), version = version + 1
     WHERE code = $1 AND reveal_at > now() + make_interval(secs => $2)`,
    [code, REVEAL_COUNTDOWN_SECONDS],
  );
}

async function readRevealAt(db: Db, code: string) {
  const [row] = await db.query<{ reveal_at: Date | string | null; server_now: Date | string }>(
    "SELECT reveal_at, now() AS server_now FROM rooms WHERE code = $1",
    [code],
  );
  return { revealAt: iso(row.reveal_at), serverNow: iso(row.server_now)! };
}

/**
 * Ends the room. The list stays held until the host's せーの, or for
 * REVEAL_HOLD_MINUTES at most; `reveal: true` ends and starts the countdown
 * in one step.
 */
export async function endRoom(db: Db, code: string, token: string | null, input: unknown = {}) {
  const { reveal } = parseOrThrow(endRoomSchema, input);
  return db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    requireHost(me);
    if (room.status !== "ended") {
      await tx.query(
        `UPDATE rooms SET status = 'ended', ended_at = now(),
           reveal_at = ${HOLD_UNTIL("$2")}, version = version + 1
         WHERE code = $1`,
        [room.code, REVEAL_HOLD_MINUTES],
      );
    }
    if (reveal) await startCountdown(tx, room.code);
    return readRevealAt(tx, room.code);
  });
}

/** The host's せーの: every phone opens the list REVEAL_COUNTDOWN_SECONDS from now. Safe to repeat. */
export async function revealRoom(db: Db, code: string, token: string | null) {
  return db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    requireHost(me);
    if (room.status !== "ended") throw new AppError("conflict", "まだ終わっていません");
    await startCountdown(tx, room.code);
    return readRevealAt(tx, room.code);
  });
}

/**
 * 答え合わせ in named rooms: shows the authors of the first `upTo` items of
 * the list. It only ever moves forward, so a double tap or a retry with the
 * same `upTo` advances once.
 */
export async function showAuthors(
  db: Db,
  code: string,
  token: string | null,
  input: unknown,
): Promise<{ authorsShown: number }> {
  const { upTo } = parseOrThrow(answersSchema, input);
  return db.transaction(async (tx) => {
    const room = await loadRoom(tx, code, true);
    const me = await authenticate(tx, room, token);
    requireHost(me);
    if (room.name_mode !== "named") throw new AppError("conflict", "このルームでは投稿者を公開しません");
    if (!isReleased(room)) throw new AppError("conflict", "一覧を公開してから答え合わせをしましょう");
    const [{ total }] = await tx.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM room_topics WHERE room_code = $1",
      [room.code],
    );
    const target = Math.min(upTo, total);
    const rows = await tx.query<{ authors_shown: number }>(
      `UPDATE rooms SET authors_shown = $2, version = version + 1
       WHERE code = $1 AND COALESCE(authors_shown, 0) < $2
       RETURNING authors_shown`,
      [room.code, target],
    );
    return { authorsShown: rows[0]?.authors_shown ?? room.authors_shown ?? 0 };
  });
}

/**
 * Public facts needed to render the join screen. Once a room's list is
 * released, it is public to anyone with the code, so people who lost their
 * session (another browser, a cleared tab) still get the reveal.
 */
export async function getRoomPublicInfo(db: Db, code: string): Promise<RoomPublicInfo> {
  await purgeIfDue(db);
  const room = await loadRoom(db, code);
  return {
    code: room.code,
    status: room.status,
    nameMode: room.name_mode,
    reveal: isReleased(room) ? await loadReveal(db, room) : null,
    revealAt: iso(room.reveal_at),
    serverNow: iso(room.server_now)!,
  };
}
