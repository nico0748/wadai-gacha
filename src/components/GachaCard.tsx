import type { CSSProperties } from "react";
import { themeOf } from "@/lib/decks/themes";
import { BubbleMark } from "./Logo";
import { Phrase } from "./Phrase";

/**
 * Topic size in container units (cqi = 1% of the card's width), so the text
 * scales with the card whether it is a full-screen draw or a small preview.
 */
function topicSize(text: string): string {
  const n = [...text].length;
  if (n <= 10) return "15cqi";
  if (n <= 22) return "12cqi";
  if (n <= 40) return "9.4cqi";
  return "7.6cqi";
}

/** Small speech bubbles, tiled. Drawn in white so the deck gradient shows through. */
const BUBBLE_TILE = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><path transform='translate(8.04 8.38) scale(.31)' d='M16 4.5c7.46 0 13.5 4.66 13.5 10.4S23.46 25.3 16 25.3c-1.38 0-2.72-.16-3.98-.46L5.6 28.9l1.72-5.86C4.3 21.15 2.5 18.2 2.5 14.9 2.5 9.16 8.54 4.5 16 4.5z' fill='white' fill-opacity='.24'/></svg>`,
);

export function CardBack({ theme, label }: { theme: string; label?: string }) {
  const t = themeOf(theme);
  return (
    <div
      className="@container absolute inset-0 overflow-hidden rounded-card"
      style={{ background: `linear-gradient(150deg, ${t.from}, ${t.to})` }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,${BUBBLE_TILE}"), url("data:image/svg+xml,${BUBBLE_TILE}")`,
          backgroundSize: "26px 26px",
          backgroundPosition: "0 0, 13px 13px",
        }}
      />
      <div className="absolute inset-[5.5%] rounded-[0.75rem] border-[1.5px] border-white/45" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[6cqi]">
        <div
          className="grid aspect-square w-[40cqi] place-items-center rounded-full bg-paper"
          style={{ boxShadow: `0 0 0 2px ${t.ink}26, 0 0 0 7px rgb(255 250 240 / 0.28), 0 10px 24px -10px ${t.ink}` }}
        >
          <BubbleMark color={t.to} className="h-[60%] w-[60%] translate-y-[4%]" />
        </div>
        {label ? (
          <span
            className="max-w-[78%] truncate rounded-full bg-paper px-[4.5cqi] py-[1.6cqi] text-[max(0.7rem,5.4cqi)] leading-tight font-black"
            style={{ color: t.ink }}
          >
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
    <div
      className="@container absolute inset-0 overflow-hidden rounded-card p-[2.2%]"
      style={{ background: `linear-gradient(150deg, ${t.from}, ${t.to})`, ...style }}
    >
      <div
        className="relative flex h-full flex-col rounded-[calc(var(--radius-card)-0.3rem)] bg-paper text-paper-ink"
        style={{ boxShadow: `inset 0 0 0 1px ${t.from}55, inset 0 0 0 4px rgb(255 250 240), inset 0 0 0 5px ${t.to}33` }}
      >
        <div className="flex items-start justify-between gap-2 px-[5.5cqi] pt-[5cqi]">
          {order ? (
            <span className="flex flex-col items-center leading-none" style={{ color: t.ink }}>
              <span className="text-[3.4cqi] font-black tracking-wider opacity-70">No.</span>
              <span className="font-display text-[9cqi] tabular-nums">{order}</span>
            </span>
          ) : (
            <span />
          )}
          {deckTitle ? (
            <span
              className="max-w-[60%] truncate rounded-full px-[3.4cqi] py-[1.2cqi] text-[3.8cqi] font-black"
              style={{ background: `${t.from}22`, color: t.ink }}
            >
              {deckTitle}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 items-center justify-center px-[5.5cqi] pb-[4cqi]">
          <p className="jp-wrap text-center leading-[1.42] font-black" style={{ fontSize: topicSize(text) }}>
            <Phrase text={text} />
          </p>
        </div>

        <span className="absolute right-[5cqi] bottom-[4.5cqi] opacity-30" aria-hidden="true">
          <BubbleMark color={t.to} className="h-[9cqi] w-[9cqi]" />
        </span>
      </div>
    </div>
  );
}
