import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { clientIp, guardRoomAccess } from "@/lib/rateLimit";
import { revealRoom } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

/** The host's せーの. Idempotent. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const db = await getDb();
  return json(await guardRoomAccess(db, clientIp(req), () => revealRoom(db, code, bearerToken(req))));
});
