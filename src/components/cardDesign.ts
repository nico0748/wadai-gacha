import { jaModel, loadDefaultJapaneseParser } from "budoux";

const parser = loadDefaultJapaneseParser();

/** Brackets a line may not end with. */
const OPENING = /^[「『（(［[｛{〈《【〔“‘]+$/u;
/** Punctuation, small kana and long-vowel marks: a line may not start with them. */
const CLOSING = /^[」』）)］\]｝}〉》】〕”’、。，．,.!！?？…‥・ー〜～ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ]+/u;

/**
 * BudouX phrases: the only places a Japanese line may break. A lone opening
 * bracket joins the phrase after it, and closing punctuation joins the one
 * before, so a line never ends with 「 or starts with 」 (or ぇ, ー).
 */
export function phrases(text: string): string[] {
  const out: string[] = [];
  let carry = "";
  for (const part of parser.parse(text)) {
    let p = carry + part;
    carry = "";
    const closing = out.length > 0 ? p.match(CLOSING)?.[0] : undefined;
    if (closing) {
      // A particle left behind goes along too: 「へぇ〜」と, not 「へぇ〜」／と.
      const rest = p.slice(closing.length);
      const take = /^[ぁ-ゖ]{1,2}$/u.test(rest) ? p : closing;
      out[out.length - 1] += take;
      p = p.slice(take.length);
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

/** Width of the longest run the browser may not break inside a piece (it still wraps at spaces). */
function pieceEms(piece: string): number {
  return Math.max(0, ...piece.split(/\s+/).map(textEms));
}

/* ---------------------------------------------------------------------------
 * Card topics
 *
 * A topic on a card is sized so that its longest unbreakable piece fits one
 * line. BudouX sometimes keeps a long stretch together (恋愛映画・ドラマ・マンガは？,
 * 一度だけやったことがある、), which would shrink the whole topic to fit it, so
 * such a phrase is split again at its most natural inner break. And a topic
 * should not end on a stranded line (子どもの頃の／夢), so a short last piece
 * joins the one before it.
 * ------------------------------------------------------------------------- */

/** Width a topic line may use, in cqi; the text box on a card is about 84cqi wide. */
const TOPIC_LINE = 82;
/** Below this the topic is hard to read across the table; a longer word may then wrap. */
const TOPIC_MIN = 8;
/** The widest piece that still fits one line at TOPIC_MIN, in ems. */
const MAX_PIECE = TOPIC_LINE / TOPIC_MIN;
/**
 * A piece wider than this (ems) is split again where it can be, so one phrase
 * does not shrink the topic far. Up to here it still gets 10cqi or more, and
 * splitting shorter phrases gives awkward lines (徹夜／してしまった).
 */
const LONG_PIECE = 8;
/**
 * The least likely break (BudouX score) a long phrase is split at, unless it
 * is a natural break anyway (after 、 or ・, or between kanji and katakana) or
 * the phrase would not fit the line at all. Below this, splits start to cut
 * words (一番かっこ／いい, 1億円当／たったら).
 */
const SPLIT_FLOOR = -700;

const KATAKANA = /[ァ-ヺーｦ-ﾟ]/u;
const KANJI = /[\p{Script=Han}々〆]/u;
const ALNUM = /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/u;
const HIRAGANA = /[ぁ-ゖ]/u;
const OPENING_CHAR = /[「『（(［[｛{〈《【〔“‘]/u;
/** No Japanese word starts with ん. */
const NO_START = /[んン]/u;
/** One-character particles: a break after one is a phrase break, not okurigana. */
const PARTICLE = /[のにをはがでとへもや]/u;
/** A long phrase may always be split after these. */
const SOFT_END = /[、，,・」』）)]/u;
/** Only hiragana and punctuation: an ending like なら、 or する？ that cannot stand alone. */
const HIRAGANA_ONLY = /^[ぁ-ゖ\p{P}\s]+$/u;
/** Not counted as letters when judging how much a piece holds. */
const NOT_LETTERS = /[\s\p{P}]/gu;
/** Words that only make sense with what comes before them (やってみたい／こと). */
const FORMAL_NOUN = /^(こと|もの|とき|ところ)$/u;
/** Sentence ends, ignored when judging a last piece's length. */
const SENTENCE_END = /[？?！!。…]+$/u;
/** Clause ends: a short piece inside a topic that ends with one belongs to the piece before (料理、, 派？). */
const CLAUSE_END = /[？?！!。…、，,]+$/u;

type Weights = Map<string, Map<string, number>>;
let weights: { model: Weights; base: number } | null = null;

/**
 * BudouX's features: the substring around a break before text[i], as
 * [model key, start offset, end offset]. Same as budoux's Parser.
 */
const FEATURES: [string, number, number][] = [
  ["UW1", -3, -2],
  ["UW2", -2, -1],
  ["UW3", -1, 0],
  ["UW4", 0, 1],
  ["UW5", 1, 2],
  ["UW6", 2, 3],
  ["BW1", -2, 0],
  ["BW2", -1, 1],
  ["BW3", 0, 2],
  ["TW1", -3, 0],
  ["TW2", -2, 1],
  ["TW3", -1, 2],
  ["TW4", 0, 3],
];

/**
 * BudouX's score for a break before text[i]: its phrase breaks are the
 * positive ones, and the higher a negative score, the more natural the
 * break still is. Computed the way budoux's Parser does, from its model.
 */
export function breakScore(text: string, i: number): number {
  if (!weights) {
    const model: Weights = new Map(
      Object.entries(jaModel as Record<string, Record<string, number>>).map(([k, v]) => [k, new Map(Object.entries(v))]),
    );
    let sum = 0;
    for (const group of model.values()) for (const v of group.values()) sum += v;
    weights = { model, base: -0.5 * sum };
  }
  let score = weights.base;
  for (const [key, from, to] of FEATURES) score += weights.model.get(key)?.get(text.substring(i + from, i + to)) ?? 0;
  return score;
}

function letters(text: string): number {
  return [...text.replace(NOT_LETTERS, "")].length;
}

/** At most two characters, not counting the punctuation after them (夢, 思う？, 料理、). */
function isShort(piece: string, end = SENTENCE_END): boolean {
  return [...piece.replace(end, "")].length <= 2;
}

/** Whether the piece text[s, e) may be split before text[i]. */
function canSplit(text: string, s: number, e: number, i: number): boolean {
  const a = text[i - 1];
  const b = text[i];
  if (/[\uDC00-\uDFFF]/.test(b) || /\s/.test(a) || /\s/.test(b)) return false;
  // Not inside a word written in one script (シチュ／エーション, 恋／愛, 10／0).
  if ([KATAKANA, KANJI, ALNUM].some((re) => re.test(a) && re.test(b))) return false;
  if (CLOSING.test(b) || NO_START.test(b) || OPENING_CHAR.test(a)) return false;
  // Not after the okurigana inside a compound verb (入れ／替わる, 貸し／切る).
  if (HIRAGANA.test(a) && !PARTICLE.test(a) && KANJI.test(b) && KANJI.test(text[i - 2] ?? "")) return false;
  // Both halves must hold something: not 告／白, and not a bare ending like なら、.
  return [text.slice(s, i), text.slice(i, e)].every((side) => {
    const n = letters(side);
    return n >= 3 || (n === 2 && !HIRAGANA_ONLY.test(side));
  });
}

/** The best place to split text[s, e), or null. */
function bestSplit(text: string, s: number, e: number, anywhere: boolean): number | null {
  let best: number | null = null;
  let bestScore = -Infinity;
  for (let i = s + 1; i < e; i++) {
    if (!canSplit(text, s, e, i)) continue;
    const score = breakScore(text, i);
    const a = text[i - 1];
    const b = text[i];
    const natural = SOFT_END.test(a) || (KANJI.test(a) && KATAKANA.test(b)) || (KATAKANA.test(a) && KANJI.test(b));
    if (!natural && !anywhere && score < SPLIT_FLOOR) continue;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

/** text[s, e) as pieces no wider than LONG_PIECE where it can be split well. */
function splitLong(text: string, s: number, e: number): [number, number][] {
  const width = pieceEms(text.slice(s, e));
  if (width <= LONG_PIECE) return [[s, e]];
  // A piece that does not fit the line even at the minimum size is split at its
  // best break whatever its score: better than a break at any character.
  const at = bestSplit(text, s, e, width > MAX_PIECE);
  return at === null ? [[s, e]] : [...splitLong(text, s, at), ...splitLong(text, at, e)];
}

/**
 * The pieces a card topic is set in: each stays on one line. BudouX phrases,
 * with a long one split again (恋愛映画・／ドラマ・／マンガは？, 告白／シチュエーションは？)
 * and a short or dependent last piece joined to the one before (子どもの／頃の夢,
 * やってみたいこと), as long as the result still fits a line at the minimum
 * size. A short question inside a topic joins too (毎日したい派？／たまに派？).
 */
export function topicPieces(text: string): string[] {
  const ranges: [number, number][] = [];
  let pos = 0;
  for (const p of phrases(text)) {
    ranges.push(...splitLong(text, pos, pos + p.length));
    pos += p.length;
  }
  // Right to left, so that a joined piece is looked at again.
  for (let k = ranges.length - 1; k > 0; k--) {
    const [s, junction] = ranges[k - 1];
    const e = ranges[k][1];
    const piece = text.slice(junction, e);
    const stranded =
      k === ranges.length - 1
        ? isShort(piece) || FORMAL_NOUN.test(piece.replace(SENTENCE_END, ""))
        : isShort(piece, CLAUSE_END) && CLAUSE_END.test(piece); // 毎日したい／派？, 作ってほしい／料理、
    if (!stranded) continue;
    if (pieceEms(text.slice(s, e)) <= MAX_PIECE) {
      ranges.splice(k - 1, 2, [s, e]);
    } else {
      // Too wide together: split the piece before and join the end of it (1台だけ／残すならどれ？).
      const at = bestSplit(text, s, junction, false);
      if (at !== null && pieceEms(text.slice(at, e)) <= MAX_PIECE) ranges.splice(k - 1, 2, [s, at], [at, e]);
    }
  }
  return ranges.map(([s, e]) => text.slice(s, e));
}

/** The longest piece of a topic the browser may not break, in ems. */
export function longestPieceEms(text: string): number {
  return Math.max(1, ...topicPieces(text).map(pieceEms));
}

/**
 * Topic size in container units (cqi = 1% of the card's width), so the text
 * scales with the card whether it is a full-screen draw or a small preview.
 * Short topics are big; any topic shrinks until its longest piece fits on
 * one line, so a word is never split (徹夜してしまっ/た), but not below
 * TOPIC_MIN.
 */
export function topicSize(text: string): string {
  const n = [...text].length;
  const tier = n <= 10 ? 15 : n <= 22 ? 12 : n <= 40 ? 9.4 : n <= 60 ? 7.6 : 6.8;
  const size = Math.min(tier, Math.max(TOPIC_MIN, TOPIC_LINE / longestPieceEms(text)));
  // Rounded down, so the longest piece never ends up a hair wider than the line.
  return `${Math.floor(size * 100 + 1e-6) / 100}cqi`;
}

/* ---------------------------------------------------------------------------
 * Colour
 * ------------------------------------------------------------------------- */

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

function toHex(c: Rgb): string {
  return `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB hex to OKLCH [lightness 0..1, chroma, hue in radians]. */
function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

/** OKLCH to sRGB (0..255 per channel), or null when it is outside sRGB. */
function fromOklch(L: number, C: number, h: number): Rgb | null {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (lin.some((v) => v < -1e-4 || v > 1 + 1e-4)) return null;
  return lin.map((v) => fromLinear(Math.min(1, Math.max(0, v)))) as Rgb;
}

/**
 * The colour, darkened until white text on it reads (4.5:1). It keeps its hue
 * and as much of its chroma as sRGB allows at that lightness, so a pink stays
 * pink instead of turning mauve or brown.
 */
export function shadeForWhite(color: string, min = 4.5): string {
  if (contrast(color, "#ffffff") >= min) return color;
  const [L, C, h] = toOklch(color);
  for (let l = L; l > 0; l -= 0.005) {
    let c = C;
    let out = fromOklch(l, c, h);
    while (!out && c > 0) {
      c = Math.max(0, c - 0.004);
      out = fromOklch(l, c, h);
    }
    const hex = out ? toHex(out) : "#000000";
    if (contrast(hex, "#ffffff") >= min) return hex;
  }
  return "#000000";
}

/**
 * The band across the top of a card front: the deck colours with text that
 * reads on them (4.5:1 for every stop). Light decks (lemon, rose) keep their
 * bright colours with ink text; the others carry white text, deepened where
 * they need it.
 */
export function bandColors(theme: { from: string; to: string; ink: string }): { background: string; color: string } {
  const reads = (text: string) => contrast(theme.from, text) >= 4.5 && contrast(theme.to, text) >= 4.5;
  const gradient = (a: string, b: string) => `linear-gradient(110deg, ${a}, ${b})`;
  if (reads("#ffffff")) return { background: gradient(theme.from, theme.to), color: "#ffffff" };
  if (reads(theme.ink)) return { background: gradient(theme.from, theme.to), color: theme.ink };
  return { background: gradient(shadeForWhite(theme.from), shadeForWhite(theme.to)), color: "#ffffff" };
}
