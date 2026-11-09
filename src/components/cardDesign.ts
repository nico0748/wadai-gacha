import { loadDefaultJapaneseParser } from "budoux";

const parser = loadDefaultJapaneseParser();

/** Brackets a line may not end with. */
const OPENING = /^[「『（(［[｛{〈《【〔“‘]+$/u;
/** Punctuation a line may not start with. */
const CLOSING = /^[」』）)］\]｝}〉》】〕”’、。，．,.!！?？…‥・ー]+/u;

/**
 * BudouX phrases: the only places a Japanese line may break. A lone opening
 * bracket joins the phrase after it, and closing punctuation joins the one
 * before, so a line never ends with 「 or starts with 」.
 */
export function phrases(text: string): string[] {
  const out: string[] = [];
  let carry = "";
  for (const part of parser.parse(text)) {
    let p = carry + part;
    carry = "";
    const closing = out.length > 0 ? p.match(CLOSING)?.[0] : undefined;
    if (closing) {
      out[out.length - 1] += closing;
      p = p.slice(closing.length);
    }
    if (!p) continue;
    if (OPENING.test(p)) carry = p;
    else out.push(p);
  }
  if (carry) out.push(carry);
  return out;
}

/** Rough width of a run of text in ems: half-width letters and digits are narrower. */
export function textEms(text: string): number {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    width += cp < 0x2000 || (cp >= 0xff61 && cp <= 0xffdc) ? 0.6 : 1;
  }
  return width;
}

/** The longest piece the browser may not break, in ems (a phrase, or a word inside one). */
export function longestPhraseEms(text: string): number {
  const pieces = phrases(text).flatMap((p) => p.split(/\s+/));
  return Math.max(1, ...pieces.map(textEms));
}

/** Width a topic line may use, in cqi; the text box on a card is about 84cqi wide. */
const TOPIC_LINE = 82;
/** Below this the topic is hard to read across the table; a longer word may then wrap. */
const TOPIC_MIN = 5.2;

/**
 * Topic size in container units (cqi = 1% of the card's width), so the text
 * scales with the card whether it is a full-screen draw or a small preview.
 * Short topics are big; any topic shrinks until its longest phrase fits on
 * one line, so a word is never split (徹夜してしまっ/た).
 */
export function topicSize(text: string): string {
  const n = [...text].length;
  const tier = n <= 10 ? 15 : n <= 22 ? 12 : n <= 40 ? 9.4 : n <= 60 ? 7.6 : 6.8;
  const size = Math.max(TOPIC_MIN, Math.min(tier, TOPIC_LINE / longestPhraseEms(text)));
  return `${Math.round(size * 100) / 100}cqi`;
}

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

function toHex(c: Rgb): string {
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `a` moved toward `b` by t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as Rgb);
}

/** The colour darkened toward the deck's ink until white text on it reads (4.5:1). */
export function shadeForWhite(color: string, ink: string, min = 4.5): string {
  for (let step = 0; step <= 20; step++) {
    const c = mix(color, ink, step / 20);
    if (contrast(c, "#ffffff") >= min) return c;
  }
  return ink;
}

/** The band across the top of a card front: the deck colours, deep enough for white text. */
export function bandGradient(theme: { from: string; to: string; ink: string }): string {
  return `linear-gradient(110deg, ${shadeForWhite(theme.from, theme.ink)}, ${shadeForWhite(theme.to, theme.ink)})`;
}
