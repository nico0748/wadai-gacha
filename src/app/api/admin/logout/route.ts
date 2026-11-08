import { cookies } from "next/headers";
import { handle, json } from "@/lib/api";
import { ADMIN_COOKIE } from "@/lib/auth/admin";

export const POST = handle(async () => {
  (await cookies()).delete(ADMIN_COOKIE);
  return json({ ok: true });
});
