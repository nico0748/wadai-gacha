"use client";

import { motion, useReducedMotion } from "motion/react";
import type { OwnTopic, RoomSummary } from "@/lib/rooms/types";
import { CardBack } from "../GachaCard";
import { Phrase } from "../Phrase";

export function RoomRules({ room }: { room: RoomSummary }) {
  const end = room.endMode === "count" ? `${room.drawLimit}回めくったら終了` : "全部めくり終わるまで";
  const names =
    room.nameMode === "named"
      ? "終了後に答え合わせ"
      : room.nameMode === "none"
        ? "ニックネームなし"
        : "投稿者は最後まで秘密";
  return (
    <ul className="flex flex-wrap gap-2 text-sm" aria-label="このルームのルール">
      {[end, names].map((r) => (
        <li key={r} className="rounded-full border border-line/70 px-3 py-1 text-text-dim">
          {r}
        </li>
      ))}
    </ul>
  );
}

export function Notice({
  title,
  body,
  children,
  footer,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
  /** Shown below the actions, e.g. the room code field. */
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="mt-3 text-text-dim">{body}</p>
      {children ? <div className="mt-8 flex justify-center gap-3">{children}</div> : null}
      {footer ? <div className="mt-12 border-t border-line/70 pt-8 text-left">{footer}</div> : null}
    </div>
  );
}

/**
 * The bar fixed to the bottom of the screen, for the host's main action and
 * its confirmation. `className` can place it elsewhere on other screens.
 */
export function BottomBar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-ink/92 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur-md ${className}`}
    >
      <div className="mx-auto grid max-w-xl gap-2">{children}</div>
    </div>
  );
}

export function DrawnBadge() {
  return (
    <span className="shrink-0 rounded-full bg-lamp/20 px-2.5 py-0.5 text-xs font-black text-lamp">めくられた！</span>
  );
}

/** A participant's own topics while they wait, with the ones already drawn marked. */
export function OwnTopicList({ topics }: { topics: OwnTopic[] }) {
  if (topics.length === 0) return null;
  return (
    <section className="mt-10 w-full text-left" aria-label="あなたの投稿">
      <h2 className="mb-2 text-sm font-bold text-text-dim">あなたの投稿（{topics.length}件）</h2>
      <ul className="grid gap-2">
        {topics.map((t) => (
          <li
            key={t.id}
            className={`flex items-center gap-3 rounded-[0.8rem] border bg-ink-raised px-4 py-2.5 ${
              t.drawn ? "border-lamp/50" : "border-line/70"
            }`}
          >
            <span className="jp-wrap min-w-0 flex-1">
              <Phrase text={t.text} />
            </span>
            {t.drawn ? <DrawnBadge /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Three face-down cards breathing on the table, for screens that wait on the host. */
export function WaitingCards() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mb-10 h-44 w-32" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-card shadow-[0_18px_34px_-16px_rgb(0_0_0/0.85)]"
          initial={false}
          animate={reduce ? undefined : { rotate: [i * 6 - 6, i * 6 - 3, i * 6 - 6], y: [0, -4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
          style={{ rotate: i * 6 - 6 }}
        >
          <CardBack theme="yoru" />
        </motion.div>
      ))}
    </div>
  );
}
