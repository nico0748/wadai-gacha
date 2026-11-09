/**
 * Card-back colourways. Each deck picks one; the key is stored in the DB.
 *
 * よる is the logo's lavender and navy. The others are dusty, each mixed
 * about 30% toward the logo navy (#495a79), so they sit with the logo on the
 * night table instead of reading as candy. `ink` is the deep tone for text on
 * paper and for the card front's band, which is darkened toward it until
 * white text reads.
 */
export const DECK_THEMES = {
  yoru: { name: "よる", from: "#8388af", to: "#495a79", ink: "#232c44" },
  candy: { name: "キャンディ", from: "#c85b85", to: "#8a50d7", ink: "#3a0c2a" },
  mint: { name: "ミント", from: "#42b8a1", to: "#337ecf", ink: "#062a2a" },
  lemon: { name: "レモン", from: "#c8af56", to: "#c8704f", ink: "#3a2306" },
  sky: { name: "スカイ", from: "#6da4d7", to: "#565bd7", ink: "#0b1640" },
  rose: { name: "ローズ", from: "#c888a5", to: "#c8525c", ink: "#3d0a12" },
  grape: { name: "グレープ", from: "#9f88d7", to: "#5544be", ink: "#1d0d45" },
} as const;

export type DeckTheme = keyof typeof DECK_THEMES;
export const DECK_THEME_KEYS = Object.keys(DECK_THEMES) as DeckTheme[];

export function isDeckTheme(value: string): value is DeckTheme {
  return Object.hasOwn(DECK_THEMES, value);
}

export function themeOf(value: string) {
  return DECK_THEMES[isDeckTheme(value) ? value : "yoru"];
}
