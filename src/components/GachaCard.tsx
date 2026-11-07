import type { CSSProperties } from "react";
import { themeOf } from "@/lib/decks/themes";
import { CapsuleMark } from "./Logo";
import { Phrase } from "./Phrase";

/**
 * Topic size in container units (cqi = 1% of the card's width), so the text
 * scales with the card whether it is a full-screen draw or a small preview.
 */
function topicSize(text: string): string {
  const n = [...text].length;
  if (n <= 10) return "12cqi";
  if (n <= 22) return "9.6cqi";
  if (n <= 40) return "7.6cqi";
  return "6.2cqi";
}

/** Two-tone capsules, tiled. Drawn in white so the deck gradient shows through. */
const CAPSULE_TILE = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'><g transform='rotate(-30 13 13)'><path d='M7 10.5h6v5H7a2.5 2.5 0 0 1 0-5z' fill='white' fill-opacity='.34'/><path d='M13 10.5h6a2.5 2.5 0 0 1 0 5h-6z' fill='white' fill-opacity='.14'/></g></svg>`,
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
          backgroundImage: `url("data:image/svg+xml,${CAPSULE_TILE}"), url("data:image/svg+xml,${CAPSULE_TILE}")`,
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
          <CapsuleMark top={t.from} className="h-[58%] w-[58%]" />
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
      className="@container absolute inset-0 overflow-hidden rounded-card p-[2.2cqi]"
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

        <div className="flex flex-1 items-center justify-center px-[7cqi] pb-[4cqi]">
          <p className="jp-wrap text-center leading-[1.42] font-black" style={{ fontSize: topicSize(text) }}>
            <Phrase text={text} />
          </p>
        </div>

        {order ? (
          <span
            className="absolute right-[5.5cqi] bottom-[5cqi] flex rotate-180 flex-col items-center leading-none"
            style={{ color: t.ink }}
            aria-hidden="true"
          >
            <span className="text-[3.4cqi] font-black tracking-wider opacity-70">No.</span>
            <span className="font-display text-[9cqi] tabular-nums">{order}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
