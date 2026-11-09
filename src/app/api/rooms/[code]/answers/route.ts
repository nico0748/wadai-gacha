import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { bearerToken } from "@/lib/auth/tokens";
import { showAuthors } from "@/lib/rooms/service";

type Ctx = { params: Promise<{ code: string }> };

/** 答え合わせ: { upTo } shows the authors of the first upTo topics of the list. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { code } = await params;
  return json(await showAuthors(await getDb(), code, bearerToken(req), await readJson(req)));
});
