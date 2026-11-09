import { beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/lib/db/pglite";
import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  addTopic,
  createRoom,
  deleteTopic,
  drawCard,
  endRoom,
  getRoomPublicInfo,
  getRoomView,
  joinRoom,
  pollRoomView,
  REVEAL_COUNTDOWN_SECONDS,
  REVEAL_HOLD_MINUTES,
  revealRoom,
  showAuthors,
  startDrawing,
} from "@/lib/rooms/service";
import { makeDeckDraft, parseDeckDraft, revealShareText } from "@/lib/rooms/results";
import type { RoomView } from "@/lib/rooms/types";

let db: Db;
beforeEach(async () => {
  db = await createPgliteDb();
});

async function expectAppError(p: Promise<unknown>, code: AppError["code"]) {
  await expect(p).rejects.toBeInstanceOf(AppError);
  await p.catch((e: AppError) => expect(e.code).toBe(code));
}

/** Moves a held room past its reveal time, as if the countdown had run out. */
async function passRevealTime(code: string) {
  await db.query("UPDATE rooms SET reveal_at = now() - interval '1 second' WHERE code = $1", [code]);
}

async function version(code: string): Promise<number> {
  const [row] = await db.query<{ version: number }>("SELECT version FROM rooms WHERE code = $1", [code]);
  return row.version;
}

const secondsBetween = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / 1000;

