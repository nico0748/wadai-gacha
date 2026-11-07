"use client";

import type { RoomSummary } from "@/lib/rooms/types";

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
