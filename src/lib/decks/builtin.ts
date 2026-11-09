import engineer from "@/data/decks/engineer.json";
import game from "@/data/decks/game.json";
import koibana from "@/data/decks/koibana.json";
import moshimo from "@/data/decks/moshimo.json";
import shotaimen from "@/data/decks/shotaimen.json";
import zatsudan from "@/data/decks/zatsudan.json";
import { isDeckTheme } from "./themes";
import type { Deck } from "./types";

/**
 * Decks shipped with the app. To add or edit one, change the JSON files in
 * src/data/decks and deploy. The file name is the deck id used in URLs.
 */
const RAW = { game, engineer, zatsudan, shotaimen, moshimo, koibana } as const;

export const BUILTIN_DECKS: Deck[] = Object.entries(RAW).map(([id, d]) => {
  if (!isDeckTheme(d.theme)) throw new Error(`Unknown theme "${d.theme}" in deck ${id}`);
  return {
    id,
    source: "builtin",
    title: d.title,
    description: d.description,
    theme: d.theme,
    cards: [...d.cards],
    cardCount: d.cards.length,
  };
});

export function findBuiltinDeck(id: string): Deck | undefined {
  return BUILTIN_DECKS.find((d) => d.id === id);
}
