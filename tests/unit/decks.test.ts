import { beforeEach, describe, expect, it } from "vitest";
import { createPgliteDb } from "@/lib/db/pglite";
import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  createOfficialDeck,
  createUserDeck,
  deleteOfficialDeck,
  deleteUserDeck,
  getPublicDeck,
  getUserDeck,
  getUserDeckForEdit,
  listPublicDecks,
  updateOfficialDeck,
  updateUserDeck,
} from "@/lib/decks/service";

let db: Db;
beforeEach(async () => {
  db = await createPgliteDb();
});

const input = { title: "推し活", description: "推しの話", theme: "rose", cards: ["推しは？", "  ", "沼に落ちた瞬間"] };

describe("decks", () => {
  it("lists built-in decks first, then official decks from the admin screen", async () => {
    const id = await createOfficialDeck(db, input);
    const list = await listPublicDecks(db);
    expect(list.slice(0, 3).map((d) => d.id)).toEqual(["game", "engineer", "zatsudan"]);
    expect(list.at(-1)).toMatchObject({ id, source: "official", cardCount: 2 });
    expect((await getPublicDeck(db, "engineer"))?.cards).toHaveLength(30);
    expect((await getPublicDeck(db, id))?.cards).toEqual(["推しは？", "沼に落ちた瞬間"]);
    expect(await getPublicDeck(db, "missing")).toBeNull();
  });

  it("updates and deletes official decks", async () => {
    const id = await createOfficialDeck(db, input);
    await updateOfficialDeck(db, id, { ...input, title: "新しい名前", cards: ["1枚だけ"] });
    expect(await getPublicDeck(db, id)).toMatchObject({ title: "新しい名前", cards: ["1枚だけ"] });
    await deleteOfficialDeck(db, id);
    expect(await getPublicDeck(db, id)).toBeNull();
  });

  it("keeps user decks out of the public list and guards edits with the edit key", async () => {
    const { shareId, editKey } = await createUserDeck(db, input);
    expect((await listPublicDecks(db)).some((d) => d.id === shareId)).toBe(false);
    expect(await getPublicDeck(db, shareId)).toBeNull();
    expect(await getUserDeck(db, shareId)).toMatchObject({ source: "user", cardCount: 2 });

    await expect(updateUserDeck(db, shareId, "wrong", input)).rejects.toMatchObject({ code: "forbidden" });
    await expect(getUserDeckForEdit(db, shareId, null)).rejects.toBeInstanceOf(AppError);

    await updateUserDeck(db, shareId, editKey, { ...input, cards: ["A", "B", "C"] });
    expect((await getUserDeck(db, shareId))?.cards).toEqual(["A", "B", "C"]);

    await deleteUserDeck(db, shareId, editKey);
    expect(await getUserDeck(db, shareId)).toBeNull();
  });

  it("validates deck input", async () => {
    await expect(createUserDeck(db, { ...input, cards: [" "] })).rejects.toMatchObject({ code: "bad_request" });
    await expect(createUserDeck(db, { ...input, theme: "neon" })).rejects.toMatchObject({ code: "bad_request" });
    await expect(createUserDeck(db, { ...input, title: "" })).rejects.toMatchObject({ code: "bad_request" });
  });
});
