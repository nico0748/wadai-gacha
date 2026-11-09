import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { clientIp, guardRoomLookup, limitBy } from "@/lib/rateLimit";
import { joinRoom, normalizeCode } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const db = await getDb();
  const ip = clientIp(req);
  await limitBy(db, "roomJoin", ip);
  await limitBy(db, "roomJoinPerRoom", normalizeCode(code).slice(0, 32));
  const input = await readJson(req);
  // A wrong code answers "not found", so joining is also a way to guess codes.
  const session = await guardRoomLookup(db, ip, () => joinRoom(db, code, input));
  return json(session, { status: 201 });
});
