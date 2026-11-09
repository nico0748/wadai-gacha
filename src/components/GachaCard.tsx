import type { CSSProperties } from "react";
import { themeOf } from "@/lib/decks/themes";
import { bandGradient, topicSize } from "./cardDesign";
import { BubbleMark } from "./Logo";
import { Phrase } from "./Phrase";

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

/** The underline from the logo, drawn under the topic. */
function Swoosh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 26" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7 19.5C46 9.5 104 5.2 193 8.5"
        stroke="var(--color-primary-deep)"
        strokeOpacity="0.42"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CardFront({
  theme,
  text,
  deckTitle,
  order,
  rare = false,
  style,
}: {
  theme: string;
  text: string;
  deckTitle?: string;
  order?: number | null;
  /** A rare draw: gold foil frame and a RARE stamp. */
  rare?: boolean;
  style?: CSSProperties;
}) {
  const t = themeOf(theme);
  return (
    <div
      className={`@container absolute inset-0 overflow-hidden rounded-card ${rare ? "bg-foil p-[3.2%]" : "p-[2.2%]"}`}
      style={{ ...(rare ? null : { background: `linear-gradient(150deg, ${t.from}, ${t.to})` }), ...style }}
    >
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-card)-0.3rem)] bg-paper text-paper-ink"
        style={{ boxShadow: rare ? "inset 0 0 0 1px var(--color-foil-deep)" : `inset 0 0 0 1px ${t.from}55` }}
      >
        {/* The deck's band: card number and deck name, like the head of a playing card. */}
        <div
          className="flex h-[13%] shrink-0 items-center justify-between gap-[3cqi] px-[5cqi] text-white"
          style={{ background: bandGradient(t) }}
        >
          {order ? (
            <span className="flex items-baseline gap-[1.2cqi] leading-none">
              <span className="text-[3.6cqi] font-black tracking-wider opacity-85">No.</span>
              <span className="font-display text-[7.6cqi] tabular-nums">{order}</span>
            </span>
          ) : (
            <span />
          )}
          {deckTitle ? <span className="min-w-0 truncate text-[4.2cqi] leading-tight font-black">{deckTitle}</span> : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-[4.5cqi] pt-[3cqi] pb-[8cqi]">
          <p
            className="jp-wrap text-center leading-[1.42] font-black [text-wrap:balance]"
            style={{ fontSize: topicSize(text) }}
          >
            <Phrase text={text} atomic />
          </p>
          <Swoosh className="mt-[2.5cqi] w-[48cqi] shrink-0" />
        </div>

        {rare ? (
          <span
            className="absolute bottom-[4.5cqi] left-[4.5cqi] -rotate-[8deg] rounded-[1.4cqi] bg-foil px-[2.4cqi] py-[1cqi] font-display text-[4.4cqi] leading-none tracking-[0.12em] text-foil-ink"
            style={{
              boxShadow:
                "inset 0 0 0 0.5cqi rgb(255 255 255 / 0.45), 0 0.6cqi 1.4cqi -0.4cqi color-mix(in srgb, var(--color-foil-ink) 50%, transparent)",
            }}
          >
            RARE
          </span>
        ) : null}
        <span className="absolute right-[5cqi] bottom-[4.5cqi] opacity-30" aria-hidden="true">
          <BubbleMark color={t.to} className="h-[9cqi] w-[9cqi]" />
        </span>
      </div>
    </div>
  );
}
