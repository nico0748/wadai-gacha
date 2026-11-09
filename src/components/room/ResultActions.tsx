"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DECK_DRAFT_KEY, makeDeckDraft, revealShareText } from "@/lib/rooms/results";
import type { RevealItem } from "@/lib/rooms/types";

/** Sends the list (no names) with the share sheet, or copies it. */
export function ShareListButton({ items }: { items: RevealItem[] }) {
  const [copied, setCopied] = useState(false);

  async function send() {
    const text = revealShareText(items, `${window.location.origin}/`);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* nothing else to try */
    }
  }

  return (
    <button type="button" className="btn-quiet" onClick={send} disabled={items.length === 0}>
      <span aria-live="polite">{copied ? "コピーしました" : "一覧を送る"}</span>
    </button>
  );
}

/** Host only: opens /decks/new filled with these topics. Nothing is saved until 作る there. */
export function MakeDeckButton({ items }: { items: RevealItem[] }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-quiet"
      disabled={items.length === 0}
      onClick={() => {
        try {
          window.sessionStorage.setItem(DECK_DRAFT_KEY, JSON.stringify(makeDeckDraft(items, new Date())));
        } catch {
          /* storage blocked: the deck form opens empty */
        }
        router.push("/decks/new");
      }}
    >
      この話題でデッキを作る
    </button>
  );
}
