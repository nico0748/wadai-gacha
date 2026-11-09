import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { assertUnderLimit, clientIp, guardRoomLookup, limitBy, RATE_LIMITS } from "@/lib/rateLimit";
import { joinRoom, normalizeCode } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const db = await getDb();
  const ip = clientIp(req);
  await limitBy(db, "roomJoin", ip);
  // Per room, only joins that succeed count, so a stream of bad requests
  // from one guest cannot lock everyone else out of the room.
  const { limit, windowSeconds } = RATE_LIMITS.roomJoinPerRoom;
  const room = normalizeCode(code).slice(0, 32);
  await assertUnderLimit(db, `roomJoinPerRoom:${room}`, limit, windowSeconds);
  const input = await readJson(req);
  // A wrong code answers "not found", so joining is also a way to guess codes.
  const session = await guardRoomLookup(db, ip, () => joinRoom(db, code, input));
  await limitBy(db, "roomJoinPerRoom", room).catch(() => {}); // already joined; only the count matters
  return json(session, { status: 201 });
});
