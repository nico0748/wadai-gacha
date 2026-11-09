import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { revealRoom } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

/** The host's せーの. Idempotent. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  return json(await revealRoom(await getDb(), code, bearerToken(req)));
});
