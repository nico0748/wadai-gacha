import type { CSSProperties } from "react";
import { themeOf } from "@/lib/decks/themes";
import { CapsuleMark } from "./Logo";

export const CARD_WIDTH = "min(72vw, 19rem, calc((100svh - 17rem) * 0.714))";

function topicSize(text: string): string {
  const n = [...text].length;
  if (n <= 10) return "clamp(1.6rem, 8.4vw, 2.05rem)";
  if (n <= 22) return "clamp(1.35rem, 6.8vw, 1.7rem)";
  if (n <= 40) return "clamp(1.15rem, 5.6vw, 1.4rem)";
  return "clamp(1rem, 4.8vw, 1.2rem)";
}

export function CardBack({ theme, label }: { theme: string; label?: string }) {
  const t = themeOf(theme);
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-card"
      style={{ background: `linear-gradient(150deg, ${t.from}, ${t.to})` }}
    >
      <div className="card-back-pattern absolute inset-0" />
      <div className="absolute inset-[7%] rounded-[0.7rem] border-[1.5px] border-white/40" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="rounded-full bg-white/15 p-4 ring-1 ring-white/30 backdrop-blur-[2px]">
          <CapsuleMark size={64} top="rgba(255,255,255,0.95)" />
        </div>
        {label ? (
          <span className="max-w-[80%] truncate text-sm font-bold text-white/90" style={{ textShadow: `0 1px 0 ${t.ink}55` }}>
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function CardFront({
  theme,
  text,
  deckTitle,
  order,
  style,
}: {
  theme: string;
  text: string;
  deckTitle?: string;
  order?: number | null;
  style?: CSSProperties;
}) {
  const t = themeOf(theme);
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden rounded-card bg-paper text-paper-ink" style={style}>
      <div
        className="flex items-center justify-between px-4 py-2.5 text-[0.8rem] font-bold text-white"
        style={{ background: `linear-gradient(110deg, ${t.from}, ${t.to})` }}
      >
        <span className="truncate">{deckTitle ?? "話題ガチャ"}</span>
        {order ? <span className="shrink-0 tabular-nums">No.{order}</span> : null}
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-4">
        <p
          className="text-center font-black leading-snug [word-break:auto-phrase] [overflow-wrap:anywhere] [text-wrap:balance]"
          style={{ fontSize: topicSize(text) }}
        >
          {text}
        </p>
      </div>
      <div className="flex items-center justify-center gap-1.5 pb-3 text-[0.7rem] font-bold text-paper-ink/40">
        <CapsuleMark size={14} top={t.from} />
        話題ガチャ
      </div>
    </div>
  );
}

/** A static, non-animated card for lists and previews. */
export function MiniCard({ theme, label }: { theme: string; label?: string }) {
  return (
    <div className="relative aspect-[5/7] w-full shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)]">
      <CardBack theme={theme} label={label} />
    </div>
  );
}
