import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { clientIp, guardRoomAccess } from "@/lib/rateLimit";
import { showAuthors } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

/** 答え合わせ: { upTo } shows the authors of the first upTo topics of the list. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  const db = await getDb();
  const body = await readJson(req);
  return json(await guardRoomAccess(db, clientIp(req), () => showAuthors(db, code, bearerToken(req), body)));
});
