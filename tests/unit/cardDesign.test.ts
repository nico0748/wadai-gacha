import { loadDefaultJapaneseParser } from "budoux";
import { describe, expect, it } from "vitest";
import engineer from "@/data/decks/engineer.json";
import game from "@/data/decks/game.json";
import koibana from "@/data/decks/koibana.json";
import moshimo from "@/data/decks/moshimo.json";
import shotaimen from "@/data/decks/shotaimen.json";
import zatsudan from "@/data/decks/zatsudan.json";
import { DECK_THEMES } from "@/lib/decks/themes";
import {
  bandColors,
  breakScore,
  contrast,
  longestPieceEms,
  phrases,
  shadeForWhite,
  textEms,
  topicPieces,
  topicSize,
} from "@/components/cardDesign";

const cqi = (size: string) => Number(size.replace("cqi", ""));
const ALL_CARDS = [game, engineer, zatsudan, koibana, moshimo, shotaimen].flatMap((d) => d.cards);
/** The widest piece that fits a line at the 8cqi minimum (82cqi / 8cqi). */
const MAX_PIECE = 82 / 8;
const stranded = (piece: string) => {
  const core = piece.replace(/[？?！!。…]+$/u, "");
  return [...core].length <= 2 || /^(こと|もの|とき|ところ)$/u.test(core);
};

describe("phrases", () => {
  it("keeps words whole", () => {
    expect(phrases("徹夜してしまったゲームは？")).toEqual(["徹夜してしまった", "ゲームは？"]);
  });

  it("never leaves an opening bracket at a line end or closing punctuation at a line start", () => {
    for (const text of ALL_CARDS) {
      const parts = phrases(text);
      expect(parts.join("")).toBe(text);
      for (const p of parts) {
        expect(p).not.toMatch(/[「『（]$/);
        expect(p).not.toMatch(/^[」』）、。！？…ぁぃぅぇぉっゃゅょー〜]/);
      }
    }
    expect(phrases("「これは負債だな…」と思ったコードの話")[0]).toBe("「これは");
  });

  it("keeps a small kana and the particle after a quote with what comes before", () => {
    expect(phrases("最近知って「へぇ〜」となったこと")).toContain("「へぇ〜」と");
  });
});

describe("breakScore", () => {
  it("agrees with BudouX: its phrase breaks are exactly the positive scores", () => {
    const parser = loadDefaultJapaneseParser();
    for (const text of ALL_CARDS) {
      const positive = [];
      for (let i = 1; i < text.length; i++) if (breakScore(text, i) > 0) positive.push(i);
      expect(positive).toEqual(parser.parseBoundaries(text));
    }
  });
});

describe("topicPieces", () => {
  it("only regroups the text", () => {
    for (const text of ALL_CARDS) expect(topicPieces(text).join("")).toBe(text);
  });

  it("splits a long phrase after 、 and ・ and between kanji and katakana", () => {
    expect(topicPieces("好きな恋愛映画・ドラマ・マンガは？")).toEqual(["好きな", "恋愛映画・", "ドラマ・", "マンガは？"]);
    expect(topicPieces("憧れの告白シチュエーションは？")).toEqual(["憧れの", "告白", "シチュエーションは？"]);
    expect(topicPieces("一番好きなプログラミング言語と、その理由")).toContain("プログラミング");
  });

  it("splits a long phrase at its most natural inner break", () => {
    expect(topicPieces("一度だけやったことがある、珍しい体験")).toEqual(["一度だけやった", "ことがある、", "珍しい体験"]);
    expect(topicPieces("好きなタイプを、キャラクターでたとえると？")).toEqual(["好きな", "タイプを、", "キャラクターで", "たとえると？"]);
    // Not before a bare ending: 貸し切れる／なら、 would leave なら、 alone.
    expect(topicPieces("一晩だけ貸し切れるなら、どこにする？")).toEqual(["一晩だけ", "貸し切れるなら、", "どこにする？"]);
  });

  it("does not cut a word to make a piece shorter", () => {
    // One katakana word, a compound verb, an adjective: kept whole, even if that makes the topic smaller.
    expect(topicPieces("スマートフォンアプリケーションの使い方")[0]).toBe("スマートフォンアプリケーションの");
    expect(topicPieces("1日だけ誰かと入れ替われるなら誰？")).toEqual(["1日だけ", "誰かと", "入れ替われるなら誰？"]);
    expect(topicPieces("一番かっこいいと思う必殺技は？")).not.toContain("一番かっこ");
    // Up to 8 ems a phrase is left alone: 徹夜／してしまった would read worse than a slightly smaller topic.
    expect(topicPieces("徹夜してしまったゲームは？")).toEqual(["徹夜してしまった", "ゲームは？"]);
    // Latin text wraps at its spaces as before.
    expect(topicPieces("What is your favourite language?")).toEqual(["What is your favourite language?"]);
  });

  it("joins a short last piece, or こと/もの/とき/ところ, to the one before", () => {
    expect(topicPieces("子どもの頃の夢")).toEqual(["子どもの", "頃の夢"]);
    expect(topicPieces("人生で一番おいしかったもの")).toEqual(["人生で", "一番", "おいしかったもの"]);
    expect(topicPieces("今年中にやってみたいこと")).toEqual(["今年中に", "やってみたいこと"]);
    expect(topicPieces("最近ハマっていること")).toEqual(["最近", "ハマっていること"]);
    expect(topicPieces("理不尽だと思った難所はどこ？").at(-1)).toBe("難所はどこ？");
  });

  it("joins a short clause inside a topic too", () => {
    expect(topicPieces("恋人との連絡、毎日したい派？たまに派？")).toEqual(["恋人との連絡、", "毎日したい派？", "たまに派？"]);
    expect(topicPieces("恋人に作ってほしい料理、作ってあげたい料理")).toEqual(["恋人に", "作ってほしい料理、", "作ってあげたい料理"]);
    expect(topicPieces("得意な家事、苦手な家事")).toEqual(["得意な家事、", "苦手な家事"]);
  });

  it("splits the piece before when joining would not fit a line at the minimum size", () => {
    expect(topicPieces("ゲーム機を1台だけ残すならどれ？")).toEqual(["ゲーム機を", "1台だけ", "残すならどれ？"]);
    // Nothing to split: the tail stays on its own rather than overflow.
    expect(topicPieces("スマートフォンアプリケーションの夢").at(-1)).toBe("夢");
  });

  it("never ends a built-in card on a stranded piece, and every piece fits a line at the minimum", () => {
    for (const text of ALL_CARDS) {
      const pieces = topicPieces(text);
      if (pieces.length > 1) expect(stranded(pieces.at(-1)!), text).toBe(false);
      for (const p of pieces) expect(textEms(p), p).toBeLessThanOrEqual(MAX_PIECE);
    }
  });
});

