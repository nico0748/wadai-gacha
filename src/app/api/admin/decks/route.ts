import { getDb } from "@/lib/db";
import { handle, json, readJson, requireAdmin } from "@/lib/api";
import { createOfficialDeck } from "@/lib/decks/service";

export const POST = handle(async (req: Request) => {
  await requireAdmin();
  const id = await createOfficialDeck(await getDb(), await readJson(req));
  return json({ id }, { status: 201 });
});
