"use client";

/**
 * Per-device memory: which rooms this browser hosts or joined, and which
 * decks it created. localStorage can be unavailable (private mode, blocked
 * site data), so every value is mirrored in memory and the app keeps working
 * for as long as the tab stays open.
 */

export interface RoomSession {
  token: string;
}

export interface OwnedDeck {
  shareId: string;
  editKey: string;
  title: string;
  theme: string;
}

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function getRaw(key: string): string | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch {
    /* fall through to memory */
  }
  return memory.get(key) ?? null;
}

function setRaw(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked: memory still has it */
  }
  listeners.forEach((cb) => cb());
}

/** For useSyncExternalStore: fires on writes from this tab and from other tabs. */
export function subscribeStorage(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

const roomKey = (code: string) => `wg:room:${code.toUpperCase()}`;

/** Raw JSON (a stable string identity for useSyncExternalStore). */
export function readRoomSessionRaw(code: string): string | null {
  return getRaw(roomKey(code));
}

export function parseRoomSession(raw: string | null): RoomSession | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as RoomSession;
    return typeof s.token === "string" && s.token.length > 0 ? s : null;
  } catch {
    return null;
  }
}

export function saveRoomSession(code: string, session: RoomSession) {
  setRaw(roomKey(code), JSON.stringify({ token: session.token }));
}

const DECKS_KEY = "wg:my-decks";

export function readOwnedDecksRaw(): string | null {
  return getRaw(DECKS_KEY);
}

export function parseOwnedDecks(raw: string | null): OwnedDeck[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as OwnedDeck[];
    return Array.isArray(list) ? list.filter((d) => typeof d?.shareId === "string") : [];
  } catch {
    return [];
  }
}

export function saveOwnedDeck(deck: OwnedDeck) {
  const rest = parseOwnedDecks(readOwnedDecksRaw()).filter((d) => d.shareId !== deck.shareId);
  setRaw(DECKS_KEY, JSON.stringify([deck, ...rest].slice(0, 50)));
}

export function forgetOwnedDeck(shareId: string) {
  setRaw(DECKS_KEY, JSON.stringify(parseOwnedDecks(readOwnedDecksRaw()).filter((d) => d.shareId !== shareId)));
}
