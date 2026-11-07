"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loadOwnedDecks, type OwnedDeck } from "@/lib/client/storage";
import { DeckTile } from "./DeckTile";

const EMPTY: OwnedDeck[] = [];
let cache: { raw: string | null; list: OwnedDeck[] } = { raw: null, list: EMPTY };

function snapshot(): OwnedDeck[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem("wg:my-decks");
  } catch {
    return EMPTY;
  }
  if (raw !== cache.raw) cache = { raw, list: loadOwnedDecks() };
  return cache.list;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** Decks this browser created. They are not public, so only this device lists them. */
export function MyDecks() {
  const decks = useSyncExternalStore(subscribe, snapshot, () => EMPTY);

  return (
    <section className="mt-16 border-t border-line/70 pt-10" aria-labelledby="my-decks">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="my-decks" className="font-display text-xl">
          自分のデッキ
        </h2>
        <Link href="/decks/new" className="btn-quiet min-h-10 px-4 text-sm">
          新しいデッキを作る
        </Link>
      </div>
      {decks.length === 0 ? (
        <p className="mt-4 max-w-[34em] text-sm text-text-dim">
          自分で作ったデッキは、ここに表示されます。共有用のURLを知っている人だけが遊べるので、身内ネタも気軽にどうぞ。
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
          {decks.map((d) => (
            <DeckTile key={d.shareId} href={`/d/${d.shareId}`} title={d.title} theme={d.theme}>
              <Link
                href={`/d/${d.shareId}/edit/${d.editKey}`}
                className="mt-2 inline-block px-1 text-sm text-text-dim underline decoration-line underline-offset-4 hover:text-text"
              >
                編集する
              </Link>
            </DeckTile>
          ))}
        </ul>
      )}
    </section>
  );
}