describe("room lifecycle", () => {
  it("collects topics, hides them until the release, then reveals them to everyone", async () => {
    const host = await createRoom(db, {});
    const alice = await joinRoom(db, host.code, { nickname: "アリス" });
    const bob = await joinRoom(db, host.code.toLowerCase(), { nickname: "ボブ" });

    await addTopic(db, host.code, alice.token, { text: "  最近ハマってる   ゲーム " });
    await addTopic(db, host.code, bob.token, { text: "好きなエディタ" });
    await addTopic(db, host.code, host.token, { text: "地元の自慢" });

    const aliceView = await getRoomView(db, host.code, alice.token);
    expect(aliceView.role).toBe("participant");
    expect(aliceView.myTopics).toEqual([{ id: expect.any(String), text: "最近ハマってる ゲーム", drawn: false }]);
    expect(aliceView.counts).toEqual({ participants: 3, topics: 3, remaining: 3 });
    expect(aliceView.reveal).toBeNull();
    expect(aliceView.revealAt).toBeNull();
    expect(JSON.stringify(aliceView)).not.toContain("好きなエディタ");

    const hostView = await getRoomView(db, host.code, host.token);
    expect(hostView.role).toBe("host");
    expect(JSON.stringify(hostView)).not.toContain("好きなエディタ");

    await startDrawing(db, host.code, host.token);
    const first = await drawCard(db, host.code, host.token);
    expect(first.card.order).toBe(1);
    expect(first.remaining).toBe(2);
    expect(first.ended).toBe(false);
    expect(first.revealAt).toBeNull();

    // Participants still cannot see drawn cards while drawing.
    const midView = await getRoomView(db, host.code, bob.token);
    expect(midView.drawn).toEqual([]);
    expect(midView.reveal).toBeNull();

    await drawCard(db, host.code, host.token);
    const last = await drawCard(db, host.code, host.token);
    expect(last.ended).toBe(true);
    expect(last.remaining).toBe(0);

    // Ended, but the list waits for the host's せーの (or the hold time).
    const held = await getRoomView(db, host.code, bob.token);
    expect(held.room.status).toBe("ended");
    expect(held.reveal).toBeNull();
    expect(secondsBetween(held.revealAt!, held.serverNow)).toBeCloseTo(REVEAL_HOLD_MINUTES * 60, -1);
    expect(last.revealAt).toBe(held.revealAt);
    expect((await getRoomView(db, host.code, host.token)).reveal).toBeNull();
    expect((await getRoomPublicInfo(db, host.code)).reveal).toBeNull();

    await passRevealTime(host.code);
    const endView = await getRoomView(db, host.code, bob.token);
    expect(endView.reveal).toHaveLength(3);
    expect(endView.reveal!.map((r) => r.order)).toEqual([1, 2, 3]);
    // Default name mode is anonymous: no authors in the reveal.
    expect(endView.reveal!.every((r) => r.author === null)).toBe(true);

    await expectAppError(drawCard(db, host.code, host.token), "conflict");
  });

  it("ends after the chosen number of draws and shows undrawn topics last", async () => {
    const host = await createRoom(db, { endMode: "count", drawLimit: 2, nameMode: "named", hostNickname: "ニコ" });
    const p = await joinRoom(db, host.code, { nickname: "ケン" });
    for (const t of ["A", "B", "C", "D"]) await addTopic(db, host.code, p.token, { text: t });
    await startDrawing(db, host.code, host.token);
    expect((await drawCard(db, host.code, host.token)).ended).toBe(false);
    const last = await drawCard(db, host.code, host.token);
    expect(last.ended).toBe(true);
    expect(last.revealAt).not.toBeNull();

    await passRevealTime(host.code);
    const view = await getRoomView(db, host.code, p.token);
    expect(view.reveal!.map((r) => r.order)).toEqual([1, 2, null, null]);
  });

  it("supports rooms without nicknames", async () => {
    const host = await createRoom(db, { nameMode: "none" });
    const p = await joinRoom(db, host.code, {});
    const view = await getRoomView(db, host.code, p.token);
    expect(view.me.nickname).toBeNull();
    expect((await getRoomPublicInfo(db, host.code)).nameMode).toBe("none");
  });

  it("lets the host end early; the list opens after the countdown", async () => {
    const host = await createRoom(db, {});
    await addTopic(db, host.code, host.token, { text: "X" });
    const ended = await endRoom(db, host.code, host.token, { reveal: true });
    expect(secondsBetween(ended.revealAt!, ended.serverNow)).toBeCloseTo(REVEAL_COUNTDOWN_SECONDS, 0);
    expect((await getRoomView(db, host.code, host.token)).reveal).toBeNull();

    await passRevealTime(host.code);
    const view = await getRoomView(db, host.code, host.token);
    expect(view.reveal).toEqual([{ id: expect.any(String), text: "X", order: null, rare: false, author: null }]);
  });

  it("holds the list for the hold time when the host ends without せーの", async () => {
    const host = await createRoom(db, {});
    await addTopic(db, host.code, host.token, { text: "X" });
    const ended = await endRoom(db, host.code, host.token);
    expect(secondsBetween(ended.revealAt!, ended.serverNow)).toBeCloseTo(REVEAL_HOLD_MINUTES * 60, -1);
    // Ending again changes nothing.
    const again = await endRoom(db, host.code, host.token);
    expect(again.revealAt).toBe(ended.revealAt);
  });
});

