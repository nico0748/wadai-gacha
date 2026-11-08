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
import type { RoomView } from "@/lib/rooms/types";

export type RoomLoad =
  | { kind: "loading" }
  | { kind: "no-session" }
  | { kind: "gone"; message: string }
  | { kind: "ready"; view: RoomView };

interface Options {
  pollMs: (view: RoomView | null) => number;
  /** Stop polling, e.g. while the host is still looking at the last card. */
  paused?: boolean;
}

/**
 * Keeps one device's view of a room fresh. Polls while the room is live;
 * once it has ended the final view is kept and polling stops.
 *
 * `session` is undefined during server rendering, null when this device has
 * not joined the room.
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
  // Bumped by every local update; a poll that started earlier is stale.
  const version = useRef(0);
  // While a mutation (draw, start, end) is in flight, its own result wins.
  const pending = useRef(0);
  const token = session?.token;
  const currentToken = useRef(token);
  useEffect(() => {
    if (currentToken.current !== token) version.current++;
    currentToken.current = token;
  }, [token]);

  const refresh = useCallback(async () => {
    if (!session) return;
    const startedAt = version.current;
    const stale = () => version.current !== startedAt || pending.current > 0 || currentToken.current !== session.token;
    try {
      const view = await api<RoomView>(`/api/rooms/${encodeURIComponent(code)}`, { token: session.token });
      if (stale()) return;
      setFetched({ kind: "ready", view });
      setOffline(false);
    } catch (e) {
      if (stale()) return;
      if (e instanceof ApiError && e.status === 404) setFetched({ kind: "gone", message: e.message });
      else if (e instanceof ApiError && e.status === 401) setFetched({ kind: "no-session" });
      else setOffline(true);
    }
  }, [code, session]);

  const state: RoomLoad = session === null ? { kind: "no-session" } : fetched;
  const view = state.kind === "ready" ? state.view : null;
  const live =
    Boolean(session) && !paused && state.kind !== "gone" && state.kind !== "no-session" && view?.room.status !== "ended";
  usePolling(refresh, pollMs(view), live);

  const join = useCallback(
    (s: RoomSession) => {
      version.current++;
      setFetched({ kind: "loading" });
      saveRoomSession(code, s);
    },
    [code],
  );

  const setView = useCallback((v: RoomView) => {
    version.current++;
    setFetched({ kind: "ready", view: v });
  }, []);

  /** Runs a change to the room; polls that land meanwhile are ignored. */
  const mutate = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    pending.current++;
    version.current++;
    try {
      return await fn();
    } finally {
      pending.current--;
      version.current++;
    }
  }, []);

  return { session, state, refresh, offline, join, setView, mutate };
}
