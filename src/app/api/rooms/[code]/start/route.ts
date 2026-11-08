import { getDb } from "@/lib/db";
import { handle, json } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { startDrawing } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const result = await startDrawing(await getDb(), code, bearerToken(req));
  return json(result ?? { ok: true });
});
