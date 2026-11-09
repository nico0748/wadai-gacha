"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Milliseconds until `at` (an ISO time on the server's clock), given
 * `offsetMs` = server clock minus this device's clock. Wakes up once when
 * `at` passes, and every `step` ms during the last `near` ms. Null when
 * there is nothing to wait for.
 */
export function useMsUntil(at: string | null, offsetMs: number, near = 0, step = 100): number | null {
  const [state, setState] = useState<{ at: string; ms: number } | null>(null);
  useEffect(() => {
    if (!at) return;
    const target = Date.parse(at) - offsetMs;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const ms = target - Date.now();
      setState({ at, ms });
      if (ms <= 0) return;
      timer = setTimeout(tick, ms > near ? ms - near : Math.min(step, ms));
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [at, offsetMs, near, step]);
  return state !== null && state.at === at ? state.ms : null;
}

/** Shown from this long before the release. */
const SHOW_FROM_MS = 5_500;

/**
 * The せーの: a full-screen 3, 2, 1 on every phone, timed by the server's
 * clock, after which the list opens everywhere at once.
 */
export function RevealCountdown({ revealAt, offsetMs }: { revealAt: string | null; offsetMs: number }) {
  const reduce = useReducedMotion();
  const ms = useMsUntil(revealAt, offsetMs, SHOW_FROM_MS + 500, 100);
  if (ms === null || ms > SHOW_FROM_MS) return null;

  const step = ms > 3000 ? "ready" : ms > 0 ? String(Math.ceil(ms / 1000)) : "open";
  return (
    <div
      role="status"
      className="fixed inset-0 z-50 grid place-items-center bg-ink/88 px-6 text-center backdrop-blur-sm"
    >
      <div className="grid justify-items-center gap-4">
        <p className="text-lg font-black text-text-dim">みんなで一緒に公開します</p>
        <div className="grid h-[clamp(8rem,42vw,13rem)] place-items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={step}
              initial={reduce ? false : { scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 20 }}
              className={`font-display leading-none text-lamp tabular-nums ${
                step === "ready" || step === "open"
                  ? "text-[clamp(2.6rem,13vw,4.5rem)]"
                  : "text-[clamp(7rem,40vw,12rem)]"
              }`}
            >
              {step === "ready" ? "せーの" : step === "open" ? "オープン！" : step}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
