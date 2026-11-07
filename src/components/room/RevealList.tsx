"use client";

import { motion, useReducedMotion } from "motion/react";
import type { RevealItem } from "@/lib/rooms/types";
import { themeOf } from "@/lib/decks/themes";

/**
 * The end-of-game reveal: every topic, drawn ones first in the order they came
 * out, then the ones nobody drew. Shown on every phone in the room.
 */
export function RevealList({
  items,
  mine = [],
  theme = "candy",
}: {
  items: RevealItem[];
  mine?: string[];
  theme?: string;
}) {
  const reduce = useReducedMotion();
  const t = themeOf(theme);
  const drawn = items.filter((i) => i.order !== null);
  const undrawn = items.filter((i) => i.order === null);
  const mineSet = new Set(mine);

  const row = (item: RevealItem, index: number) => (
    <motion.li
      key={item.id}
      initial={reduce ? false : { opacity: 0, y: 14, rotateX: -50 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: reduce ? 0 : 0.25 + index * 0.07, type: "spring", stiffness: 260, damping: 22 }}
      className="relative flex items-start gap-4 overflow-hidden rounded-[0.9rem] bg-paper py-3.5 pr-4 pl-3 text-paper-ink shadow-[0_10px_22px_-14px_rgb(0_0_0/0.8)]"
      style={{ transformPerspective: 600 }}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.6rem] text-xs font-black text-white tabular-nums"
        style={{
          background: item.order !== null ? `linear-gradient(140deg, ${t.from}, ${t.to})` : "#c9c3dc",
        }}
        aria-label={item.order !== null ? `${item.order}枚目` : "引かれなかった話題"}
      >
        {item.order ?? "—"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-snug break-words">{item.text}</p>
        {item.author || mineSet.has(item.id) ? (
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-paper-ink/55">
            {item.author ? <span>{item.author}</span> : null}
            {mineSet.has(item.id) ? (
              <span className="rounded-full bg-paper-ink/10 px-2 py-0.5 text-paper-ink/70">あなたの投稿</span>
            ) : null}
          </p>
        ) : null}
      </div>
    </motion.li>
  );

  return (
    <div className="grid gap-10">
      <section aria-labelledby="reveal-drawn">
        <h3 id="reveal-drawn" className="mb-4 flex items-baseline justify-between font-bold">
          <span>引かれた話題</span>
          <span className="text-sm text-text-dim tabular-nums">{drawn.length}件</span>
        </h3>
        {drawn.length > 0 ? (
          <ol className="grid gap-2.5">{drawn.map((item, i) => row(item, i))}</ol>
        ) : (
          <p className="text-sm text-text-dim">今回は1枚も引かれませんでした。</p>
        )}
      </section>
      {undrawn.length > 0 ? (
        <section aria-labelledby="reveal-undrawn">
          <h3 id="reveal-undrawn" className="mb-4 flex items-baseline justify-between font-bold">
            <span>出番がなかった話題</span>
            <span className="text-sm text-text-dim tabular-nums">{undrawn.length}件</span>
          </h3>
          <ul className="grid gap-2.5">{undrawn.map((item, i) => row(item, drawn.length + i))}</ul>
        </section>
      ) : null}
    </div>
  );
}
