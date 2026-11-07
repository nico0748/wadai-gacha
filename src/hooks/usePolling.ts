"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `fn` now and then every `intervalMs` while `enabled`, pausing while
 * the tab is hidden and catching up as soon as it is visible again. Only one
 * call is ever in flight.
 */
export function usePolling(fn: () => void | Promise<void>, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let running = false;

    const tick = async () => {
      if (stopped || running) return;
      clearTimeout(timer);
      running = true;
      try {
        if (document.visibilityState === "visible") await fnRef.current();
      } catch {
        /* the caller surfaces errors; keep polling */
      } finally {
        running = false;
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };

    void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, enabled]);
}
