"use client";

/**
 * Per-device memory: which rooms this browser hosts or joined, and which
 * decks it created. Storage can be unavailable (private mode), so every
 * access is guarded and the app still works for the current page view.
 */

export interface RoomSession {
  token: string;
  participantId: string;
}

export interface OwnedDeck {
  shareId: string;
  editKey: string;
  title: string;
  theme: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep going */
  }
}

const roomKey = (code: string) => `wg:room:${code.toUpperCase()}`;
const listeners = new Set<() => void>();

/** For useSyncExternalStore: fires on writes from this tab and from other tabs. */
export function subscribeStorage(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Raw JSON (stable string identity for useSyncExternalStore). */
export function readRoomSessionRaw(code: string): string | null {
  try {
    return window.localStorage.getItem(roomKey(code));
  } catch {
    return null;
  }
}

export function parseRoomSession(raw: string | null): RoomSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as RoomSession;
    return typeof s.token === "string" ? s : null;
  } catch {
    return null;
  }
}

export function saveRoomSession(code: string, session: RoomSession) {
  write(roomKey(code), session);
  listeners.forEach((cb) => cb());
}

const DECKS_KEY = "wg:my-decks";

export function loadOwnedDecks(): OwnedDeck[] {
  const list = read<OwnedDeck[]>(DECKS_KEY);
  return Array.isArray(list) ? list : [];
}

export function saveOwnedDeck(deck: OwnedDeck) {
  const rest = loadOwnedDecks().filter((d) => d.shareId !== deck.shareId);
  write(DECKS_KEY, [deck, ...rest].slice(0, 50));
}

export function forgetOwnedDeck(shareId: string) {
  write(
    DECKS_KEY,
    loadOwnedDecks().filter((d) => d.shareId !== shareId),
  );
}
