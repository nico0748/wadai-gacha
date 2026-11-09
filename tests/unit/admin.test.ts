import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkAdminPassword, createAdminSession, verifyAdminSession } from "@/lib/auth/admin";
import type { Db } from "@/lib/db";
import { createPgliteDb } from "@/lib/db/pglite";

const HOUR = 3600 * 1000;

let db: Db;
beforeEach(async () => {
  db = await createPgliteDb();
  process.env.ADMIN_PASSWORD = "correct horse";
});
afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_SESSION_SECRET;
});

/** Another server process on the same database: same tables, nothing cached. */
const otherProcess = (d: Db): Db => ({ query: d.query, exec: d.exec, transaction: d.transaction });

async function storedSecrets(d: Db) {
  return d.query<{ value: string }>("SELECT value FROM app_secrets WHERE name = 'admin_session'");
}

describe("admin session", () => {
  it("checks the password", () => {
    expect(checkAdminPassword("correct horse")).toBe(true);
    expect(checkAdminPassword("wrong")).toBe(false);
  });

  it("accepts its own sessions and rejects tampered or forged ones", async () => {
    const { value, maxAge } = await createAdminSession(db);
    expect(maxAge).toBe(12 * 3600);
    expect(await verifyAdminSession(db, value)).toBe(true);
    expect(await verifyAdminSession(db, value.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBe(false);
    expect(await verifyAdminSession(db, "v2.9999999999.forged")).toBe(false);
    expect(await verifyAdminSession(db, undefined)).toBe(false);
  });

  it("expires sessions after 12 hours", async () => {
    const now = Date.now();
    const { value } = await createAdminSession(db, now);
    expect(await verifyAdminSession(db, value, now + 11 * HOUR)).toBe(true);
    expect(await verifyAdminSession(db, value, now + 12 * HOUR + 1000)).toBe(false);
  });

  it("rejects week-long v1 sessions from before", async () => {
    const { value } = await createAdminSession(db);
    expect(await verifyAdminSession(db, value.replace(/^v2\./, "v1."))).toBe(false);
  });

  it("creates the signing secret once in the database and reuses it", async () => {
    expect(await storedSecrets(db)).toHaveLength(0);
    const [a, b] = await Promise.all([createAdminSession(db), createAdminSession(otherProcess(db))]);
    const rows = await storedSecrets(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toMatch(/^[\w-]{43}$/);

    // A session signed by one server is accepted by another.
    expect(await verifyAdminSession(otherProcess(db), a.value)).toBe(true);
    expect(await verifyAdminSession(db, b.value)).toBe(true);
    await createAdminSession(otherProcess(db));
    expect(await storedSecrets(db)).toEqual(rows);

    // A different database has its own secret, so knowing the password is not enough.
    expect(await verifyAdminSession(await createPgliteDb(), a.value)).toBe(false);
  });

  it("uses ADMIN_SESSION_SECRET when it is set, without touching the database", async () => {
    process.env.ADMIN_SESSION_SECRET = "explicit secret";
    const { value } = await createAdminSession(db);
    expect(await verifyAdminSession(await createPgliteDb(), value)).toBe(true);
    expect(await storedSecrets(db)).toHaveLength(0);
  });

  it("signs everyone out when the password changes, and is off without a password", async () => {
    const { value } = await createAdminSession(db);
    process.env.ADMIN_PASSWORD = "new password";
    expect(await verifyAdminSession(db, value)).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    expect(await verifyAdminSession(db, (await createAdminSession(db)).value)).toBe(false);
  });
});
