"use client";

import { useEffect } from "react";

/**
 * Keeps the screen on while `active`, so a phone lying on the table does not
 * lock in the middle of a game. Browsers drop the lock when the tab is
 * hidden, so it is requested again when the tab comes back. Silently does
 * nothing where the Screen Wake Lock API is missing.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const request = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (stopped) void next.release();
        else lock = next;
      } catch {
        /* denied (battery saver, unsupported context): not worth surfacing */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && (!lock || lock.released)) void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
