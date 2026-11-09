import { readJson } from "../api";

/**
 * A JSON body for requests where it is optional (older clients send none).
 * These routes need a bearer token, which a cross-site form cannot send, so
 * a body of another type is simply ignored.
 */
export async function readOptionalJson(req: Request): Promise<unknown> {
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  return type === "application/json" ? readJson(req) : {};
}
