import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { addTopic } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const topic = await addTopic(await getDb(), code, bearerToken(req), await readJson(req));
  return json(topic, { status: 201 });
});
