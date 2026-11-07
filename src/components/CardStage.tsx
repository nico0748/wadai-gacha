"use client";

import {
  animate,
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { themeOf } from "@/lib/decks/themes";
import { CardBack, CardFront } from "./GachaCard";

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
  /** Shown instead of the draw button when canDraw is false. */
  blockedNote?: React.ReactNode;
  /** Initial card to show face up (e.g. after a reload). */
  initial?: DrawnTopic | null;
}

/** The lift + tremble before the flip; long enough to feel, short enough not to drag. */
const ANTICIPATION_MS = 640;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CardStage({ theme, deckTitle, remaining, onDraw, canDraw, blockedNote, initial }: CardStageProps) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<ActiveCard | null>(initial ? { key: 0, topic: initial } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [everShown, setEverShown] = useState(Boolean(initial));
  const counter = useRef(1);
  const busyRef = useRef(false);
  const t = themeOf(theme);

  const draw = useCallback(async () => {
    if (busyRef.current || !canDraw) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const key = counter.current++;
    setActive({ key, topic: null });
    try {
      const [topic] = await Promise.all([onDraw(), sleep(reduce ? 0 : ANTICIPATION_MS)]);
      setActive({ key, topic });
      setEverShown(true);
      if (!reduce) navigator.vibrate?.([12, 60, 24]);
    } catch (e) {
      setActive(null);
      setError(e instanceof Error ? e.message : "カードを引けませんでした");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [canDraw, onDraw, reduce]);

  const pileCount = Math.min(remaining, 3);
  const shown = active?.topic ?? null;
  const lifting = active !== null && active.topic === null;

  return (
    <div className="flex w-full flex-col items-center gap-x-10 short-landscape:flex-row short-landscape:justify-center">
      <div className="card-size relative isolate grid aspect-[5/7] place-items-center" style={{ perspective: "1400px" }}>
        {/* The lamp over the table brightens while a card is in the air. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[45%] -z-10 rounded-full"
          style={{ background: `radial-gradient(closest-side, ${t.from}55, rgb(255 214 140 / 0.25) 45%, transparent 75%)` }}
          initial={false}
          animate={{ opacity: reduce ? 0.35 : lifting ? 0.9 : shown ? 0.55 : 0.3, scale: lifting ? 1.08 : 1 }}
          transition={{ duration: lifting ? 0.5 : 0.9 }}
        />

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
            disabled={!canDraw}
            className="absolute inset-0 z-10 cursor-pointer rounded-card disabled:cursor-default"
            aria-label="山札からカードを引く"
          >
            <motion.div
              className="absolute inset-0"
              whileHover={canDraw && !reduce ? { y: -6 } : undefined}
              whileTap={canDraw && !reduce ? { scale: 0.98, y: 4 } : undefined}
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

      <p aria-live="polite" className="sr-only">
        {shown ? `引いたカード: ${shown.text}` : ""}
      </p>

      <div className="mt-10 flex min-h-24 w-full max-w-xs flex-col items-center gap-3 short-landscape:mt-0">
        {canDraw ? (
          <button
            type="button"
            className={`btn-primary w-full text-base ${busy ? "pointer-events-none" : ""}`}
            onClick={draw}
            aria-disabled={busy}
          >
            {everShown ? "次のカードを引く" : "カードを引く"}
          </button>
        ) : busy ? null : (
          <div className={`flex w-full justify-center ${active ? "note-in" : ""}`}>{blockedNote}</div>
        )}
        <p className="text-sm text-text-dim tabular-nums">残り{remaining}枚</p>
        {error ? (
          <p role="alert" className="text-center text-sm font-bold text-danger">
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

  // Tilt + holographic glare. Follows a mouse; on phones it sweeps once by itself.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 160, damping: 18 });
  const sy = useSpring(py, { stiffness: 160, damping: 18 });
  const rotateX = useTransform(sy, [0, 1], [7, -7]);
  const rotateY = useTransform(sx, [0, 1], [-9, 9]);
  const holoX = useTransform(sx, [0, 1], [0, 100]);
  const holoY = useTransform(sy, [0, 1], [0, 100]);
  const holoAngle = useTransform(sx, [0, 1], [60, 160]);
  const holo = useMotionTemplate`radial-gradient(circle at ${holoX}% ${holoY}%, rgb(255 255 255 / 0.5), transparent 40%), linear-gradient(${holoAngle}deg, transparent 15%, ${t.from}40 32%, #ffd44740 44%, #3fe0b240 56%, ${t.to}40 68%, transparent 85%)`;

  useEffect(() => {
    if (!revealed || reduce) return;
    const a = animate(px, [0.05, 0.95, 0.5], { duration: 1.3, delay: 0.45, ease: "easeInOut" });
    const b = animate(py, [0.2, 0.8, 0.5], { duration: 1.3, delay: 0.45, ease: "easeInOut" });
    return () => {
      a.stop();
      b.stop();
    };
  }, [revealed, reduce, px, py]);

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
      className="absolute inset-0"
      initial={reduce ? { opacity: 0, zIndex: 20 } : { y: 0, scale: 1, zIndex: 20 }}
      animate={
        reduce
          ? { opacity: 1 }
          : revealed
            ? {
                y: 0,
                scale: [1.07, 1],
                rotateX: 0,
                rotate: 0,
                transition: { type: "spring", stiffness: 260, damping: 17 },
              }
            : {
                y: [0, 4, -40],
                scale: [1, 0.98, 1.06],
                rotateX: [0, 0, 8],
                rotate: [0, -0.8, 0.8, -0.8, 0.8, -0.5, 0.5, 0],
                transition: {
                  y: { duration: 0.42, times: [0, 0.3, 1], ease: "easeOut" },
                  scale: { duration: 0.42, times: [0, 0.3, 1] },
                  rotateX: { duration: 0.42, times: [0, 0.3, 1] },
                  rotate: { duration: 0.5, delay: 0.38, repeat: Infinity },
                },
              }
      }
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.15 } }
          : {
              zIndex: 30,
              x: "38%",
              y: "70%",
              rotate: 16,
              scale: 0.55,
              opacity: 0,
              transition: { duration: 0.32, ease: [0.5, 0, 0.9, 0.6] },
            }
      }
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
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 20 }}
        >
          {/* Face */}
          <div
            className="absolute inset-0 rounded-card shadow-[0_26px_54px_-18px_rgb(0_0_0/0.8)]"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            {card.topic ? (
              <>
                <CardFront theme={theme} text={card.topic.text} deckTitle={deckTitle} order={card.topic.order} />
                {!reduce ? (
                  <>
                    <motion.div
                      className="pointer-events-none absolute inset-0 rounded-card mix-blend-soft-light"
                      style={{ background: holo }}
                      aria-hidden="true"
                    />
                    <Sheen />
                  </>
                ) : null}
              </>
            ) : null}
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-card shadow-[0_26px_54px_-18px_rgb(0_0_0/0.8)]"
            style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <CardBack theme={theme} label={deckTitle} />
          </div>
        </motion.div>
      </motion.div>
      {revealed && !reduce ? <Confetti colors={[t.from, t.to, "#ffd447", "#3fe0b2", "#fffaf0"]} /> : null}
    </motion.div>
  );
}

/** One streak of light across the card right after it turns over. */
function Sheen() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-card" aria-hidden="true">
      <motion.div
        className="absolute inset-y-[-25%] w-[38%] rotate-[18deg] bg-gradient-to-r from-transparent via-white/75 to-transparent"
        initial={{ x: "-170%" }}
        animate={{ x: "380%" }}
        transition={{ duration: 0.85, delay: 0.3, ease: [0.3, 0, 0.2, 1] }}
      />
    </div>
  );
}