describe("せーの release", () => {
  async function heldRoom() {
    const host = await createRoom(db, {});
    const p = await joinRoom(db, host.code, { nickname: "P" });
    const author = await joinRoom(db, host.code, { nickname: "A" });
    await addTopic(db, host.code, author.token, { text: "ひみつ" });
    await startDrawing(db, host.code, host.token);
    await endRoom(db, host.code, host.token);
    return { host, p };
  }

  it("hides the list from the host, participants and public info until revealAt", async () => {
    const { host, p } = await heldRoom();
    const before = await revealRoom(db, host.code, host.token);
    expect(secondsBetween(before.revealAt!, before.serverNow)).toBeCloseTo(REVEAL_COUNTDOWN_SECONDS, 0);

    for (const view of [await getRoomView(db, host.code, host.token), await getRoomView(db, host.code, p.token)]) {
      expect(view.reveal).toBeNull();
      expect(view.revealAt).toBe(before.revealAt);
      expect(JSON.stringify(view)).not.toContain("ひみつ");
    }
    const info = await getRoomPublicInfo(db, host.code);
    expect(info.reveal).toBeNull();
    expect(info.revealAt).toBe(before.revealAt);
    expect(JSON.stringify(info)).not.toContain("ひみつ");

    await passRevealTime(host.code);
    expect((await getRoomView(db, host.code, host.token)).reveal).toHaveLength(1);
    expect((await getRoomView(db, host.code, p.token)).reveal).toHaveLength(1);
    expect((await getRoomPublicInfo(db, host.code)).reveal).toHaveLength(1);
  });

  it("is idempotent and never pushes the release later", async () => {
    const { host } = await heldRoom();
    const first = await revealRoom(db, host.code, host.token);
    const v = await version(host.code);
    const second = await revealRoom(db, host.code, host.token);
    expect(second.revealAt).toBe(first.revealAt);
    expect(await version(host.code)).toBe(v);

    await passRevealTime(host.code);
    const [{ reveal_at }] = await db.query<{ reveal_at: Date }>("SELECT reveal_at FROM rooms WHERE code = $1", [
      host.code,
    ]);
    await revealRoom(db, host.code, host.token);
    const [after] = await db.query<{ reveal_at: Date }>("SELECT reveal_at FROM rooms WHERE code = $1", [host.code]);
    expect(after.reveal_at).toEqual(reveal_at);
  });

  it("is for the host only, and only once the room has ended", async () => {
    const host = await createRoom(db, {});
    const p = await joinRoom(db, host.code, { nickname: "P" });
    await addTopic(db, host.code, p.token, { text: "T" });
    await expectAppError(revealRoom(db, host.code, host.token), "conflict");
    await endRoom(db, host.code, host.token);
    await expectAppError(revealRoom(db, host.code, p.token), "forbidden");
  });
});

describe("答え合わせ", () => {
  async function namedRoom() {
    const host = await createRoom(db, { nameMode: "named", hostNickname: "ニコ" });
    const ken = await joinRoom(db, host.code, { nickname: "ケン" });
    await addTopic(db, host.code, ken.token, { text: "A" });
    await addTopic(db, host.code, host.token, { text: "B" });
    await addTopic(db, host.code, ken.token, { text: "C" });
    await startDrawing(db, host.code, host.token);
    await drawCard(db, host.code, host.token);
    await endRoom(db, host.code, host.token, { reveal: true });
    return { host, ken };
  }

  it("keeps authors hidden after the release until the host shows them, in list order", async () => {
    const { host, ken } = await namedRoom();
    await expectAppError(showAuthors(db, host.code, host.token, { upTo: 1 }), "conflict"); // not released yet
    await passRevealTime(host.code);

    const view = await getRoomView(db, host.code, ken.token);
    expect(view.reveal!.map((r) => r.author)).toEqual([null, null, null]);
    expect(view.room.authorsShown).toBe(0);
    expect(JSON.stringify(view.reveal)).not.toContain("ニコ");
    expect((await getRoomPublicInfo(db, host.code)).reveal!.every((r) => r.author === null)).toBe(true);

    expect(await showAuthors(db, host.code, host.token, { upTo: 1 })).toEqual({ authorsShown: 1 });
    const after = await getRoomView(db, host.code, ken.token);
    const firstAuthor = (await db.query<{ nickname: string }>(
      `SELECT p.nickname FROM room_topics t JOIN participants p ON p.id = t.participant_id
       WHERE t.id = $1`,
      [after.reveal![0].id],
    ))[0].nickname;
    expect(after.reveal![0].order).toBe(1);
    expect(after.reveal!.map((r) => r.author)).toEqual([firstAuthor, null, null]);
    expect((await getRoomPublicInfo(db, host.code)).reveal!.map((r) => r.author)).toEqual([firstAuthor, null, null]);
    expect((await getRoomView(db, host.code, host.token)).reveal!.map((r) => r.author)).toEqual([
      firstAuthor,
      null,
      null,
    ]);
  });

  it("advances once on a double tap and never goes back", async () => {
    const { host } = await namedRoom();
    await passRevealTime(host.code);
    await showAuthors(db, host.code, host.token, { upTo: 1 });
    const v = await version(host.code);
    expect(await showAuthors(db, host.code, host.token, { upTo: 1 })).toEqual({ authorsShown: 1 });
    expect(await showAuthors(db, host.code, host.token, { upTo: 0 })).toEqual({ authorsShown: 1 });
    expect(await version(host.code)).toBe(v);

    // upTo past the end shows everything.
    expect(await showAuthors(db, host.code, host.token, { upTo: 99 })).toEqual({ authorsShown: 3 });
    const view = await getRoomView(db, host.code, host.token);
    expect(view.reveal!.every((r) => r.author !== null)).toBe(true);
  });

  it("is for the host of a named room only", async () => {
    const { host, ken } = await namedRoom();
    await passRevealTime(host.code);
    await expectAppError(showAuthors(db, host.code, ken.token, { upTo: 1 }), "forbidden");
    await expectAppError(showAuthors(db, host.code, host.token, { upTo: -1 }), "bad_request");

    const anon = await createRoom(db, {});
    await addTopic(db, anon.code, anon.token, { text: "T" });
    await endRoom(db, anon.code, anon.token, { reveal: true });
    await passRevealTime(anon.code);
    await expectAppError(showAuthors(db, anon.code, anon.token, { upTo: 1 }), "conflict");
  });
});

