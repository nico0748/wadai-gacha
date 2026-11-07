/** Card-back colourways. Each deck picks one; the key is stored in the DB. */
export const DECK_THEMES = {
  candy: { name: "キャンディ", from: "#ff5c8a", to: "#a64bff", ink: "#3a0c2a" },
  mint: { name: "ミント", from: "#3fe0b2", to: "#2a8ef4", ink: "#062a2a" },
  lemon: { name: "レモン", from: "#ffd447", to: "#ff7a3d", ink: "#3a2306" },
  sky: { name: "スカイ", from: "#7cc4ff", to: "#5b5bff", ink: "#0b1640" },
  rose: { name: "ローズ", from: "#ff9bb8", to: "#ff4f4f", ink: "#3d0a12" },
  grape: { name: "グレープ", from: "#c49bff", to: "#5a3bdb", ink: "#1d0d45" },
} as const;

export type DeckTheme = keyof typeof DECK_THEMES;
export const DECK_THEME_KEYS = Object.keys(DECK_THEMES) as DeckTheme[];

export function isDeckTheme(value: string): value is DeckTheme {
  return value in DECK_THEMES;
}

export function themeOf(value: string) {
  return DECK_THEMES[isDeckTheme(value) ? value : "candy"];
}
