import type { Db } from "./db";
import { AppError } from "./errors";

/**
 * Per-IP limits stay generous because a whole bar often shares one Wi-Fi or
 * carrier address; only the endpoints that let someone guess (passwords,
 * room codes) are tight.
 */
export const RATE_LIMITS = {
  adminLogin: { limit: 10, windowSeconds: 15 * 60 },
  roomCreate: { limit: 30, windowSeconds: 10 * 60 },
  roomJoin: { limit: 300, windowSeconds: 10 * 60 },
  roomJoinPerRoom: { limit: 100, windowSeconds: 10 * 60 },
  // The join screen of an ended room polls this every 2.5s while the list is
  // held back, so leave room for several phones behind one address.
  roomInfo: { limit: 120, windowSeconds: 60 },
  /**
   * Lookups of a room that does not exist: code guessing. Codes are 6 of 31
   * characters (about 9×10^8), so even this leaves guessing hopeless, while
   * typos and stale QR codes from a whole bar's shared address fit easily.
   */
  roomMiss: { limit: 60, windowSeconds: 10 * 60 },
  topicWrite: { limit: 120, windowSeconds: 60 },
  deckCreate: { limit: 30, windowSeconds: 60 * 60 },
  deckEdit: { limit: 120, windowSeconds: 60 * 60 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export type RateLimitName = keyof typeof RATE_LIMITS;

const MESSAGE = "アクセスが集中しています。少し待ってからもう一度お試しください";
const KEEP_MS = 24 * 60 * 60 * 1000;
const PURGE_CHANCE = 0.01;

function windowOf(windowSeconds: number, now: number) {
  const size = windowSeconds * 1000;
  const start = Math.floor(now / size) * size;
  return { start, retryAfter: Math.max(1, Math.ceil((start + size - now) / 1000)) };
}

/**
 * Counts one hit for `key` in the current fixed window and throws
 * `rate_limited` once the count goes over `limit`. One round trip.
 */
export async function rateLimit(
  db: Db,
  key: string,
  limit: number,
  windowSeconds: number,
  now = Date.now(),
): Promise<void> {
  const { start, retryAfter } = windowOf(windowSeconds, now);
  const [row] = await db.query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, new Date(start).toISOString()],
  );
  if (Math.random() < PURGE_CHANCE) await purgeRateLimits(db, now);
  if (Number(row?.count ?? 0) > limit) throw new AppError("rate_limited", MESSAGE, { retryAfter });
}

/** Throws `rate_limited` if `key` has already used up `limit`, without counting a hit. */
export async function assertUnderLimit(
  db: Db,
  key: string,
  limit: number,
  windowSeconds: number,
  now = Date.now(),
): Promise<void> {
  const { start, retryAfter } = windowOf(windowSeconds, now);
  const [row] = await db.query<{ count: number }>(
    "SELECT count FROM rate_limits WHERE key = $1 AND window_start = $2",
    [key, new Date(start).toISOString()],
  );
  if (Number(row?.count ?? 0) >= limit) throw new AppError("rate_limited", MESSAGE, { retryAfter });
}

/** Deletes windows older than a day. Called now and then by rateLimit. */
export async function purgeRateLimits(db: Db, now = Date.now()): Promise<void> {
  await db
    .query("DELETE FROM rate_limits WHERE window_start < $1", [new Date(now - KEEP_MS).toISOString()])
    .catch((err) => console.error("Failed to purge rate limits", err));
}

/** Counts a hit against one of the named limits for `subject` (an IP, a room code…). */
export function limitBy(db: Db, name: RateLimitName, subject: string): Promise<void> {
  const { limit, windowSeconds } = RATE_LIMITS[name];
  return rateLimit(db, `${name}:${subject}`, limit, windowSeconds);
}

/**
 * Wraps a room lookup so that guessing codes is slow: once an IP has asked
 * for too many rooms that do not exist, every lookup from it is refused for
 * the rest of the window, so hits and misses look the same.
 */
export async function guardRoomLookup<T>(db: Db, ip: string, lookup: () => Promise<T>): Promise<T> {
  const { limit, windowSeconds } = RATE_LIMITS.roomMiss;
  const key = `roomMiss:${ip}`;
  await assertUnderLimit(db, key, limit, windowSeconds);
  try {
    return await lookup();
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") await rateLimit(db, key, limit, windowSeconds);
    throw err;
  }
}

/**
 * For room routes that need a token. A request with a valid token costs no
 * extra query. A missing room counts as a miss, and once an address is over
 * the miss limit, missing rooms and wrong tokens both answer 429, so the
 * 404 / 401 difference stops telling a guesser which codes exist.
 */
export async function guardRoomAccess<T>(db: Db, ip: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (err instanceof AppError && (err.code === "not_found" || err.code === "unauthorized")) {
      const { limit, windowSeconds } = RATE_LIMITS.roomMiss;
      const key = `roomMiss:${ip}`;
      if (err.code === "not_found") await rateLimit(db, key, limit, windowSeconds);
      else await assertUnderLimit(db, key, limit, windowSeconds);
    }
    throw err;
  }
}

/**
 * The address to rate limit by. Proxies append the address they saw to
 * X-Forwarded-For, so only the last TRUSTED_PROXY_HOPS entries (default 1)
 * were written by a proxy; anything before them came from the client and can
 * be forged. Vercel replaces the header with the real address, so the default
 * fits it, a single nginx, ALB or Cloudflare in front, and `next start`
 * behind such a proxy. Without any proxy, a client can pick its own address:
 * the README says to put one in front when self-hosting. X-Real-IP is only a
 * fallback. IPv6 addresses are grouped by their /64, since one phone or home
 * usually gets a whole /64.
 */
export function clientIp(req: Request, hops = trustedProxyHops()): string {
  const entries = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const forwarded = entries.length ? entries[Math.max(0, entries.length - hops)] : undefined;
  const ip = (forwarded || req.headers.get("x-real-ip")?.trim() || "unknown").slice(0, 64);
  return ip.includes(":") ? ipv6Prefix(ip) : ip;
}

function trustedProxyHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 1;
}

function ipv6Prefix(raw: string): string {
  const ip = raw.replace(/^\[|\](:\d+)?$/g, "").replace(/%.*$/, "").toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return mapped[1];
  const halves = ip.split("::");
  if (halves.length > 2) return ip;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const groups =
    halves.length === 2 ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right] : left;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}
