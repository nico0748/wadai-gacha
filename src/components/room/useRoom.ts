"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api, ApiError } from "@/lib/client/api";
import {
  parseRoomSession,
  readRoomSessionRaw,
  saveRoomSession,
  subscribeStorage,
  type RoomSession,
} from "@/lib/client/storage";
import type { RoomUnchanged, RoomView } from "@/lib/rooms/types";
import { useMsUntil } from "./countdown";

export type RoomLoad =
  | { kind: "loading" }
  | { kind: "no-session" }
  | { kind: "gone"; message: string }
  | { kind: "ready"; view: RoomView };

/**
 * collecting: posting topics
 * drawing:    the host is turning cards
 * held:       ended, the list waits for the host's せーの
 * answers:    released; a named room still hides some authors
 * done:       nothing left to change
 */
export type RoomPhase = "collecting" | "drawing" | "held" | "answers" | "done";

export function phaseOf(view: RoomView): RoomPhase {
  if (view.room.status === "collecting") return "collecting";
  if (view.room.status === "drawing") return "drawing";
  if (!view.reveal) return "held";
  if (view.room.nameMode === "named" && view.room.authorsShown < view.reveal.length) return "answers";
  return "done";
}

/** A steady per-device delay in [0, spread), so phones in one room do not poll in step. */
export function jitterFor(seed: string | undefined, spread: number): number {
  let h = 0;
  for (const ch of seed ?? "") h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % spread;
}

/** Whether a held list's reveal time has come, by this device's clock corrected to the server's. */
function releaseDue(view: RoomView, offsetMs: number): boolean {
  return (
    view.room.status === "ended" &&
    view.reveal === null &&
    view.revealAt !== null &&
    Date.parse(view.revealAt) <= Date.now() + offsetMs
  );
}

interface Options {
  /**
   * How often to poll for the current view, or null to stop. `due` turns
   * true once a held list's reveal time has come.
   */
  pollMs: (view: RoomView | null, due: boolean) => number | null;
  /** Stop polling, e.g. while a host link is being checked. */
  paused?: boolean;
}

/**
 * Keeps one device's view of a room fresh. Polls send the version they
 * already have, so an unchanged room costs the server one small read.
 *
 * `session` is undefined during server rendering, null when this device has
 * not joined the room. `clockOffset` is the server clock minus this
 * device's, for countdowns that end at the same moment on every phone.
 */
export function useRoom(code: string, { pollMs, paused = false }: Options) {
  const raw = useSyncExternalStore(
    subscribeStorage,
    () => readRoomSessionRaw(code),
    () => undefined,
  );
  const session = useMemo<RoomSession | null | undefined>(
    () => (raw === undefined ? undefined : parseRoomSession(raw)),
    [raw],
  );
  const [fetched, setFetched] = useState<RoomLoad>({ kind: "loading" });
  const [offline, setOffline] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  // Bumped by every local update; a poll that started earlier is stale.
  const epoch = useRef(0);
  // While a mutation (draw, start, end) is in flight, its own result wins.
  const pending = useRef(0);
  // The newest view and whose token it was read with, for the next poll's ?v=.
  const latest = useRef<{ view: RoomView | null; token: string | null; offset: number }>({
    view: null,
    token: null,
    offset: 0,
  });
  const token = session?.token;
  const currentToken = useRef(token);
  useEffect(() => {
    if (currentToken.current !== token) epoch.current++;
    currentToken.current = token;
  }, [token]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const startedAt = epoch.current;
    const stale = () => epoch.current !== startedAt || pending.current > 0 || currentToken.current !== session.token;
    const known = latest.current.token === session.token ? latest.current.view : null;
    // Ask only for changes, except when a held list is due: that needs the full view.
    const query = known && !releaseDue(known, latest.current.offset) ? `?v=${known.version}` : "";
    const sentAt = Date.now();
    try {
      const res = await api<RoomView | RoomUnchanged>(`/api/rooms/${encodeURIComponent(code)}${query}`, {
        token: session.token,
      });
      if (stale()) return;
      setOffline(false);
      if ("unchanged" in res) return;
      // The server read its clock about halfway through the round trip.
      const offset = Date.parse(res.serverNow) - (sentAt + Date.now()) / 2;
      latest.current = { view: res, token: session.token, offset };
      setClockOffset(Math.round(offset));
      setFetched({ kind: "ready", view: res });
    } catch (e) {
      if (stale()) return;
      if (e instanceof ApiError && e.status === 404) setFetched({ kind: "gone", message: e.message });
      else if (e instanceof ApiError && e.status === 401) setFetched({ kind: "no-session" });
      else setOffline(true);
    }
  }, [code, session]);

  const state: RoomLoad = session === null ? { kind: "no-session" } : fetched;
  const view = state.kind === "ready" ? state.view : null;
  const heldUntil = view && view.room.status === "ended" && !view.reveal ? view.revealAt : null;
  const msLeft = useMsUntil(heldUntil, clockOffset);
  const due = msLeft !== null && msLeft <= 0;
  const interval = pollMs(view, due);
  const live =
    Boolean(session) && !paused && state.kind !== "gone" && state.kind !== "no-session" && interval !== null;
  usePolling(refresh, interval ?? 60_000, live);

  const join = useCallback(
    (s: RoomSession) => {
      epoch.current++;
      latest.current = { view: null, token: null, offset: 0 };
      setFetched({ kind: "loading" });
      saveRoomSession(code, s);
    },
    [code],
  );

  /** Shows a view built locally from a mutation's answer. */
  const setView = useCallback((v: RoomView) => {
    epoch.current++;
    latest.current = { ...latest.current, view: v };
    setFetched({ kind: "ready", view: v });
  }, []);

  /** Runs a change to the room; polls that land meanwhile are ignored. */
  const mutate = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    pending.current++;
    epoch.current++;
    try {
      return await fn();
    } finally {
      pending.current--;
      epoch.current++;
    }
  }, []);

  return { session, state, refresh, offline, join, setView, mutate, clockOffset, due };
}
