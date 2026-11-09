"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { RevealItem } from "@/lib/rooms/types";
import { themeOf } from "@/lib/decks/themes";
import { CardBack } from "../GachaCard";
import { Phrase } from "../Phrase";

/** The first card starts turning this long after the list appears; the next ones follow. */
const FLIP_START = 0.25;
const FLIP_GAP = 0.25;
const FLIP_DURATION = 0.55;
/** A long list does not keep people waiting: past this many, the rest turn together. */
const FLIP_STAGGER_MAX = 16;
/** Names follow the text they belong to. */
const AUTHOR_LAG = 0.3;

/**
 * The end-of-game reveal, shown on every phone in the room. The topics
 * nobody drew are the real secret, so they turn over one by one as little
 * cards; the drawn ones are a recap in the order they came out.
 *
 * In named rooms `author` stays null until the host's 答え合わせ reaches
 * the item, and a "？" holds its place.
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

  const meta = (item: RevealItem, onPaper: boolean, delay: number) =>
    named || mineSet.has(item.id) ? (
      <motion.p
        className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-bold"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0 : delay, duration: 0.3 }}
      >
        {named ? <Author name={item.author} onPaper={onPaper} /> : null}
        {mineSet.has(item.id) ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${onPaper ? "bg-paper-ink/10 text-paper-ink/80" : "bg-white/10 text-text"}`}
          >
            あなたの投稿
          </span>
        ) : null}
      </motion.p>
    ) : null;

  return (
    <div className="grid gap-12">
      <section aria-labelledby="reveal-undrawn" hidden={undrawn.length === 0}>
        <h2 id="reveal-undrawn" className="flex items-baseline justify-between text-lg font-black">
          <span>出番がなかった話題</span>
          <span className="text-sm font-bold text-text-dim tabular-nums">{undrawn.length}件</span>
        </h2>
        <p className="mt-1 text-sm text-text-dim">めくられなかった話題は、ここで初めて公開されます。</p>
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {undrawn.map((item, i) => {
            const delay = FLIP_START + Math.min(i, FLIP_STAGGER_MAX) * FLIP_GAP;
            return (
              <li key={item.id} className="relative" style={{ perspective: 900 }}>
                <motion.div
                  className="relative h-full"
                  style={{ transformStyle: "preserve-3d" }}
                  initial={reduce ? false : { rotateY: -180 }}
                  animate={{ rotateY: 0 }}
                  transition={{ delay, duration: FLIP_DURATION, ease: [0.3, 0.7, 0.25, 1] }}
                >
                  {/* Face: in the flow, so it sets the card's height. */}
                  <div
                    className="flex h-full min-h-[6.5rem] flex-col rounded-[0.8rem] bg-paper px-3.5 py-3 text-paper-ink shadow-[0_12px_24px_-14px_rgb(0_0_0/0.85)]"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      boxShadow: `inset 0 0 0 1px ${t.from}66, inset 0 0 0 4px rgb(255 250 240), inset 0 0 0 5px ${t.to}33, 0 12px 24px -14px rgb(0 0 0 / 0.85)`,
                    }}
                  >
                    <p className="jp-wrap flex-1 text-[0.98rem] leading-snug font-bold">
                      <Phrase text={item.text} />
                    </p>
                    {meta(item, true, delay + FLIP_DURATION / 2 + AUTHOR_LAG)}
                  </div>
                  {/* Back: the real card back, until the card turns. */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[0.8rem] shadow-[0_12px_24px_-14px_rgb(0_0_0/0.85)]"
                    style={{
                      transform: "rotateY(180deg)",
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <CardBack theme={theme} mini />
                  </div>
                </motion.div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="reveal-drawn">
        <h2 id="reveal-drawn" className="flex items-baseline justify-between text-lg font-black">
          <span>めくった話題</span>
          <span className="text-sm font-bold text-text-dim tabular-nums">{drawn.length}件</span>
        </h2>
        {drawn.length > 0 ? (
          <ol className="mt-4 grid gap-2.5">
            {drawn.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-4 rounded-[0.9rem] bg-ink-raised py-3 pr-4 pl-3 ring-1 ring-white/12"
              >
                <span
                  className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[0.65rem] font-display text-[1.1rem] text-white"
                  style={{ background: `linear-gradient(150deg, ${t.from}, ${t.to})` }}
                >
                  <span className="sr-only">{item.order}枚目</span>
                  <span aria-hidden="true">{item.order}</span>
                  {item.rare ? (
                    <span
                      className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-lamp text-[0.7rem] leading-none text-ink"
                      title="レア"
                    >
                      <span aria-hidden="true">★</span>
                      <span className="sr-only">レア</span>
                    </span>
                  ) : null}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="jp-wrap leading-snug font-bold">
                    <Phrase text={item.text} />
                  </p>
                  {meta(item, false, AUTHOR_LAG)}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-text-dim">今回は1枚もめくりませんでした。</p>
        )}
      </section>
    </div>
  );
}

/** The author's name, or "？" until the 答え合わせ reaches it. */
function Author({ name, onPaper }: { name: string | null; onPaper: boolean }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={name ?? "?"}
        className={onPaper ? "text-paper-ink/80" : "text-text"}
        initial={reduce ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
      >
        <span className="sr-only">投稿：</span>
        {name ?? (
          <>
            <span aria-hidden="true">？</span>
            <span className="sr-only">まだ秘密</span>
          </>
        )}
      </motion.span>
    </AnimatePresence>
  );
}
