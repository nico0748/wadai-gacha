import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { deleteUserDeck, getUserDeckForEdit, updateUserDeck } from "@/lib/decks/service";

type Ctx = { params: Promise<{ shareId: string }> };

const editKey = (req: Request) => req.headers.get("x-edit-key");

/** Returns the deck for editing; requires the edit key. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { shareId } = await params;
  return json(await getUserDeckForEdit(await getDb(), shareId, editKey(req)));
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { shareId } = await params;
  await updateUserDeck(await getDb(), shareId, editKey(req), await readJson(req));
  return json({ ok: true });
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { shareId } = await params;
  await deleteUserDeck(await getDb(), shareId, editKey(req));
  return json({ ok: true });
});
