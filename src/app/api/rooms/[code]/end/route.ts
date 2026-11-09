import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { readOptionalJson } from "@/lib/rooms/http";
import { endRoom } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const result = await endRoom(await getDb(), code, bearerToken(req), await readOptionalJson(req));
  return json(result);
});