describe("topicSize", () => {
  it("keeps the length tiers as the upper bound", () => {
    expect(topicSize("自分の名前の由来")).toBe("15cqi");
    expect(cqi(topicSize("朝型？夜型？"))).toBeLessThanOrEqual(15);
    expect(cqi(topicSize("自分を動物にたとえると？"))).toBeLessThanOrEqual(12);
    expect(cqi(topicSize("あ".repeat(80)))).toBeLessThanOrEqual(7.6);
  });

  it("shrinks until the longest piece fits one line", () => {
    // 徹夜してしまった is 8 characters: 82 / 8 = 10.25cqi, below the 12cqi tier.
    expect(topicSize("徹夜してしまったゲームは？")).toBe("10.25cqi");
    for (const text of ALL_CARDS) {
      expect(cqi(topicSize(text)) * longestPieceEms(text)).toBeLessThanOrEqual(82.01);
    }
  });

  it("keeps topics with one long phrase big", () => {
    expect(topicSize("好きな恋愛映画・ドラマ・マンガは？")).toBe("12cqi");
    expect(cqi(topicSize("一度だけやったことがある、珍しい体験"))).toBeGreaterThan(11);
    expect(cqi(topicSize("一晩だけ貸し切れるなら、どこにする？"))).toBeGreaterThan(10);
    for (const text of ALL_CARDS) expect(cqi(topicSize(text)), text).toBeGreaterThanOrEqual(8);
  });

  it("does not go below a readable size for one very long word", () => {
    expect(topicSize("スーパーカリフラジリスティックエクスピアリドーシャス")).toBe("8cqi");
  });

  it("counts half-width letters as narrower", () => {
    expect(textEms("AIを")).toBeCloseTo(2.2);
    expect(longestPieceEms("What is your favourite language?")).toBeCloseTo(0.6 * "favourite".length);
  });
});

describe("band colours", () => {
  /** HSL hue in degrees of a #rrggbb colour. */
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };

  it("keeps the band text readable (4.5:1) on both ends of the band on every deck theme", () => {
    for (const t of Object.values(DECK_THEMES)) {
      const band = bandColors(t);
      const stops = band.background.match(/#[0-9a-f]{6}/g)!;
      expect(band.background).toMatch(/^linear-gradient\(/);
      expect(stops).toHaveLength(2);
      for (const stop of stops) expect(contrast(stop, band.color)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the light decks bright, with ink text", () => {
    for (const key of ["lemon", "rose"] as const) {
      const t = DECK_THEMES[key];
      expect(bandColors(t)).toEqual({ background: `linear-gradient(110deg, ${t.from}, ${t.to})`, color: t.ink });
    }
  });

  it("deepens a colour for white text without changing its hue", () => {
    for (const t of Object.values(DECK_THEMES)) {
      for (const c of [t.from, t.to]) {
        const shade = shadeForWhite(c);
        expect(contrast(shade, "#ffffff")).toBeGreaterThanOrEqual(4.5);
        const diff = Math.abs(hue(shade) - hue(c));
        expect(Math.min(diff, 360 - diff), `${c} -> ${shade}`).toBeLessThan(12);
      }
    }
  });

  it("leaves a colour that is already dark enough alone", () => {
    expect(shadeForWhite("#5a3bdb")).toBe("#5a3bdb");
  });
});
