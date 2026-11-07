import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db";
import { AppError } from "../errors";
import { LIMITS } from "../limits";
import { hashToken, randomCode, randomToken, safeEqual } from "../auth/tokens";
import { parseOrThrow } from "../validation";
import { BUILTIN_DECKS, findBuiltinDeck } from "./builtin";
import { DECK_THEME_KEYS, isDeckTheme, type DeckTheme } from "./themes";
import type { Deck, DeckInput, DeckSummary } from "./types";

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export const deckInputSchema = z.object({
  title: z
    .string({ error: "デッキ名を入力してください" })
    .transform(oneLine)
    .pipe(
      z
        .string()
        .min(1, "デッキ名を入力してください")
        .max(LIMITS.deckTitleMax, `デッキ名は${LIMITS.deckTitleMax}文字以内にしてください`),
    ),
  description: z
    .string()
    .optional()
    .transform((s) => oneLine(s ?? ""))
    .pipe(z.string().max(LIMITS.deckDescriptionMax, `説明は${LIMITS.deckDescriptionMax}文字以内にしてください`)),
  theme: z.enum(DECK_THEME_KEYS as [DeckTheme, ...DeckTheme[]], { error: "カードの色を選んでください" }),
  cards: z
    .array(z.string(), { error: "カードを1枚以上入力してください" })
    .transform((cards) => cards.map(oneLine).filter((c) => c.length > 0))
    .pipe(
      z
        .array(z.string().max(LIMITS.cardTextMax, `カードは1枚${LIMITS.cardTextMax}文字以内にしてください`))
        .min(LIMITS.deckCardsMin, "カードを1枚以上入力してください")
        .max(LIMITS.deckCardsMax, `カードは${LIMITS.deckCardsMax}枚までです`),
    ),
});

