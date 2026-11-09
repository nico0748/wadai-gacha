import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { AppError } from "@/lib/errors";
import { clientIp, guardRoomAccess, limitBy } from "@/lib/rateLimit";
import { deleteTopic } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string; topicId: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { code, topicId } = await params;
  if (!UUID_RE.test(topicId)) throw new AppError("not_found", "トピックが見つかりません");
  const db = await getDb();
  const ip = clientIp(req);
  await limitBy(db, "topicWrite", ip);
  await guardRoomAccess(db, ip, () => deleteTopic(db, code, bearerToken(req), topicId));
  return json({ ok: true });
});