describe("light polling", () => {
  it("answers unchanged while nothing changed, and bumps the version for every visible change", async () => {
    const host = await createRoom(db, { nameMode: "named", hostNickname: "H" });
    const view = await getRoomView(db, host.code, host.token);
    expect(await pollRoomView(db, host.code, host.token, view.version)).toEqual({
      unchanged: true,
      version: view.version,
    });

    let last = view.version;
    const expectBumped = async () => {
      const v = await version(host.code);
      expect(v).toBeGreaterThan(last);
      last = v;
    };

    const p = await joinRoom(db, host.code, { nickname: "P" });
    await expectBumped();
    const t = await addTopic(db, host.code, p.token, { text: "T1" });
    await expectBumped();
    await deleteTopic(db, host.code, p.token, t.id);
    await expectBumped();
    await addTopic(db, host.code, p.token, { text: "T2" });
    await addTopic(db, host.code, p.token, { text: "T3" });
    last = await version(host.code);
    await startDrawing(db, host.code, host.token);
    await expectBumped();
    await drawCard(db, host.code, host.token);
    await expectBumped();
    await endRoom(db, host.code, host.token);
    await expectBumped();
    await revealRoom(db, host.code, host.token);
    await expectBumped();
    await passRevealTime(host.code);
    await showAuthors(db, host.code, host.token, { upTo: 1 });
    await expectBumped();

    // An old version gets the full view, with the current version.
    const full = (await pollRoomView(db, host.code, p.token, view.version)) as RoomView;
    expect(full.version).toBe(last);
    expect(full.reveal).toHaveLength(2);
  });

  it("still rejects unknown tokens and rooms on the light path", async () => {
    const host = await createRoom(db, {});
    const { version: v } = await getRoomView(db, host.code, host.token);
    await expectAppError(pollRoomView(db, host.code, "nope", v), "unauthorized");
    await expectAppError(pollRoomView(db, host.code, null, v), "unauthorized");
    await expectAppError(pollRoomView(db, "ZZZZZZ", host.token, v), "not_found");
  });
});

