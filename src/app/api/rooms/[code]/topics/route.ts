import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { clientIp, guardRoomAccess, limitBy } from "@/lib/rateLimit";
import { addTopic } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const db = await getDb();
  const ip = clientIp(req);
  await limitBy(db, "topicWrite", ip);
  const body = await readJson(req);
  const topic = await guardRoomAccess(db, ip, () => addTopic(db, code, bearerToken(req), body));
  return json(topic, { status: 201 });
});
