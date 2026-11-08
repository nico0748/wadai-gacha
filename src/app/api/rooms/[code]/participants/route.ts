import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { joinRoom } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const session = await joinRoom(await getDb(), code, await readJson(req));
  return json(session, { status: 201 });
});
