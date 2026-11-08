import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { getRoomPublicInfo } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { code } = await params;
  return json(await getRoomPublicInfo(await getDb(), code));
});
