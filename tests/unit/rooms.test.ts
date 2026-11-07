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
  startDrawing,
} from "@/lib/rooms/service";

let db: Db;
beforeEach(async () => {
  db = await createPgliteDb();
});

async function expectAppError(p: Promise<unknown>, code: AppError["code"]) {
  await expect(p).rejects.toBeInstanceOf(AppError);
  await p.catch((e: AppError) => expect(e.code).toBe(code));
}

describe("room lifecycle", () => {
  it("collects topics, hides them until the end, then reveals them to everyone", async () => {
    const host = await createRoom(db, {});
    const alice = await joinRoom(db, host.code, { nickname: "アリス" });
    const bob = await joinRoom(db, host.code.toLowerCase(), { nickname: "ボブ" });

    await addTopic(db, host.code, alice.token, { text: "  最近ハマってる   ゲーム " });
    await addTopic(db, host.code, bob.token, { text: "好きなエディタ" });
    await addTopic(db, host.code, host.token, { text: "地元の自慢" });

    const aliceView = await getRoomView(db, host.code, alice.token);
    expect(aliceView.role).toBe("participant");
    expect(aliceView.myTopics.map((t) => t.text)).toEqual(["最近ハマってる ゲーム"]);
    expect(aliceView.counts).toEqual({ participants: 3, topics: 3, remaining: 3 });
    expect(aliceView.reveal).toBeNull();
    expect(JSON.stringify(aliceView)).not.toContain("好きなエディタ");

    const hostView = await getRoomView(db, host.code, host.token);
    expect(hostView.role).toBe("host");
    expect(JSON.stringify(hostView)).not.toContain("好きなエディタ");

    await startDrawing(db, host.code, host.token);
    const first = await drawCard(db, host.code, host.token);
    expect(first.card.order).toBe(1);
    expect(first.remaining).toBe(2);
    expect(first.ended).toBe(false);

    // Participants still cannot see drawn cards while drawing.
    const midView = await getRoomView(db, host.code, bob.token);
    expect(midView.drawn).toEqual([]);
    expect(midView.reveal).toBeNull();

    await drawCard(db, host.code, host.token);
    const last = await drawCard(db, host.code, host.token);
    expect(last.ended).toBe(true);
    expect(last.remaining).toBe(0);

    const endView = await getRoomView(db, host.code, bob.token);
    expect(endView.room.status).toBe("ended");
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
    expect((await drawCard(db, host.code, host.token)).ended).toBe(true);

    const view = await getRoomView(db, host.code, p.token);
    expect(view.reveal!.map((r) => r.order)).toEqual([1, 2, null, null]);
    expect(view.reveal!.every((r) => r.author === "ケン")).toBe(true);
  });

  it("supports rooms without nicknames", async () => {
    const host = await createRoom(db, { nameMode: "none" });
    const p = await joinRoom(db, host.code, {});
    const view = await getRoomView(db, host.code, p.token);
    expect(view.me.nickname).toBeNull();
    expect((await getRoomPublicInfo(db, host.code)).nameMode).toBe("none");
  });

  it("lets the host end early, revealing everything", async () => {
    const host = await createRoom(db, {});
    await addTopic(db, host.code, host.token, { text: "X" });
    await endRoom(db, host.code, host.token);
    const view = await getRoomView(db, host.code, host.token);
    expect(view.reveal).toEqual([{ id: expect.any(String), text: "X", order: null, author: null }]);
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
});
