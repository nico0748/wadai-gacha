import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminEnabled, verifyAdminSession } from "./auth/admin";
import { getDb } from "./db";
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
        return json(
          { error: { code: err.code, message: err.message } },
          {
            status: err.status,
            headers: err.retryAfter !== undefined ? { "Retry-After": String(err.retryAfter) } : undefined,
          },
        );
      }
      console.error(err);
      return json(
        { error: { code: "internal", message: "サーバーでエラーが発生しました。少し待ってからもう一度お試しください" } },
        { status: 500 },
      );
    }
  };
}

/** Largest JSON body any route accepts. A full 200-card deck is well under this. */
export const MAX_BODY_BYTES = 64 * 1024;

const tooLarge = () => new AppError("payload_too_large", "送信する内容が大きすぎます。減らしてからもう一度お試しください");

/** Reads the body as text, giving up as soon as it passes `max` bytes. */
async function readText(req: Request, max: number): Promise<string> {
  if (Number(req.headers.get("content-length")) > max) throw tooLarge();
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Reads a JSON body. Requiring the JSON content type also blocks simple cross-site form posts. */
export async function readJson(req: Request): Promise<unknown> {
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    throw new AppError("bad_request", "リクエストの形式が正しくありません");
  }
  const text = await readText(req, MAX_BODY_BYTES);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new AppError("bad_request", "リクエストの形式が正しくありません");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("bad_request", "リクエストの形式が正しくありません");
  }
  return body;
}

export async function isAdmin(): Promise<boolean> {
  if (!adminEnabled()) return false;
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  // Visitors without the cookie never touch the database.
  return value ? verifyAdminSession(await getDb(), value) : false;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new AppError("unauthorized", "管理画面にログインしてください");
  }
}
