import { getDb } from "@/lib/db";
import { handle, json, readJson, requireAdmin } from "@/lib/api";
import { deleteOfficialDeck, updateOfficialDeck } from "@/lib/decks/service";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  await updateOfficialDeck(await getDb(), id, await readJson(req));
  return json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  await deleteOfficialDeck(await getDb(), id);
  return json({ ok: true });
});
