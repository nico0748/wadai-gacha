"use client";

import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useCallback, useId, useRef, useState, type PointerEvent } from "react";
import { themeOf } from "@/lib/decks/themes";
import { CARD_WIDTH, CardBack, CardFront } from "./GachaCard";

export interface DrawnTopic {
  text: string;
  order?: number | null;
}

interface ActiveCard {
  key: number;
  topic: DrawnTopic | null; // null while the draw is in flight
}

interface CardStageProps {
  theme: string;
  deckTitle?: string;
  /** Cards left in the pile after the current one. */
  remaining: number;
  /** Resolves with the drawn topic, or rejects with a readable Error. */
  onDraw: () => Promise<DrawnTopic>;
  canDraw: boolean;
  /** Shown under the stage instead of the draw button when canDraw is false. */
  blockedNote?: React.ReactNode;
  /** Initial card to show face up (e.g. after a reload). */
  initial?: DrawnTopic | null;
}

const ANTICIPATION_MS = 520;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CardStage({ theme, deckTitle, remaining, onDraw, canDraw, blockedNote, initial }: CardStageProps) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<ActiveCard | null>(initial ? { key: 0, topic: initial } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(1);
  const liveId = useId();

  const draw = useCallback(async () => {
    if (busy || !canDraw) return;
    setBusy(true);
    setError(null);
    const key = counter.current++;
    setActive({ key, topic: null });
    try {
      const [topic] = await Promise.all([onDraw(), sleep(reduce ? 0 : ANTICIPATION_MS)]);
      setActive({ key, topic });
    } catch (e) {
      setActive(null);
      setError(e instanceof Error ? e.message : "カードを引けませんでした");
    } finally {
      setBusy(false);
    }
  }, [busy, canDraw, onDraw, reduce]);

  const pileCount = Math.min(remaining, 3);
  const shown = active?.topic ?? null;

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative grid place-items-center"
        style={{ width: CARD_WIDTH, aspectRatio: "5 / 7", perspective: "1400px" }}
      >
        {/* The pile underneath */}
        {Array.from({ length: pileCount }).map((_, i) => {
          const depth = pileCount - i; // 1 = right under the active card
          return (
            <div
              key={`pile-${i}`}
              className="absolute inset-0 shadow-[0_14px_30px_-14px_rgb(0_0_0/0.7)]"
              style={{
                transform: `translateY(${depth * 7}px) rotate(${(depth % 2 ? -1 : 1) * depth * 1.2}deg) scale(${1 - depth * 0.025})`,
                filter: `brightness(${1 - depth * 0.12})`,
              }}
              aria-hidden="true"
            >
              <CardBack theme={theme} />
            </div>
          );
        })}

        {/* Tapping the pile draws when nothing is face up yet */}
        {!active && pileCount > 0 ? (
          <button
            type="button"
            onClick={draw}
            disabled={!canDraw || busy}
            className="absolute inset-0 z-10 cursor-pointer rounded-card disabled:cursor-default"
            aria-label="山札からカードを引く"
          >
            <motion.div
              className="absolute inset-0"
              whileHover={canDraw && !reduce ? { y: -6 } : undefined}
              whileTap={canDraw && !reduce ? { scale: 0.98 } : undefined}
            >
              <CardBack theme={theme} label={deckTitle} />
            </motion.div>
          </button>
        ) : null}

        <AnimatePresence mode="popLayout">
          {active ? <ActiveCardView key={active.key} card={active} theme={theme} deckTitle={deckTitle} reduce={!!reduce} /> : null}
        </AnimatePresence>

        {!active && pileCount === 0 ? (
          <div className="absolute inset-0 grid place-items-center rounded-card border-2 border-dashed border-line px-6 text-center text-sm text-text-dim">
            カードはもうありません
          </div>
        ) : null}
      </div>

      <p id={liveId} aria-live="polite" className="sr-only">
        {shown ? `引いたカード: ${shown.text}` : ""}
      </p>

      <div className="mt-10 flex min-h-24 w-full flex-col items-center gap-3">
        {canDraw ? (
          <button type="button" className="btn-primary w-full max-w-xs text-base" onClick={draw} disabled={busy}>
            {busy ? "引いています…" : shown ? "次のカードを引く" : "カードを引く"}
          </button>
        ) : (
          blockedNote
        )}
        <p className="text-sm text-text-dim tabular-nums">山札 残り {remaining} 枚</p>
        {error ? (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ActiveCardView({
  card,
  theme,
  deckTitle,
  reduce,
}: {
  card: ActiveCard;
  theme: string;
  deckTitle?: string;
  reduce: boolean;
}) {
  const revealed = card.topic !== null;
  const t = themeOf(theme);

  // Pointer tilt + holographic sheen on the face-up card.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 180, damping: 18 });
  const sy = useSpring(py, { stiffness: 180, damping: 18 });
  const rotateX = useTransform(sy, [0, 1], [7, -7]);
  const rotateY = useTransform(sx, [0, 1], [-9, 9]);
  const holoX = useTransform(sx, [0, 1], [0, 100]);
  const holoY = useTransform(sy, [0, 1], [0, 100]);
  const holoAngle = useTransform(sx, [0, 1], [100, 140]);
  const holo = useMotionTemplate`radial-gradient(circle at ${holoX}% ${holoY}%, rgb(255 255 255 / 0.55), transparent 42%), linear-gradient(${holoAngle}deg, transparent 18%, ${t.from}33 34%, #ffd44733 46%, #3fe0b233 58%, ${t.to}33 70%, transparent 84%)`;

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (!revealed || reduce || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  }
  function onLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <motion.div
      className="absolute inset-0 z-20"
      initial={reduce ? { opacity: 0 } : { y: 0, scale: 1, opacity: 1 }}
      animate={
        reduce
          ? { opacity: 1 }
          : revealed
            ? { y: 0, scale: 1, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 18 } }
            : {
                y: -26,
                scale: 1.03,
                rotate: [0, -2.5, 2.5, -1.5, 1.5, 0],
                transition: { y: { duration: 0.25 }, rotate: { duration: 0.5, delay: 0.12 } },
              }
      }
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.15 } }
          : { x: "-115%", y: 30, rotate: -14, opacity: 0, transition: { duration: 0.42, ease: [0.4, 0, 0.6, 1] } }
      }
      style={{ perspective: 1400 }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ rotateX: revealed ? rotateX : 0, rotateY: revealed ? rotateY : 0, transformStyle: "preserve-3d" }}
      >
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          initial={{ rotateY: 180 }}
          animate={{ rotateY: revealed ? 0 : 180 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 15, mass: 0.9 }}
        >
          {/* Face */}
          <div
            className="absolute inset-0 shadow-[0_24px_50px_-18px_rgb(0_0_0/0.75)]"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            {card.topic ? (
              <>
                <CardFront theme={theme} text={card.topic.text} deckTitle={deckTitle} order={card.topic.order} />
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-card mix-blend-overlay"
                  style={{ background: holo }}
                  aria-hidden="true"
                />
                {!reduce ? <Sheen /> : null}
              </>
            ) : null}
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 shadow-[0_24px_50px_-18px_rgb(0_0_0/0.75)]"
            style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <CardBack theme={theme} label={deckTitle} />
          </div>
        </motion.div>
      </motion.div>
      {revealed && !reduce ? <Burst colors={[t.from, t.to, "#ffd447", "#3fe0b2", "#ffffff"]} /> : null}
    </motion.div>
  );
}

/** One streak of light across the card right after it turns over. */
function Sheen() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-card" aria-hidden="true">
      <motion.div
        className="absolute inset-y-[-20%] w-1/3 rotate-[18deg] bg-gradient-to-r from-transparent via-white/70 to-transparent"
        initial={{ x: "-160%" }}
        animate={{ x: "420%" }}
        transition={{ duration: 0.9, delay: 0.35, ease: [0.3, 0, 0.2, 1] }}
      />
    </div>
  );
}

const BURST = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2 + (i % 2 ? 0.12 : -0.08);
  const dist = 150 + ((i * 37) % 70);
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 1.15, size: 6 + ((i * 13) % 8), round: i % 3 !== 0 };
});

/** Confetti that bursts from behind the card as it lands. */
function Burst({ colors }: { colors: string[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      {BURST.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-1/2 left-1/2"
          style={{
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            borderRadius: p.round ? 999 : 2,
            background: colors[i % colors.length],
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1, rotate: i * 40 }}
          transition={{ duration: 0.95, delay: 0.18, ease: [0.1, 0.8, 0.3, 1] }}
        />
      ))}
    </div>
  );
}
