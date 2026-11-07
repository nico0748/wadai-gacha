import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { getRoomView } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  return json(await getRoomView(await getDb(), code, bearerToken(req)));
});
