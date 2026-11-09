import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { clientIp, limitBy } from "@/lib/rateLimit";
import { addTopic } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const db = await getDb();
  await limitBy(db, "topicWrite", clientIp(req));
  const topic = await addTopic(db, code, bearerToken(req), await readJson(req));
  return json(topic, { status: 201 });
});