describe("drawing", () => {
  it("returns the same card when a draw is retried", async () => {
    const host = await createRoom(db, { endMode: "count", drawLimit: 2 });
    for (const text of ["a", "b", "c"]) await addTopic(db, host.code, host.token, { text });
    await startDrawing(db, host.code, host.token);

    const first = await drawCard(db, host.code, host.token, { expectedOrder: 1 });
    const retry = await drawCard(db, host.code, host.token, { expectedOrder: 1 });
    expect(retry.card).toEqual(first.card);
    expect((await getRoomView(db, host.code, host.token)).room.drawCount).toBe(1);

    // The last draw ends the room; its retry still gets the card back.
    const second = await drawCard(db, host.code, host.token, { expectedOrder: 2 });
    expect(second.ended).toBe(true);
    const retryLast = await drawCard(db, host.code, host.token, { expectedOrder: 2 });
    expect(retryLast).toEqual(second);
    await expectAppError(drawCard(db, host.code, host.token, { expectedOrder: 3 }), "conflict");
  });

  it("stores rare draws and keeps them on reload", async () => {
    const host = await createRoom(db, {});
    for (const text of ["a", "b", "c"]) await addTopic(db, host.code, host.token, { text });
    await startDrawing(db, host.code, host.token);

    const plain = await drawCard(db, host.code, host.token, {}, () => 0.99);
    expect(plain.card.rare).toBe(false);
    const rare = await drawCard(db, host.code, host.token, {}, () => 0);
    expect(rare.card.rare).toBe(true);
    const [{ misses_since_rare }] = await db.query<{ misses_since_rare: number }>(
      "SELECT misses_since_rare FROM rooms WHERE code = $1",
      [host.code],
    );
    expect(misses_since_rare).toBe(0);

    const reloaded = await getRoomView(db, host.code, host.token);
    expect(reloaded.drawn.map((c) => c.rare)).toEqual([false, true]);

    await endRoom(db, host.code, host.token, { reveal: true });
    await passRevealTime(host.code);
    const reveal = (await getRoomView(db, host.code, host.token)).reveal!;
    expect(reveal.map((r) => r.rare)).toEqual([false, true, false]);
  });

  it("makes a draw rare after too many misses in a row", async () => {
    const host = await createRoom(db, {});
    await addTopic(db, host.code, host.token, { text: "a" });
    await addTopic(db, host.code, host.token, { text: "b" });
    await startDrawing(db, host.code, host.token);
    await db.query("UPDATE rooms SET misses_since_rare = 9 WHERE code = $1", [host.code]);
    expect((await drawCard(db, host.code, host.token, {}, () => 0.99)).card.rare).toBe(true);
    await drawCard(db, host.code, host.token, {}, () => 0.99);
    const [{ misses_since_rare }] = await db.query<{ misses_since_rare: number }>(
      "SELECT misses_since_rare FROM rooms WHERE code = $1",
      [host.code],
    );
    expect(misses_since_rare).toBe(1);
  });

  it("tells people when their own topic was drawn, and nothing about anyone else's", async () => {
    const host = await createRoom(db, {});
    const p = await joinRoom(db, host.code, { nickname: "P" });
    const q = await joinRoom(db, host.code, { nickname: "Q" });
    await addTopic(db, host.code, p.token, { text: "mine" });
    await addTopic(db, host.code, q.token, { text: "theirs" });
    await startDrawing(db, host.code, host.token);
    // Draw until p's topic is out (random order).
    let drawnText = "";
    while (drawnText !== "mine") drawnText = (await drawCard(db, host.code, host.token)).card.text;

    const pv = await getRoomView(db, host.code, p.token);
    expect(pv.myTopics).toEqual([{ id: expect.any(String), text: "mine", drawn: true }]);
    const qv = await getRoomView(db, host.code, q.token);
    expect(qv.myTopics.map((t) => t.text)).toEqual(["theirs"]);
    expect(JSON.stringify(qv)).not.toContain("mine");
  });

  it("leaks no one else's topics to participants before the release, in any phase", async () => {
    const host = await createRoom(db, { nameMode: "named", hostNickname: "ホストさん" });
    const p = await joinRoom(db, host.code, { nickname: "P" });
    const q = await joinRoom(db, host.code, { nickname: "Q" });
    const secrets = ["ひみつ1", "ひみつ2", "ひみつ3"];
    await addTopic(db, host.code, q.token, { text: secrets[0] });
    await addTopic(db, host.code, q.token, { text: secrets[1] });
    await addTopic(db, host.code, host.token, { text: secrets[2] });
    await addTopic(db, host.code, p.token, { text: "pのトピック" });

    const check = async () => {
      const seen = JSON.stringify([
        await getRoomView(db, host.code, p.token),
        await pollRoomView(db, host.code, p.token, -1),
        await getRoomPublicInfo(db, host.code),
      ]);
      for (const s of [...secrets, "ホストさん", '"Q"']) expect(seen).not.toContain(s);
    };

    await check(); // collecting
    await startDrawing(db, host.code, host.token);
    await check(); // drawing
    await drawCard(db, host.code, host.token);
    await drawCard(db, host.code, host.token);
    await check(); // drawing, some drawn
    await endRoom(db, host.code, host.token);
    await check(); // ended, held
    await revealRoom(db, host.code, host.token);
    await check(); // countdown

    await passRevealTime(host.code);
    const released = JSON.stringify(await getRoomView(db, host.code, p.token));
    for (const s of secrets) expect(released).toContain(s);
    expect(released).not.toContain("ホストさん"); // names wait for 答え合わせ
  });
});

