import { createHash, createHmac } from "node:crypto";
import { safeEqual } from "./tokens";

export const ADMIN_COOKIE = "wg_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

/** The admin screen is turned off unless ADMIN_PASSWORD is set. */
export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function secret(): string {
  const explicit = process.env.ADMIN_SESSION_SECRET;
  if (explicit) return explicit;
  // Derived from the password, so changing the password signs everyone out.
  return createHash("sha256").update(`wadai-gacha-admin:${process.env.ADMIN_PASSWORD ?? ""}`).digest("hex");
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

export function createAdminSession(now = Date.now()): { value: string; maxAge: number } {
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const payload = `v1.${exp}`;
  return { value: `${payload}.${sign(payload)}`, maxAge: SESSION_SECONDS };
}

export function verifyAdminSession(value: string | undefined, now = Date.now()): boolean {
  if (!adminEnabled() || !value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const [v, exp, mac] = parts;
  if (!safeEqual(mac, sign(`${v}.${exp}`))) return false;
  const expNum = Number(exp);
  return Number.isFinite(expNum) && expNum * 1000 > now;
}
