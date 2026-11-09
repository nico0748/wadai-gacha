/** Chance that any one draw is rare. */
export const RARE_CHANCE = 0.1;
/** After this many non-rare draws in a row, the next draw is always rare. */
export const RARE_PITY = 9;

/**
 * Rolls one draw. Rarity belongs to the draw, never to a topic: nobody may
 * pick it (everyone would), and it must not hint at who wrote what.
 * `misses` is the number of non-rare draws since the last rare one.
 */
export function rollRare(misses: number, random: () => number = Math.random): boolean {
  return misses >= RARE_PITY || random() < RARE_CHANCE;
}
