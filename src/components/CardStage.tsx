"use client";

import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { themeOf } from "@/lib/decks/themes";
import { CardBack, CardFront } from "./GachaCard";

export interface DrawnTopic {
  text: string;
  order?: number | null;
  /** A rare draw (see src/lib/rarity.ts) gets the gold treatment. */
  rare?: boolean;
}

interface ActiveCard {
  key: number;
  topic: DrawnTopic | null; // null while the draw is in flight
  /** The result is back and rare: the lifted card glows gold before it turns. */
  charged?: boolean;
  /** Turned over by a draw just now; false for the card restored after a reload. */
  fresh: boolean;
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
/** The first draw of a visit takes its time, so the table sees how it works. */
const FIRST_ANTICIPATION_MS = 900;
/** A rare draw trembles this much longer once the result is in. */
const RARE_EXTRA_MS = 400;
/** The earliest the lifted card turns gold: once the lift has settled. */
const GOLD_AFTER_MS = 380;
/** How high the card rises and how much it grows while in the air, and the pop as it lands. */
const LIFT = { y: -40, scale: 1.06, chargedY: -44, chargedScale: 1.09, land: 1.07, rareLand: 1.14 };
/** In short landscape the card is nearly as tall as the screen: a smaller lift keeps its top (and the gold) in view. */
const LOW_LIFT = { y: -12, scale: 1.02, chargedY: -14, chargedScale: 1.03, land: 1.03, rareLand: 1.05 };
const BUZZ = [12, 60, 24];
const RARE_BUZZ = [30, 50, 30, 50, 140];
const LAMP = "var(--color-lamp)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Whether a card has been turned over since the page loaded (survives a reshuffle). */
let drewThisVisit = false;

/** A phone lying sideways (the short-landscape variant in globals.css): the card is nearly as tall as the screen. */
const SHORT_LANDSCAPE = "(orientation: landscape) and (max-height: 540px)";

function useShortLandscape(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(SHORT_LANDSCAPE);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(SHORT_LANDSCAPE).matches,
    () => false,
  );
}

