import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { clientIp, guardRoomLookup, limitBy } from "@/lib/rateLimit";
import { getRoomPublicInfo } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const db = await getDb();
  const ip = clientIp(req);
  await limitBy(db, "roomInfo", ip);
  return json(await guardRoomLookup(db, ip, () => getRoomPublicInfo(db, code)));
});
