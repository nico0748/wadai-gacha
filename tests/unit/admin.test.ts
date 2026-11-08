import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkAdminPassword, createAdminSession, verifyAdminSession } from "@/lib/auth/admin";

describe("admin session", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = "correct horse";
  });
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  it("checks the password", () => {
    expect(checkAdminPassword("correct horse")).toBe(true);
    expect(checkAdminPassword("wrong")).toBe(false);
  });

  it("accepts its own sessions and rejects tampered or expired ones", () => {
    const { value } = createAdminSession();
    expect(verifyAdminSession(value)).toBe(true);
    expect(verifyAdminSession(value.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBe(false);
    expect(verifyAdminSession(value, Date.now() + 8 * 24 * 3600 * 1000)).toBe(false);
    expect(verifyAdminSession("v1.9999999999.forged")).toBe(false);
  });

  it("signs everyone out when the password changes, and is off without a password", () => {
    const { value } = createAdminSession();
    process.env.ADMIN_PASSWORD = "new password";
    expect(verifyAdminSession(value)).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    expect(verifyAdminSession(createAdminSession().value)).toBe(false);
  });
});