export function CardStage({ theme, deckTitle, remaining, onDraw, canDraw, blockedNote, initial }: CardStageProps) {
  const reduce = useReducedMotion();
  const low = useShortLandscape();
  const [active, setActive] = useState<ActiveCard | null>(initial ? { key: 0, topic: initial, fresh: false } : null);
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
    setActive({ key, topic: null, fresh: true });
    const lift = reduce ? 0 : drewThisVisit ? ANTICIPATION_MS : FIRST_ANTICIPATION_MS;
    const started = Date.now();
    try {
      // The card is already in the air while the draw is in flight; rarity is
      // only known once the result is back, so the gold starts then (but not
      // before the lift has read as an ordinary one, so it comes as a surprise).
      const topic = await onDraw();
      const rare = Boolean(topic.rare) && !reduce;
      if (rare) {
        await sleep(Math.max(0, GOLD_AFTER_MS - (Date.now() - started)));
        setActive({ key, topic: null, charged: true, fresh: true });
      }
      await sleep(Math.max(0, lift - (Date.now() - started)) + (rare ? RARE_EXTRA_MS : 0));
      setActive({ key, topic, fresh: true });
      setEverShown(true);
      drewThisVisit = true;
      if (!reduce) navigator.vibrate?.(rare ? RARE_BUZZ : BUZZ);
    } catch (e) {
      setActive(null);
      setError(e instanceof Error ? e.message : "カードを引けませんでした");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [canDraw, onDraw, reduce]);

  const pileCount = remaining <= 0 ? 0 : Math.min(7, Math.ceil(remaining / 4));
  const shown = active?.topic ?? null;
  const lifting = active !== null && active.topic === null;
  const golden = !reduce && Boolean(active?.charged || shown?.rare);
  // Rays and confetti for a card that has just turned over (not one restored after a reload).
  const celebrate = shown && active?.fresh && !reduce ? { key: active.key, rare: Boolean(shown.rare) } : null;

  return (
    <div className="flex w-full flex-col items-center gap-x-10 short-landscape:flex-row short-landscape:justify-center">
      <div className="card-size relative isolate grid aspect-[5/7] place-items-center" style={{ perspective: "1400px" }}>
        {/* The lamp over the table brightens while a card is in the air, and turns gold for a rare one. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[45%] -z-10 rounded-full"
          style={{
            background: golden
              ? `radial-gradient(closest-side, color-mix(in srgb, ${LAMP} 60%, transparent), color-mix(in srgb, ${LAMP} 30%, transparent) 45%, transparent 75%)`
              : `radial-gradient(closest-side, color-mix(in srgb, ${t.from} 33%, transparent), color-mix(in srgb, ${LAMP} 25%, transparent) 45%, transparent 75%)`,
          }}
          initial={false}
          animate={{
            opacity: reduce ? 0.35 : active?.charged ? 1 : lifting ? 0.9 : shown ? 0.55 : 0.3,
            scale: active?.charged ? 1.16 : lifting ? 1.08 : 1,
          }}
          transition={{ duration: lifting ? 0.5 : 0.9 }}
        />

        {celebrate ? <Rays key={`rays-${celebrate.key}`} color={celebrate.rare ? LAMP : t.from} /> : null}

        {/* The pile underneath: one sliver per few cards, so a full deck looks thick. */}
        {Array.from({ length: pileCount }).map((_, i) => {
          const depth = pileCount - i; // 1 = right under the active card
          return (
            <div
              key={`pile-${i}`}
              className="absolute inset-0 rounded-card"
              style={{
                // Only the edges show below the top card, so they are plain card stock.
                background: `linear-gradient(150deg, ${t.from}, ${t.to})`,
                transform: `translate(${(depth % 2 ? -1 : 1) * Math.min(depth, 3) * 0.35}px, ${depth * 3.2}px) rotate(${((depth % 3) - 1) * 0.5}deg)`,
                filter: `brightness(${1 - depth * 0.07})`,
                boxShadow:
                  depth === pileCount
                    ? "0 18px 34px -14px rgb(0 0 0 / 0.75), inset 0 -1.5px 0 color-mix(in srgb, var(--color-paper) 45%, transparent)"
                    : "inset 0 -1.5px 0 color-mix(in srgb, var(--color-paper) 45%, transparent)",
              }}
              aria-hidden="true"
            />
          );
        })}

        {/* Tapping the pile draws when nothing is face up yet. The button below does the
            same for keyboards and screen readers, so this one stays out of their way. */}
        {!active && pileCount > 0 ? (
          <button
            type="button"
            onClick={draw}
            disabled={!canDraw}
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 z-10 cursor-pointer rounded-card disabled:cursor-default"
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

        {celebrate ? (
          <Confetti
            key={`confetti-${celebrate.key}`}
            rare={celebrate.rare}
            // Colours that read on the dark table and against any deck's frame (not the deck's darker `to`).
            colors={celebrate.rare ? GOLD : [t.from, LAMP, PAPER, ACCENT]}
          />
        ) : null}

        <AnimatePresence mode="popLayout">
          {active ? (
            <ActiveCardView key={active.key} card={active} theme={theme} deckTitle={deckTitle} reduce={!!reduce} low={low} />
          ) : null}
        </AnimatePresence>

        {!active && pileCount === 0 ? (
          <div className="absolute inset-0 grid place-items-center rounded-card border-2 border-dashed border-line px-6 text-center text-sm text-text-dim">
            カードはもうありません
          </div>
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {shown ? `引いたカード${shown.rare ? "（レア）" : ""}: ${shown.text}` : ""}
      </p>

      <div className="relative mt-10 flex min-h-24 w-full max-w-xs flex-col items-center gap-3 short-landscape:mt-0">
        {canDraw ? (
          <button
            type="button"
            className={`btn-primary w-full text-base ${busy ? "pointer-events-none" : ""}`}
            onClick={draw}
            aria-disabled={busy}
          >
            {everShown ? "次のカードをめくる" : "カードをめくる"}
          </button>
        ) : busy ? null : (
          <div className={`flex w-full justify-center ${active ? "note-in" : ""}`}>{blockedNote}</div>
        )}
        {canDraw || remaining > 0 ? <p className="text-sm text-text-dim tabular-nums">残り{remaining}枚</p> : null}
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
  low,
}: {
  card: ActiveCard;
  theme: string;
  deckTitle?: string;
  reduce: boolean;
  /** Short landscape: the card is nearly as tall as the screen, so it lifts and grows less. */
  low: boolean;
}) {
  const revealed = card.topic !== null;
  const rare = Boolean(card.topic?.rare);
  const charged = Boolean(card.charged);
  const lift = low ? LOW_LIFT : LIFT;

  // Tilt that follows a mouse; on phones the card rocks once by itself after it lands.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 160, damping: 18 });
  const sy = useSpring(py, { stiffness: 160, damping: 18 });
  const rotateX = useTransform(sy, [0, 1], [7, -7]);
  const rotateY = useTransform(sx, [0, 1], [-9, 9]);

  useEffect(() => {
    if (!revealed || reduce || !card.fresh) return;
    const a = animate(px, [0.5, 0.15, 0.85, 0.5], { duration: 1.2, delay: 0.5, ease: "easeInOut" });
    const b = animate(py, [0.5, 0.3, 0.7, 0.5], { duration: 1.2, delay: 0.5, ease: "easeInOut" });
    return () => {
      a.stop();
      b.stop();
    };
  }, [revealed, reduce, card.fresh, px, py]);

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
      initial={reduce || !card.fresh ? { opacity: 0, zIndex: 20 } : { y: 0, scale: 1, zIndex: 20 }}
      animate={
        reduce || !card.fresh
          ? { opacity: 1 }
          : revealed
            ? {
                y: 0,
                x: 0,
                scale: rare ? [lift.rareLand, 1] : [lift.land, 1],
                rotateX: 0,
                rotate: 0,
                transition: { type: "spring", stiffness: 260, damping: rare ? 13 : 17 },
              }
            : charged
              ? {
                  // Higher, brighter and shakier: something good is coming.
                  y: lift.chargedY,
                  scale: lift.chargedScale,
                  rotateX: 8,
                  x: [0, -1.5, 1.5, -1.5, 1.5, 0],
                  rotate: [0, -1.6, 1.6, -1.6, 1.6, -1, 1, 0],
                  transition: {
                    y: { duration: 0.25, ease: "easeOut" },
                    scale: { duration: 0.25 },
                    x: { duration: 0.3, repeat: Infinity },
                    rotate: { duration: 0.34, repeat: Infinity },
                  },
                }
              : {
                  y: [0, 4, lift.y],
                  scale: [1, 0.98, lift.scale],
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
          initial={{ rotateY: revealed && !card.fresh ? 0 : 180 }}
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
                <CardFront theme={theme} text={card.topic.text} deckTitle={deckTitle} order={card.topic.order} rare={rare} />
                {rare && !reduce && card.fresh ? <Sheen /> : null}
              </>
            ) : null}
          </div>
          {/* Back */}
          <div
            className={`absolute inset-0 rounded-card shadow-[0_26px_54px_-18px_rgb(0_0_0/0.8)] ${charged ? "charge-glow" : ""}`}
            style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            <CardBack theme={theme} label={deckTitle} />
            {!revealed && !reduce ? (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-card" aria-hidden="true">
                <div className={`absolute inset-0 ${charged ? "holo-sweep-gold" : "holo-sweep"}`} />
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

/** One streak of light across the gold foil right after a rare card turns over. */
function Sheen() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-card" aria-hidden="true">
      <motion.div
        className="absolute inset-y-[-25%] w-[38%] rotate-[18deg] bg-gradient-to-r from-transparent via-white/80 to-transparent mix-blend-overlay"
        initial={{ x: "-170%" }}
        animate={{ x: "380%" }}
        transition={{ duration: 0.85, delay: 0.3, ease: [0.3, 0, 0.2, 1] }}
      />
    </div>
  );
}

/** Light bursting from behind a card as it turns over. Unmounts when done. */
function Rays({ color }: { color: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 700);
    return () => clearTimeout(id);
  }, []);
  if (done) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute -inset-[60%] -z-[5] rounded-full"
      style={{
        background: `repeating-conic-gradient(from 0deg, color-mix(in srgb, ${color} 60%, transparent) 0deg 3.5deg, transparent 6deg 15deg)`,
        maskImage: "radial-gradient(closest-side, black 35%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(closest-side, black 35%, transparent 100%)",
      }}
      initial={{ rotate: 0, scale: 0.6, opacity: 0 }}
      animate={{ rotate: 40, scale: 1.4, opacity: [0, 1, 1, 0] }}
      transition={{ duration: 0.6, ease: "easeOut", opacity: { duration: 0.6, times: [0, 0.15, 0.55, 1] } }}
    />
  );
}

const PAPER = "var(--color-paper)";
const ACCENT = "var(--color-accent)";
const GOLD = [LAMP, "var(--color-foil-light)", PAPER, LAMP, "var(--color-foil-deep)"];

/** Seconds each piece is in the air. */
const FLIGHT = 1.7;
/** The pieces off the top fly in front of the card this long, then behind it (they are clear of it by then). */
const FRONT_S = 0.2;
const SWAP = FRONT_S / FLIGHT;

/** Deterministic noise, so server and client agree and every draw looks the same amount of random. */
function noise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Confetti that pops out from the card's edges and stays close to it: on a
 * phone the card fills the width, so the table shows only in narrow strips
 * beside it and above it. A third burst off the top edge, in front of the
 * card at first so they read; the rest come from behind the long sides. Then
 * gravity takes them down behind and beside the card. Start positions are in
 * % of the card, distances in px.
 */
function makePieces(count: number, salt: number) {
  return Array.from({ length: count }, (_, i) => {
    const r = (k: number) => noise(i * 7.13 + k * 1.37 + salt);
    const side = i % 3 === 2 ? "top" : i % 2 ? "right" : "left";
    const top = side === "top";
    const along = 0.08 + r(1) * 0.84;
    const up = top ? -(34 + r(4) * 34) : -(30 + r(4) * 130);
    return {
      top,
      sx: top ? along * 100 : side === "left" ? 2 : 98,
      sy: top ? 0 : 10 + along * 80,
      x: top ? (along - 0.5) * 90 : (side === "left" ? -1 : 1) * (12 + r(2) * 26),
      up,
      fall: up + (top ? 180 : 250) + r(7) * 160,
      spin: (r(8) < 0.5 ? 1 : -1) * (200 + r(9) * 420),
      grain: r(5),
      round: r(6) < 0.3,
      flutter: 0.35 + r(10) * 0.3,
      delay: 0.08 + r(11) * 0.12,
    };
  });
}
type PieceSpec = ReturnType<typeof makePieces>[number];
const PIECES = makePieces(48, 0);
const RARE_PIECES = makePieces(72, 31);

/** How far the pieces may fly sideways: the table beside the card, 36px of it per step. */
function sideReach() {
  const vw = window.innerWidth;
  const room = (vw - Math.min(vw * 0.84, 384)) / 2;
  return Math.min(3.5, Math.max(1, room / 36));
}

function Confetti({ colors, rare }: { colors: string[]; rare: boolean }) {
  const [done, setDone] = useState(false);
  // Only ever mounted by a draw in the browser, never on the server. On a
  // narrow screen the pieces are bigger, since only a little of each shows.
  const [view] = useState(() => ({ reach: sideReach(), big: window.innerWidth < 640 }));
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 2100);
    return () => clearTimeout(id);
  }, []);
  if (done) return null;
  const pieces = rare ? RARE_PIECES : PIECES;
  const piece = (p: PieceSpec, i: number, front: boolean) => (
    <Piece key={i} p={p} color={colors[i % colors.length]} reach={view.reach} big={view.big} front={front} />
  );
  return (
    <>
      {/* Under the active card (z-20), over the pile. */}
      <div className="pointer-events-none absolute inset-0 z-[15]" aria-hidden="true">
        {pieces.map((p, i) => piece(p, i, false))}
      </div>
      {/* The same pieces off the top, over the card for their first FRONT_S. */}
      <div className="pointer-events-none absolute inset-0 z-[25]" aria-hidden="true">
        {pieces.map((p, i) => (p.top ? piece(p, i, true) : null))}
      </div>
    </>
  );
}

