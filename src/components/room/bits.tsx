"use client";

import { motion, useReducedMotion } from "motion/react";
import type { RoomSummary } from "@/lib/rooms/types";

export function Counter({
  label,
  value,
  unit,
  hint,
  highlight = false,
}: {
  label: string;
  value: number;
  unit: string;
  hint?: string;
  highlight?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={`rounded-card border p-4 ${highlight ? "border-lemon/50 bg-lemon/8" : "border-line/70 bg-ink-raised/50"}`}>
      <p className="text-sm font-bold text-text-dim">{label}</p>
      <p className="mt-1 flex items-baseline gap-1" aria-live="polite">
        <motion.span
          key={value}
          initial={reduce ? false : { scale: 1.35, color: "#ffd447" }}
          animate={{ scale: 1, color: "#f3efff" }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
          className="inline-block font-display text-[2.4rem] leading-none tabular-nums"
        >
          {value}
        </motion.span>
        <span className="font-bold text-text-dim">{unit}</span>
      </p>
      {hint ? <p className="mt-1 text-xs text-text-dim">{hint}</p> : null}
    </div>
  );
}

export function RoomRules({ room }: { room: RoomSummary }) {
  const end = room.endMode === "count" ? `${room.drawLimit}回引いたら終了` : "全部引き終わるまで";
  const names =
    room.nameMode === "named" ? "終了後に投稿者名を公開" : room.nameMode === "none" ? "ニックネームなし" : "投稿者は最後まで秘密";
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

export function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-2xl">{title}</h1>
      <p className="mt-3 text-text-dim">{body}</p>
      {children ? <div className="mt-8 flex justify-center gap-3">{children}</div> : null}
    </div>
  );
}
