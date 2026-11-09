import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { getRoomView, pollRoomView } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  // ?v=N: the version this device already has. Unchanged rooms answer with { unchanged: true }.
  const v = new URL(req.url).searchParams.get("v");
  const known = v !== null && /^\d{1,9}$/.test(v) ? Number(v) : null;
  const db = await getDb();
  const token = bearerToken(req);
  return json(known === null ? await getRoomView(db, code, token) : await pollRoomView(db, code, token, known));
});
