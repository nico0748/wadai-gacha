import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { clientIp, guardRoomAccess } from "@/lib/rateLimit";
import { startDrawing } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const db = await getDb();
  const result = await guardRoomAccess(db, clientIp(req), () => startDrawing(db, code, bearerToken(req)));
  return json(result ?? { ok: true });
});
