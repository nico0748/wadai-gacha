"use client";

import { useCallback, useRef, useState } from "react";
import { useWakeLock } from "@/hooks/useWakeLock";
import type { Deck } from "@/lib/decks/types";
import { rollRare } from "@/lib/rarity";
import { CardStage, type DrawnTopic } from "./CardStage";

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Normal mode: the whole deck is shuffled on this device; drawn cards leave the pile. */
export function DeckPlayer({ deck }: { deck: Pick<Deck, "title" | "theme" | "cards"> }) {
  const [round, setRound] = useState(0);
  // Rarity is rolled on this device, so it works offline. The streak of
  // non-rare draws carries over a reshuffle, so the pity limit still holds.
  const misses = useRef(0);
  const roll = useCallback(() => {
    const rare = rollRare(misses.current);
    misses.current = rare ? 0 : misses.current + 1;
    return rare;
  }, []);
  useWakeLock(true);
  return <Round key={round} deck={deck} rollRare={roll} onReshuffle={() => setRound((r) => r + 1)} />;
}

function Round({
  deck,
  rollRare: roll,
  onReshuffle,
}: {
  deck: Pick<Deck, "title" | "theme" | "cards">;
  /** Rolls whether the next draw is rare. */
  rollRare: () => boolean;
  onReshuffle: () => void;
}) {
  // Shuffled once per round; a reshuffle remounts this component.
  const [pile, setPile] = useState(() => shuffle(deck.cards));
  const [drawnCount, setDrawnCount] = useState(0);

  const draw = useCallback(async (): Promise<DrawnTopic> => {
    const text = pile[0];
    if (text === undefined) throw new Error("カードはもうありません");
    setPile((p) => p.slice(1));
    const order = drawnCount + 1;
    setDrawnCount(order);
    return { text, order, rare: roll() };
  }, [pile, drawnCount, roll]);

  const finished = pile.length === 0;

  return (
    <CardStage
      theme={deck.theme}
      deckTitle={deck.title}
      remaining={pile.length}
      onDraw={draw}
      canDraw={!finished}
      blockedNote={
        <div className="flex w-full max-w-xs flex-col items-center gap-3 text-center">
          <p className="font-bold">全{deck.cards.length}枚、引き終わりました</p>
          <button type="button" className="btn-quiet w-full" onClick={onReshuffle}>
            もう一度シャッフルする
          </button>
        </div>
      }
    />
  );
}