describe("room rules", () => {
  it("requires a nickname unless the room has none", async () => {
    const host = await createRoom(db, {});
    await expectAppError(joinRoom(db, host.code, { nickname: "   " }), "bad_request");
    await expectAppError(joinRoom(db, host.code, { nickname: "あ".repeat(21) }), "bad_request");
  });

  it("only the host can start, draw and end", async () => {
    const host = await createRoom(db, {});
    const p = await joinRoom(db, host.code, { nickname: "P" });
    await addTopic(db, host.code, p.token, { text: "T" });
    await expectAppError(startDrawing(db, host.code, p.token), "forbidden");
    await startDrawing(db, host.code, host.token);
    await expectAppError(drawCard(db, host.code, p.token), "forbidden");
    await expectAppError(endRoom(db, host.code, p.token), "forbidden");
  });

  it("rejects unknown tokens and unknown rooms", async () => {
    const host = await createRoom(db, {});
    await expectAppError(getRoomView(db, host.code, "nope"), "unauthorized");
    await expectAppError(getRoomView(db, host.code, null), "unauthorized");
    await expectAppError(getRoomView(db, "ZZZZZZ", host.token), "not_found");
  });

  it("cannot start without topics, and closes posting once drawing starts", async () => {
    const host = await createRoom(db, {});
    await expectAppError(startDrawing(db, host.code, host.token), "conflict");
    const t = await addTopic(db, host.code, host.token, { text: "T" });
    await startDrawing(db, host.code, host.token);
    await expectAppError(addTopic(db, host.code, host.token, { text: "late" }), "conflict");
    await expectAppError(deleteTopic(db, host.code, host.token, t.id), "conflict");
  });

  it("lets people delete only their own topics while collecting", async () => {
    const host = await createRoom(db, {});
    const p = await joinRoom(db, host.code, { nickname: "P" });
    const mine = await addTopic(db, host.code, p.token, { text: "mine" });
    const hosts = await addTopic(db, host.code, host.token, { text: "host's" });
    await expectAppError(deleteTopic(db, host.code, p.token, hosts.id), "not_found");
    await deleteTopic(db, host.code, p.token, mine.id);
    expect((await getRoomView(db, host.code, p.token)).myTopics).toEqual([]);
  });

  it("validates topic text and enforces the per-person limit", async () => {
    const host = await createRoom(db, {});
    await expectAppError(addTopic(db, host.code, host.token, { text: "" }), "bad_request");
    await expectAppError(addTopic(db, host.code, host.token, { text: "a".repeat(81) }), "bad_request");
    for (let i = 0; i < 20; i++) await addTopic(db, host.code, host.token, { text: `t${i}` });
    await expectAppError(addTopic(db, host.code, host.token, { text: "one more" }), "limit_reached");
  });

  it("requires a draw count in count mode", async () => {
    await expectAppError(createRoom(db, { endMode: "count" }), "bad_request");
    await expectAppError(createRoom(db, { endMode: "count", drawLimit: 0 }), "bad_request");
  });

  it("treats expired rooms as gone and purges them on the next create", async () => {
    const host = await createRoom(db, {});
    await db.query("UPDATE rooms SET expires_at = now() - interval '1 minute' WHERE code = $1", [host.code]);
    await expectAppError(getRoomView(db, host.code, host.token), "not_found");
    await createRoom(db, {});
    const rows = await db.query("SELECT 1 FROM rooms WHERE code = $1", [host.code]);
    expect(rows).toHaveLength(0);
  });

  it("does not let new people join after the end", async () => {
    const host = await createRoom(db, {});
    await endRoom(db, host.code, host.token);
    await expectAppError(joinRoom(db, host.code, { nickname: "late" }), "conflict");
  });

  it("keeps public info free of topics until the release, then shares the reveal", async () => {
    const host = await createRoom(db, { nameMode: "named", hostNickname: "H" });
    await addTopic(db, host.code, host.token, { text: "secret" });
    const before = await getRoomPublicInfo(db, host.code);
    expect(before).toEqual({
      code: host.code,
      status: "collecting",
      nameMode: "named",
      reveal: null,
      revealAt: null,
      serverNow: expect.any(String),
    });
    await startDrawing(db, host.code, host.token);
    expect((await getRoomPublicInfo(db, host.code)).reveal).toBeNull();
    await endRoom(db, host.code, host.token);
    expect((await getRoomPublicInfo(db, host.code)).reveal).toBeNull();
    await passRevealTime(host.code);
    const after = await getRoomPublicInfo(db, host.code);
    expect(after.reveal).toEqual([{ id: expect.any(String), text: "secret", order: null, rare: false, author: null }]);
    await showAuthors(db, host.code, host.token, { upTo: 1 });
    expect((await getRoomPublicInfo(db, host.code)).reveal![0].author).toBe("H");
  });

  it("treats rooms that ended before the release time existed as released", async () => {
    const host = await createRoom(db, {});
    await addTopic(db, host.code, host.token, { text: "old" });
    await endRoom(db, host.code, host.token);
    await db.query("UPDATE rooms SET reveal_at = NULL WHERE code = $1", [host.code]);
    expect((await getRoomView(db, host.code, host.token)).reveal).toHaveLength(1);
  });

  it("orders the reveal by draw order, with undrawn topics last", async () => {
    const host = await createRoom(db, { endMode: "count", drawLimit: 2 });
    for (const text of ["a", "b", "c", "d"]) await addTopic(db, host.code, host.token, { text });
    await startDrawing(db, host.code, host.token);
    await drawCard(db, host.code, host.token);
    const last = await drawCard(db, host.code, host.token);
    expect(last.ended).toBe(true);
    await passRevealTime(host.code);
    const view = await getRoomView(db, host.code, host.token);
    expect(view.reveal?.map((r) => r.order)).toEqual([1, 2, null, null]);
  });
});