// Deterministic so server and client agree; spread like a fountain, then gravity.
const PIECES = Array.from({ length: 30 }, (_, i) => {
  const spread = ((i * 47) % 100) / 100; // 0..1
  const angle = -Math.PI / 2 + (spread - 0.5) * Math.PI * 1.25;
  const power = 170 + ((i * 61) % 120);
  const x = Math.cos(angle) * power;
  const up = Math.sin(angle) * power;
  return { x, up, fall: up + 260 + ((i * 29) % 140), spin: (i % 2 ? 1 : -1) * (240 + ((i * 53) % 360)), w: 7 + (i % 4) * 2 };
});

/** Two-tone capsules that pop out over the card as it lands. Unmounts when done. */
function Confetti({ colors }: { colors: string[] }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 1900);
    return () => clearTimeout(id);
  }, []);
  if (done) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
      {PIECES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-[42%] left-1/2 overflow-hidden rounded-full"
          style={{ width: p.w * 2, height: p.w, background: "#fffaf0", marginLeft: -p.w, marginTop: -p.w / 2 }}
          initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.5 }}
          animate={{
            x: [0, p.x * 0.7, p.x],
            y: [0, p.up, p.fall],
            opacity: [0, 1, 1, 0],
            rotate: p.spin,
            scale: 1,
          }}
          transition={{
            duration: 1.45,
            delay: 0.16 + (i % 5) * 0.015,
            x: { duration: 1.45, ease: "easeOut" },
            y: { duration: 1.45, times: [0, 0.32, 1], ease: ["easeOut", "easeIn"] },
            opacity: { duration: 1.45, times: [0, 0.05, 0.75, 1] },
          }}
        >
          <span className="absolute inset-y-0 left-0 w-1/2" style={{ background: colors[i % colors.length] }} />
        </motion.span>
      ))}
    </div>
  );
}
