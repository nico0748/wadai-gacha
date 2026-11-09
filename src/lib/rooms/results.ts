import { LIMITS } from "../limits";
import type { RevealItem } from "./types";

/**
 * A room's topics handed to /decks/new through sessionStorage. Nothing is
 * saved until the person taps 作る there. Never carries nicknames.
 */
export const DECK_DRAFT_KEY = "mekutalk:deck-draft";

export interface DeckDraft {
  title: string;
  cards: string[];
  /** Topics left out to stay within the deck size limit. */
  omitted?: number;
}

/** Drawn topics first (in draw order), then the rest, at most the deck limit. */
export function makeDeckDraft(items: RevealItem[], today: Date): DeckDraft {
  const drawn = items.filter((i) => i.order !== null).sort((a, b) => a.order! - b.order!);
  const undrawn = items.filter((i) => i.order === null);
  const all = [...drawn, ...undrawn].map((i) => i.text);
  const cards = all.slice(0, LIMITS.deckCardsMax);
  return {
    title: `${today.getMonth() + 1}/${today.getDate()}のみんなの話題`,
    cards,
    ...(all.length > cards.length ? { omitted: all.length - cards.length } : {}),
  };
}

export function parseDeckDraft(raw: string | null): DeckDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<DeckDraft>;
    if (typeof d.title !== "string" || !Array.isArray(d.cards)) return null;
    const texts = d.cards.filter((c): c is string => typeof c === "string");
    const cards = texts.slice(0, LIMITS.deckCardsMax);
    const omitted = (typeof d.omitted === "number" ? d.omitted : 0) + texts.length - cards.length;
    return { title: d.title.slice(0, LIMITS.deckTitleMax), cards, ...(omitted > 0 ? { omitted } : {}) };
  } catch {
    return null;
  }
}

/** The list as plain text for sharing: drawn topics numbered, then the rest, then the site. */
export function revealShareText(items: RevealItem[], siteUrl: string): string {
  const drawn = items.filter((i) => i.order !== null).sort((a, b) => a.order! - b.order!);
  const undrawn = items.filter((i) => i.order === null);
  const lines = ["めくトークで集まった話題"];
  if (drawn.length > 0) {
    lines.push("", "めくった話題");
    drawn.forEach((i, n) => lines.push(`${n + 1}. ${i.text}`));
  }
  if (undrawn.length > 0) {
    lines.push("", "出番がなかった話題");
    undrawn.forEach((i) => lines.push(`・${i.text}`));
  }
  lines.push("", siteUrl);
  return lines.join("\n");
}
