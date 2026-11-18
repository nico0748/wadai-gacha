/**
 * Card-back colourways. Each deck picks one; the key is stored in the DB, so
 * the keys stay as they were when the colours changed.
 *
 * Deep, quiet jewel tones that sit on the ink table: the brass frame and
 * monogram read on every one of them, and so does the ivory deck name.
 * `from` is the lighter corner of the card back, `to` the deeper one.
 */
export const DECK_THEMES = {
  yoru: { name: "夜", from: "#343c5e", to: "#222944" },
  candy: { name: "紅", from: "#6a2f3e", to: "#45202c" },
  mint: { name: "深緑", from: "#2f4d44", to: "#1f342d" },
  lemon: { name: "山吹", from: "#665023", to: "#463619" },
  sky: { name: "灰青", from: "#3e5066", to: "#2a3647" },
  rose: { name: "煉瓦", from: "#653c33", to: "#472a24" },
  grape: { name: "葡萄", from: "#4e3a5c", to: "#332640" },
} as const;

export type DeckTheme = keyof typeof DECK_THEMES;
export const DECK_THEME_KEYS = Object.keys(DECK_THEMES) as DeckTheme[];

export function isDeckTheme(value: string): value is DeckTheme {
  return Object.hasOwn(DECK_THEMES, value);
}

export function themeOf(value: string) {
  return DECK_THEMES[isDeckTheme(value) ? value : "yoru"];
}
