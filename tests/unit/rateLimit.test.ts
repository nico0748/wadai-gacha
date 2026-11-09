import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handle, json } from "@/lib/api";
import type { Db } from "@/lib/db";
import { createPgliteDb } from "@/lib/db/pglite";
import { AppError } from "@/lib/errors";
import {
  RATE_LIMITS,
  assertUnderLimit,
  clientIp,
  guardRoomAccess,
  guardRoomLookup,
  purgeRateLimits,
  rateLimit,
} from "@/lib/rateLimit";

let db: Db;
beforeEach(async () => {
  db = await createPgliteDb();
});
afterEach(() => {
  vi.useRealTimers();
});

// 15 seconds into a one-minute window.
const T0 = Date.UTC(2026, 10, 9, 12, 0, 15);

async function count(key: string) {
  const rows = await db.query<{ count: number }>("SELECT count FROM rate_limits WHERE key = $1", [key]);
  return rows.reduce((n, r) => n + Number(r.count), 0);
}

describe("rateLimit", () => {
  it("counts hits per key and refuses them once over the limit", async () => {
    for (let i = 0; i < 3; i++) await rateLimit(db, "a", 3, 60, T0 + i);
    const err = await rateLimit(db, "a", 3, 60, T0 + 10).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: "rate_limited", status: 429, retryAfter: 45 });
    expect((err as AppError).message).toBe("アクセスが集中しています。少し待ってからもう一度お試しください");
    // Other keys are counted separately.
    await expect(rateLimit(db, "b", 3, 60, T0)).resolves.toBeUndefined();
    expect(await count("a")).toBe(4);
  });

  it("starts a fresh count when the window rolls over", async () => {
    for (let i = 0; i < 2; i++) await rateLimit(db, "a", 2, 60, T0);
    await expect(rateLimit(db, "a", 2, 60, T0 + 44_000)).rejects.toMatchObject({ code: "rate_limited" });
    // T0 is 15s into its window, so 45s later is the start of the next one.
    await expect(rateLimit(db, "a", 2, 60, T0 + 45_000)).resolves.toBeUndefined();
    const rows = await db.query<{ window_start: Date }>("SELECT window_start FROM rate_limits ORDER BY window_start");
    expect(rows.map((r) => new Date(r.window_start).toISOString())).toEqual([
      "2026-11-09T12:00:00.000Z",
      "2026-11-09T12:01:00.000Z",
    ]);
  });

  it("can check a limit without counting a hit", async () => {
    await assertUnderLimit(db, "a", 1, 60, T0);
    expect(await count("a")).toBe(0);
    await rateLimit(db, "a", 1, 60, T0);
    await expect(assertUnderLimit(db, "a", 1, 60, T0)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("turns into a 429 with Retry-After through handle()", async () => {
    const route = handle(async () => {
      await rateLimit(db, "route", 1, 60, T0);
      return json({ ok: true });
    });
    expect((await route()).status).toBe(200);
    const res = await route();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ error: { code: "rate_limited" } });
  });

  it("deletes windows older than a day", async () => {
    await rateLimit(db, "old", 10, 60, T0 - 25 * 3600 * 1000);
    await rateLimit(db, "new", 10, 60, T0 - 3600 * 1000);
    await purgeRateLimits(db, T0);
    expect(await count("old")).toBe(0);
    expect(await count("new")).toBe(1);
  });
});

describe("guardRoomLookup", () => {
  it("refuses every lookup from an address that has missed too often", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const miss = () => Promise.reject(new AppError("not_found", "ルームが見つかりません"));
    const hit = () => Promise.resolve("room");

    await expect(guardRoomLookup(db, "1.2.3.4", hit)).resolves.toBe("room");
    for (let i = 0; i < RATE_LIMITS.roomMiss.limit; i++) {
      await expect(guardRoomLookup(db, "1.2.3.4", miss)).rejects.toMatchObject({ code: "not_found" });
    }
    // Hits are refused too, so a guess that lands looks the same as one that does not.
    await expect(guardRoomLookup(db, "1.2.3.4", hit)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(guardRoomLookup(db, "5.6.7.8", hit)).resolves.toBe("room");

    vi.setSystemTime(T0 + RATE_LIMITS.roomMiss.windowSeconds * 1000);
    await expect(guardRoomLookup(db, "1.2.3.4", hit)).resolves.toBe("room");
  });

  it("does not count other errors as misses", async () => {
    const conflict = () => Promise.reject(new AppError("conflict", "終わっています"));
    await expect(guardRoomLookup(db, "1.2.3.4", conflict)).rejects.toMatchObject({ code: "conflict" });
    expect(await count("roomMiss:1.2.3.4")).toBe(0);
  });
});

describe("guardRoomAccess", () => {
  const ok = () => Promise.resolve("view");
  const missing = () => Promise.reject(new AppError("not_found", "ルームが見つかりません"));
  const wrongToken = () => Promise.reject(new AppError("unauthorized", "このルームに参加していません"));

  it("answers 429 to both missing rooms and wrong tokens once an address has missed too often", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    await expect(guardRoomAccess(db, "1.2.3.4", wrongToken)).rejects.toMatchObject({ code: "unauthorized" });
    for (let i = 0; i < RATE_LIMITS.roomMiss.limit; i++) {
      await expect(guardRoomAccess(db, "1.2.3.4", missing)).rejects.toMatchObject({ code: "not_found" });
    }
    await expect(guardRoomAccess(db, "1.2.3.4", missing)).rejects.toMatchObject({ code: "rate_limited" });
    await expect(guardRoomAccess(db, "1.2.3.4", wrongToken)).rejects.toMatchObject({ code: "rate_limited" });
    // A real token still works, so a host behind the same Wi-Fi is not locked out.
    await expect(guardRoomAccess(db, "1.2.3.4", ok)).resolves.toBe("view");
    await expect(guardRoomAccess(db, "5.6.7.8", wrongToken)).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("does not count wrong tokens or other errors as misses", async () => {
    const forbidden = () => Promise.reject(new AppError("forbidden", "ホストだけ"));
    await expect(guardRoomAccess(db, "1.2.3.4", wrongToken)).rejects.toMatchObject({ code: "unauthorized" });
    await expect(guardRoomAccess(db, "1.2.3.4", forbidden)).rejects.toMatchObject({ code: "forbidden" });
    expect(await count("roomMiss:1.2.3.4")).toBe(0);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/api", { headers });

  it("uses the first forwarded address, then X-Real-IP", () => {
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(req({}))).toBe("unknown");
  });

  it("groups IPv6 addresses by their /64", () => {
    expect(clientIp(req({ "x-forwarded-for": "2001:db8:0:12:aaaa::1" }))).toBe("2001:db8:0:12::/64");
    expect(clientIp(req({ "x-forwarded-for": "2001:DB8:0:12:bbbb:cccc:dddd:2" }))).toBe("2001:db8:0:12::/64");
    expect(clientIp(req({ "x-forwarded-for": "2001:db8::5" }))).toBe("2001:db8:0:0::/64");
    expect(clientIp(req({ "x-forwarded-for": "::ffff:192.0.2.1" }))).toBe("192.0.2.1");
  });
});
