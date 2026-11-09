import { describe, expect, it } from "vitest";
import { RARE_PITY, rollRare } from "@/lib/rarity";

describe("rollRare", () => {
  it("is rare about 15% of the time and never misses ten times in a row", () => {
    let misses = 0;
    let rare = 0;
    let longest = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      if (rollRare(misses)) {
        rare++;
        misses = 0;
      } else {
        misses++;
        longest = Math.max(longest, misses);
      }
    }
    expect(rare / n).toBeGreaterThan(0.14);
    expect(rare / n).toBeLessThan(0.17);
    expect(longest).toBeLessThanOrEqual(RARE_PITY);
  });

  it("forces a rare draw after the pity limit", () => {
    expect(rollRare(RARE_PITY, () => 0.99)).toBe(true);
    expect(rollRare(0, () => 0.99)).toBe(false);
    expect(rollRare(0, () => 0.01)).toBe(true);
  });
});
