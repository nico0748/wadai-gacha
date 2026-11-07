import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminSession } from "./auth/admin";
import { AppError } from "./errors";

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...init?.headers },
  });
}

/** Wraps a route handler so AppErrors become JSON responses with their message. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof AppError) {
        return json({ error: { code: err.code, message: err.message } }, { status: err.status });
      }
      console.error(err);
      return json(
        { error: { code: "internal", message: "サーバーでエラーが発生しました。少し待ってからもう一度お試しください" } },
        { status: 500 },
      );
    }
  };
}

/** Reads a JSON body. Requiring the JSON content type also blocks simple cross-site form posts. */
export async function readJson(req: Request): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new AppError("bad_request", "リクエストの形式が正しくありません");
  }
  try {
    return await req.json();
  } catch {
    throw new AppError("bad_request", "リクエストの形式が正しくありません");
  }
}

export async function requireAdmin(): Promise<void> {
  const store = await cookies();
  if (!verifyAdminSession(store.get(ADMIN_COOKIE)?.value)) {
    throw new AppError("unauthorized", "管理画面にログインしてください");
  }
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSession(store.get(ADMIN_COOKIE)?.value);
}
