import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { createUserDeck } from "@/lib/decks/service";

export const POST = handle(async (req: Request) => {
  const created = await createUserDeck(await getDb(), await readJson(req));
  return json(created, { status: 201 });
});
