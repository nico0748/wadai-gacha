"use client";

import { useState } from "react";

/** Shares the current page with the OS share sheet, or copies its URL. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* nothing else to try */
    }
  }

  return (
    <button type="button" onClick={share} className="btn-ghost min-h-9 text-sm underline decoration-line underline-offset-4">
      {copied ? "URLをコピーしました" : "このデッキを共有"}
    </button>
  );
}
