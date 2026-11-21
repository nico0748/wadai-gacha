import type { CSSProperties } from "react";
import { themeOf } from "@/lib/decks/themes";
import { topicSize } from "./cardDesign";
import { Monogram } from "./Logo";
import { Phrase } from "./Phrase";

/**
 * The back of a card: the deck's jewel tone with a little light across it,
 * a brass hairline frame and the monogram. `mini` is a small tile (the
 * reveal list), with a frame that fits a short tile.
 */
export function CardBack({ theme, label, mini = false }: { theme: string; label?: string; mini?: boolean }) {
  const t = themeOf(theme);
  return (
    <div
      className={`@container absolute inset-0 overflow-hidden ${mini ? "rounded-[0.8rem]" : "rounded-card"}`}
      style={{
        background: `radial-gradient(130% 90% at 28% 12%, rgb(255 248 235 / 0.07), transparent 60%), linear-gradient(160deg, ${t.from}, ${t.to})`,
      }}
    >
      <div
        className={`absolute border border-accent/55 ${mini ? "inset-[0.35rem] rounded-[0.5rem]" : "inset-[5.5%] rounded-[0.6rem]"}`}
      />
      {mini ? null : <div className="absolute inset-[7.2%] rounded-[0.45rem] border border-accent/20" />}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[6cqi] text-accent">
        <Monogram className={mini ? "text-[1.7rem]" : "text-[min(26cqi,4.75rem)]"} />
        {label ? (
          <span className="max-w-[76%] truncate pl-[0.3em] font-display text-[max(0.7rem,4.6cqi)] leading-tight font-medium tracking-[0.3em] text-foil-light">
            {label}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The face of a card: plain card stock, the same for every deck. */
export function CardFront({
  text,
  deckTitle,
  order,
  rare = false,
  style,
}: {
  text: string;
  deckTitle?: string;
  order?: number | null;
  /** A rare draw: a gold foil edge and a RARE mark. */
  rare?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`@container absolute inset-0 overflow-hidden rounded-card ${rare ? "bg-foil p-[2%]" : "bg-paper p-[3.4%]"}`}
      style={style}
    >
      <div
        className={`flex h-full flex-col bg-paper text-paper-ink ${
          rare ? "rounded-[calc(var(--radius-card)-0.3rem)] p-[1.8%]" : ""
        }`}
      >
        {/* A fine gold rule inside the edge, like a printed card. */}
        <div
          className={`flex flex-1 flex-col rounded-[0.55rem] border px-[5cqi] pt-[4.4cqi] pb-[4cqi] ${
            rare ? "border-foil-deep/70" : "border-foil-deep/45"
          }`}
        >
          <div className="flex min-h-[8cqi] items-center justify-between gap-[3cqi] text-paper-gold">
            {order ? (
              <span className="font-latin text-[6.6cqi] leading-none font-medium italic">No. {order}</span>
            ) : (
              <span />
            )}
            {rare ? (
              <span className="rounded-[0.8cqi] border border-foil-deep py-[0.9cqi] pr-[1.6cqi] pl-[2.6cqi] font-latin text-[3.7cqi] leading-none font-semibold tracking-[0.4em]">
                RARE
              </span>
            ) : deckTitle ? (
              <span className="min-w-0 truncate pl-[0.3em] font-display text-[3.7cqi] leading-tight font-medium tracking-[0.3em]">
                {deckTitle}
              </span>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-[6.5cqi] py-[3cqi]">
            <p
              className="jp-wrap text-center font-display leading-[1.5] font-semibold [text-wrap:balance]"
              style={{ fontSize: topicSize(text) }}
            >
              <Phrase text={text} atomic />
            </p>
            <span className="h-px w-[11cqi] shrink-0 bg-foil-deep" aria-hidden="true" />
          </div>

          <Monogram className="text-center text-[5.6cqi] text-paper-gold" />
        </div>
      </div>
    </div>
  );
}
