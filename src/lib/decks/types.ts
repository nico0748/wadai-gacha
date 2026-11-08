import type { DeckTheme } from "./themes";

export type DeckSource = "builtin" | "official" | "user";

export interface DeckSummary {
  id: string;
  source: DeckSource;
  title: string;
  description: string;
  theme: DeckTheme;
  cardCount: number;
}

export interface Deck extends DeckSummary {
  cards: string[];
}

export interface DeckInput {
  title: string;
  description?: string;
  theme: DeckTheme;
  cards: string[];
}