describe("results to keep", () => {
  const item = (text: string, order: number | null, author: string | null = null) => ({
    id: text,
    text,
    order,
    rare: false,
    author,
  });

  it("drafts a deck with drawn topics first, no names, at most the deck limit", () => {
    const undrawn = Array.from({ length: 250 }, (_, i) => item(`u${i}`, null));
    const draft = makeDeckDraft([item("two", 2), item("one", 1, "ケン"), ...undrawn], new Date(2026, 10, 9));
    expect(draft.title).toBe("11/9のみんなの話題");
    expect(draft.cards).toHaveLength(200);
    expect(draft.cards.slice(0, 3)).toEqual(["one", "two", "u0"]);
    expect(draft.omitted).toBe(52);
    expect(JSON.stringify(draft)).not.toContain("ケン");

    expect(parseDeckDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseDeckDraft("not json")).toBeNull();
    const cards = Array.from({ length: 205 }, (_, i) => `c${i}`);
    expect(parseDeckDraft(JSON.stringify({ title: "t", cards }))).toEqual({
      title: "t",
      cards: cards.slice(0, 200),
      omitted: 5,
    });
  });

  it("writes the list to share: numbered drawn topics, then the rest, then the site", () => {
    const text = revealShareText([item("A", 1, "ケン"), item("B", 2), item("C", null, "ニコ")], "https://example.com/");
    expect(text.split("\n")).toEqual([
      "めくトークで集まった話題",
      "",
      "めくった話題",
      "1. A",
      "2. B",
      "",
      "出番がなかった話題",
      "・C",
      "",
      "https://example.com/",
    ]);
  });
});