function Piece({ p, color, reach, big, front }: { p: PieceSpec; color: string; reach: number; big: boolean; front: boolean }) {
  const size = (big ? 12 : 10) + Math.round(p.grain * 6); // 12–18px on a phone, 10–16px wider
  const w = p.round ? size * 0.7 : size;
  const h = p.round ? size * 0.7 : Math.max(5, size * 0.45);
  // A piece off the top shows in front until SWAP, then its copy behind the card takes over.
  const opacity = front ? [0, 1, 1, 0, 0] : p.top ? [0, 0, 1, 1, 0] : [0, 1, 1, 0];
  const times = front ? [0, 0.04, SWAP, SWAP + 0.005, 1] : p.top ? [0, SWAP, SWAP + 0.005, 0.72, 1] : [0, 0.04, 0.72, 1];
  return (
    <motion.span
      className={`absolute ${p.round ? "rounded-full" : "rounded-[2px]"}`}
      style={{
        left: `${p.sx}%`,
        top: `${p.sy}%`,
        width: w,
        height: h,
        marginLeft: -w / 2,
        marginTop: -h / 2,
        background: color,
      }}
      initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scaleY: 1 }}
      animate={{
        x: [0, p.x * reach * 0.75, p.x * reach],
        y: [0, p.up, p.fall],
        opacity,
        rotate: p.spin,
        scaleY: [1, -1, 1, -1, 1],
      }}
      transition={{
        x: { duration: FLIGHT, delay: p.delay, ease: "easeOut" },
        y: { duration: FLIGHT, delay: p.delay, times: [0, 0.3, 1], ease: ["easeOut", "easeIn"] },
        opacity: { duration: FLIGHT, delay: p.delay, times },
        rotate: { duration: FLIGHT, delay: p.delay, ease: "linear" },
        scaleY: { duration: p.flutter * 4, delay: p.delay, ease: "linear" },
      }}
    />
  );
}
