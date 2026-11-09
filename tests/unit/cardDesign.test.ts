import { describe, expect, it } from "vitest";
import engineer from "@/data/decks/engineer.json";
import game from "@/data/decks/game.json";
import zatsudan from "@/data/decks/zatsudan.json";
import { DECK_THEMES } from "@/lib/decks/themes";
import { bandGradient, contrast, longestPhraseEms, phrases, shadeForWhite, textEms, topicSize } from "@/components/cardDesign";

const cqi = (size: string) => Number(size.replace("cqi", ""));

describe("phrases", () => {
  it("keeps words whole", () => {
    expect(phrases("徹夜してしまったゲームは？")).toEqual(["徹夜してしまった", "ゲームは？"]);
  });

  it("never leaves an opening bracket at a line end or closing punctuation at a line start", () => {
    for (const text of [...game.cards, ...engineer.cards, ...zatsudan.cards]) {
      const parts = phrases(text);
      expect(parts.join("")).toBe(text);
      for (const p of parts) {
        expect(p).not.toMatch(/[「『（]$/);
        expect(p).not.toMatch(/^[」』）、。！？…]/);
      }
    }
    expect(phrases("「これは負債だな…」と思ったコードの話")[0]).toBe("「これは");
  });
});

describe("topicSize", () => {
  it("keeps the length tiers as the upper bound", () => {
    expect(topicSize("朝型？夜型？")).toBe("15cqi");
    expect(cqi(topicSize("自分を動物にたとえると？"))).toBeLessThanOrEqual(12);
    expect(cqi(topicSize("あ".repeat(80)))).toBeLessThanOrEqual(7.6);
  });

  it("shrinks until the longest phrase fits one line", () => {
    // 徹夜してしまった is 8 characters: 82 / 8 = 10.25cqi, below the 12cqi tier.
    expect(topicSize("徹夜してしまったゲームは？")).toBe("10.25cqi");
    for (const text of [...game.cards, ...engineer.cards, ...zatsudan.cards]) {
      expect(cqi(topicSize(text)) * longestPhraseEms(text)).toBeLessThanOrEqual(82.01);
    }
  });

  it("does not go below a readable size for one very long word", () => {
    expect(topicSize("スーパーカリフラジリスティックエクスピアリドーシャス")).toBe("5.2cqi");
  });

  it("counts half-width letters as narrower", () => {
    expect(textEms("AIを")).toBeCloseTo(2.2);
    expect(longestPhraseEms("What is your favourite language?")).toBeCloseTo(0.6 * "favourite".length);
  });
});

describe("band colours", () => {
  it("keeps white text readable on every deck theme", () => {
    for (const t of Object.values(DECK_THEMES)) {
      expect(contrast(shadeForWhite(t.from, t.ink), "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(shadeForWhite(t.to, t.ink), "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(bandGradient(t)).toMatch(/^linear-gradient\(/);
    }
  });

  it("leaves a colour that is already dark enough alone", () => {
    expect(shadeForWhite("#5a3bdb", "#1d0d45")).toBe("#5a3bdb");
  });
});