interface DeckRow {
  id: string;
  kind: "official" | "user";
  share_id: string | null;
  edit_key_hash: string | null;
  title: string;
  description: string;
  theme: string;
  card_count?: number;
  [key: string]: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHARE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function toSummary(row: DeckRow): DeckSummary {
  return {
    id: row.kind === "user" ? (row.share_id as string) : row.id,
    source: row.kind,
    title: row.title,
    description: row.description,
    theme: isDeckTheme(row.theme) ? row.theme : "candy",
    cardCount: row.card_count ?? 0,
  };
}

async function loadCards(db: Db, deckId: string): Promise<string[]> {
  const rows = await db.query<{ text: string }>(
    "SELECT text FROM deck_cards WHERE deck_id = $1 ORDER BY position",
    [deckId],
  );
  return rows.map((r) => r.text);
}

async function writeCards(db: Db, deckId: string, cards: string[]) {
  await db.query("DELETE FROM deck_cards WHERE deck_id = $1", [deckId]);
  if (cards.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  cards.forEach((text, i) => {
    const base = params.length;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
    params.push(randomUUID(), deckId, i, text);
  });
  await db.query(`INSERT INTO deck_cards (id, deck_id, position, text) VALUES ${values.join(", ")}`, params);
}

const SUMMARY_SQL = `
  SELECT d.*, (SELECT count(*)::int FROM deck_cards c WHERE c.deck_id = d.id) AS card_count
  FROM decks d`;

// ---------------------------------------------------------------------------
// Public listing / playing

/** Decks shown in the deck list: built-in JSON decks first, then admin decks. */
export async function listPublicDecks(db: Db): Promise<DeckSummary[]> {
  const rows = await db.query<DeckRow>(`${SUMMARY_SQL} WHERE d.kind = 'official' ORDER BY d.created_at`);
  const builtin: DeckSummary[] = BUILTIN_DECKS.map((d) => ({
    id: d.id,
    source: d.source,
    title: d.title,
    description: d.description,
    theme: d.theme,
    cardCount: d.cardCount,
  }));
  return [...builtin, ...rows.map(toSummary)];
}

/** A deck from the public list, by its id (JSON file name or DB uuid). */
export async function getPublicDeck(db: Db, id: string): Promise<Deck | null> {
  const builtin = findBuiltinDeck(id);
  if (builtin) return builtin;
  if (!UUID_RE.test(id)) return null;
  const rows = await db.query<DeckRow>(`${SUMMARY_SQL} WHERE d.id = $1 AND d.kind = 'official'`, [id]);
  if (!rows[0]) return null;
  return { ...toSummary(rows[0]), cards: await loadCards(db, rows[0].id) };
}

// ---------------------------------------------------------------------------
// User decks: no login. A share id to play, a secret edit key to change it.

export async function getUserDeck(db: Db, shareId: string): Promise<Deck | null> {
  const rows = await db.query<DeckRow>(`${SUMMARY_SQL} WHERE d.share_id = $1 AND d.kind = 'user'`, [shareId]);
  if (!rows[0]) return null;
  return { ...toSummary(rows[0]), cards: await loadCards(db, rows[0].id) };
}

export async function createUserDeck(db: Db, input: DeckInput | unknown) {
  const data = parseOrThrow(deckInputSchema, input);
  const editKey = randomToken();
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomUUID();
    const shareId = randomCode(10, SHARE_ALPHABET);
    try {
      await db.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO decks (id, kind, share_id, edit_key_hash, title, description, theme)
           VALUES ($1, 'user', $2, $3, $4, $5, $6)`,
          [id, shareId, hashToken(editKey), data.title, data.description, data.theme],
        );
        await writeCards(tx, id, data.cards);
      });
      return { shareId, editKey };
    } catch (err) {
      if ((err as { code?: string }).code === "23505" && attempt < 4) continue;
      throw err;
    }
  }
  throw new AppError("conflict", "デッキを作成できませんでした。もう一度お試しください");
}

async function loadEditableUserDeck(db: Db, shareId: string, editKey: string | null) {
  const rows = await db.query<DeckRow>(
    "SELECT * FROM decks WHERE share_id = $1 AND kind = 'user' FOR UPDATE",
    [shareId],
  );
  const row = rows[0];
  if (!row) throw new AppError("not_found", "デッキが見つかりません");
  if (!editKey || !row.edit_key_hash || !safeEqual(hashToken(editKey), row.edit_key_hash)) {
    throw new AppError("forbidden", "編集用URLが正しくありません");
  }
  return row;
}

export async function getUserDeckForEdit(db: Db, shareId: string, editKey: string | null): Promise<Deck> {
  return db.transaction(async (tx) => {
    const row = await loadEditableUserDeck(tx, shareId, editKey);
    return { ...toSummary(row), cards: await loadCards(tx, row.id) };
  });
}

export async function updateUserDeck(db: Db, shareId: string, editKey: string | null, input: unknown) {
  const data = parseOrThrow(deckInputSchema, input);
  await db.transaction(async (tx) => {
    const row = await loadEditableUserDeck(tx, shareId, editKey);
    await tx.query(
      "UPDATE decks SET title = $2, description = $3, theme = $4, updated_at = now() WHERE id = $1",
      [row.id, data.title, data.description, data.theme],
    );
    await writeCards(tx, row.id, data.cards);
  });
}

export async function deleteUserDeck(db: Db, shareId: string, editKey: string | null) {
  await db.transaction(async (tx) => {
    const row = await loadEditableUserDeck(tx, shareId, editKey);
    await tx.query("DELETE FROM decks WHERE id = $1", [row.id]);
  });
}

// ---------------------------------------------------------------------------
// Official decks, managed from the admin screen

export async function listOfficialDecks(db: Db): Promise<DeckSummary[]> {
  const rows = await db.query<DeckRow>(`${SUMMARY_SQL} WHERE d.kind = 'official' ORDER BY d.created_at`);
  return rows.map(toSummary);
}

export async function getOfficialDeck(db: Db, id: string): Promise<Deck | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await db.query<DeckRow>(`${SUMMARY_SQL} WHERE d.id = $1 AND d.kind = 'official'`, [id]);
  if (!rows[0]) return null;
  return { ...toSummary(rows[0]), cards: await loadCards(db, id) };
}

export async function createOfficialDeck(db: Db, input: unknown): Promise<string> {
  const data = parseOrThrow(deckInputSchema, input);
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO decks (id, kind, title, description, theme) VALUES ($1, 'official', $2, $3, $4)`,
      [id, data.title, data.description, data.theme],
    );
    await writeCards(tx, id, data.cards);
  });
  return id;
}

export async function updateOfficialDeck(db: Db, id: string, input: unknown) {
  const data = parseOrThrow(deckInputSchema, input);
  if (!UUID_RE.test(id)) throw new AppError("not_found", "デッキが見つかりません");
  await db.transaction(async (tx) => {
    const rows = await tx.query(
      `UPDATE decks SET title = $2, description = $3, theme = $4, updated_at = now()
       WHERE id = $1 AND kind = 'official' RETURNING id`,
      [id, data.title, data.description, data.theme],
    );
    if (rows.length === 0) throw new AppError("not_found", "デッキが見つかりません");
    await writeCards(tx, id, data.cards);
  });
}

export async function deleteOfficialDeck(db: Db, id: string) {
  if (!UUID_RE.test(id)) throw new AppError("not_found", "デッキが見つかりません");
  const rows = await db.query("DELETE FROM decks WHERE id = $1 AND kind = 'official' RETURNING id", [id]);
  if (rows.length === 0) throw new AppError("not_found", "デッキが見つかりません");
}
