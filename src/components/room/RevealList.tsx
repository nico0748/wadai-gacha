"use client";

import { motion, useReducedMotion } from "motion/react";
import type { RevealItem } from "@/lib/rooms/types";
import { themeOf } from "@/lib/decks/themes";
import { Phrase } from "../Phrase";

/**
 * The end-of-game reveal, shown on every phone in the room. Drawn topics are
 * a recap in the order they came out; the ones nobody drew are the real
 * secret, so they turn over one by one.
 */
export function RevealList({
  items,
  mine = [],
  theme = "yoru",
  named = false,
}: {
  items: RevealItem[];
  mine?: string[];
  theme?: string;
  named?: boolean;
}) {
  const reduce = useReducedMotion();
  const t = themeOf(theme);
  const drawn = items.filter((i) => i.order !== null);
  const undrawn = items.filter((i) => i.order === null);
  const mineSet = new Set(mine);

  const meta = (item: RevealItem, onPaper: boolean) =>
    item.author || mineSet.has(item.id) ? (
      <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-bold">
        {item.author ? (
          <span className={onPaper ? "text-paper-ink/80" : "text-text"}>
            <span className="sr-only">投稿：</span>
            {item.author}
          </span>
        ) : null}
        {mineSet.has(item.id) ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${onPaper ? "bg-paper-ink/10 text-paper-ink/80" : "bg-white/10 text-text"}`}
          >
            あなたの投稿
          </span>
        ) : null}
      </p>
    ) : null;

  return (
    <div className="grid gap-12">
      <section aria-labelledby="reveal-undrawn" hidden={undrawn.length === 0}>
        <h2 id="reveal-undrawn" className="flex items-baseline justify-between text-lg font-black">
          <span>出番がなかった話題</span>
          <span className="text-sm font-bold text-text-dim tabular-nums">{undrawn.length}件</span>
        </h2>
        <p className="mt-1 text-sm text-text-dim">
          {named ? "誰が書いたかも、ここで答え合わせ。" : "引かれなかった話題は、ここで初めて公開されます。"}
        </p>
        <ul className="mt-4 grid gap-2.5" style={{ perspective: 800 }}>
          {undrawn.map((item, i) => (
            <motion.li
              key={item.id}
              initial={reduce ? false : { opacity: 0, rotateX: -80, y: 10 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.3 + i * 0.25, type: "spring", stiffness: 220, damping: 20 }}
              className="relative flex overflow-hidden rounded-[0.9rem] bg-ink-raised ring-1 ring-white/10"
            >
              <span
                aria-hidden="true"
                className="w-3 shrink-0"
                style={{ background: `linear-gradient(180deg, ${t.from}, ${t.to})` }}
              />
              <div className="min-w-0 flex-1 px-4 py-3.5">
                <p className="jp-wrap text-[1.05rem] leading-snug font-bold">
                  <Phrase text={item.text} />
                </p>
                {meta(item, false)}
              </div>
            </motion.li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="reveal-drawn">
        <h2 id="reveal-drawn" className="flex items-baseline justify-between text-lg font-black">
          <span>引かれた話題</span>
          <span className="text-sm font-bold text-text-dim tabular-nums">{drawn.length}件</span>
        </h2>
        {drawn.length > 0 ? (
          <ol className="mt-4 grid gap-2.5">
            {drawn.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-4 rounded-[0.9rem] bg-paper py-3 pr-4 pl-3 text-paper-ink shadow-[0_10px_22px_-14px_rgb(0_0_0/0.8)]"
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.65rem] font-display text-[1.1rem] tabular-nums"
                  style={{ background: `${t.from}26`, color: t.ink }}
                >
                  <span className="sr-only">{item.order}枚目</span>
                  <span aria-hidden="true">{item.order}</span>
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="jp-wrap leading-snug font-bold">
                    <Phrase text={item.text} />
                  </p>
                  {meta(item, true)}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-text-dim">今回は1枚も引かれませんでした。</p>
        )}
      </section>
    </div>
  );
}
