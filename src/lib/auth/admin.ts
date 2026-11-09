import { createHmac, randomBytes } from "node:crypto";
import type { Db } from "../db";
import { safeEqual } from "./tokens";

export const ADMIN_COOKIE = "wg_admin";
const SESSION_SECONDS = 60 * 60 * 12;
// v1 sessions lasted a week; bumping the version signs them all out.
const VERSION = "v2";
const SECRET_NAME = "admin_session";

/** The admin screen is turned off unless ADMIN_PASSWORD is set. */
export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

// One read per database per process; a failed read is retried next time.
const storedSecrets = new WeakMap<Db, Promise<string>>();

/** A random secret kept in app_secrets, created by whichever server needs it first. */
function storedSecret(db: Db): Promise<string> {
  let secret = storedSecrets.get(db);
  if (!secret) {
    secret = (async () => {
      await db.query("INSERT INTO app_secrets (name, value) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING", [
        SECRET_NAME,
        randomBytes(32).toString("base64url"),
      ]);
      const [row] = await db.query<{ value: string }>("SELECT value FROM app_secrets WHERE name = $1", [SECRET_NAME]);
      if (!row) throw new Error("Admin session secret is missing");
      return row.value;
    })();
    secret.catch(() => storedSecrets.delete(db));
    storedSecrets.set(db, secret);
  }
  return secret;
}

async function signingKey(db: Db): Promise<string> {
  const explicit = process.env.ADMIN_SESSION_SECRET;
  if (explicit) return explicit;
  // The password is mixed in so that changing it still signs everyone out,
  // but knowing it is not enough to forge a session.
  return createHmac("sha256", await storedSecret(db))
    .update(`wadai-gacha-admin:${process.env.ADMIN_PASSWORD ?? ""}`)
    .digest("hex");
}

function sign(key: string, value: string): string {
  return createHmac("sha256", key).update(value).digest("base64url");
}

export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

export async function createAdminSession(db: Db, now = Date.now()): Promise<{ value: string; maxAge: number }> {
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const payload = `${VERSION}.${exp}`;
  return { value: `${payload}.${sign(await signingKey(db), payload)}`, maxAge: SESSION_SECONDS };
}

export async function verifyAdminSession(db: Db, value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!adminEnabled() || !value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== VERSION) return false;
  const [v, exp, mac] = parts;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum * 1000 <= now) return false;
  return safeEqual(mac, sign(await signingKey(db), `${v}.${exp}`));
}
