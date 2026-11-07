"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
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

  const refresh = useCallback(async () => {
    if (!session) return;
    const startedAt = version.current;
    try {
      const view = await api<RoomView>(`/api/rooms/${encodeURIComponent(code)}`, { token: session.token });
      if (version.current !== startedAt) return;
      setFetched({ kind: "ready", view });
      setOffline(false);
    } catch (e) {
      if (version.current !== startedAt) return;
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

  return { session, state, refresh, offline, join, setView };
}
