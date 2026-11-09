import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { deleteUserDeck, getUserDeckForEdit, updateUserDeck } from "@/lib/decks/service";
import { clientIp, limitBy } from "@/lib/rateLimit";

type Ctx = { params: Promise<{ shareId: string }> };

const editKey = (req: Request) => req.headers.get("x-edit-key");

/** Returns the deck for editing; requires the edit key. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { shareId } = await params;
  return json(await getUserDeckForEdit(await getDb(), shareId, editKey(req)));
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { shareId } = await params;
  const db = await getDb();
  await limitBy(db, "deckEdit", clientIp(req));
  await updateUserDeck(db, shareId, editKey(req), await readJson(req));
  return json({ ok: true });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { shareId } = await params;
  const db = await getDb();
  await limitBy(db, "deckEdit", clientIp(req));
  await deleteUserDeck(db, shareId, editKey(req));
  return json({ ok: true });
});
