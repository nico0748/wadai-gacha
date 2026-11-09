import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { createUserDeck } from "@/lib/decks/service";
import { clientIp, limitBy } from "@/lib/rateLimit";

export const POST = handle(async (req: Request) => {
  const db = await getDb();
  await limitBy(db, "deckCreate", clientIp(req));
  const created = await createUserDeck(db, await readJson(req));
  return json(created, { status: 201 });
});
