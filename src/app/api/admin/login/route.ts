import { cookies } from "next/headers";
import { handle, json, readJson } from "@/lib/api";
import { ADMIN_COOKIE, adminEnabled, checkAdminPassword, createAdminSession } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";

export const POST = handle(async (req: Request) => {
  if (!adminEnabled()) throw new AppError("not_found", "管理画面は無効になっています");
  const body = (await readJson(req)) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!checkAdminPassword(password)) throw new AppError("unauthorized", "パスワードが違います");
  const session = createAdminSession();
  (await cookies()).set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });
  return json({ ok: true });
});
