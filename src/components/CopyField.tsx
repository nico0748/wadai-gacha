"use client";

import { useState } from "react";

export function CopyField({ label, value, note }: { label: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the field is still selectable */
    }
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-2">
        <input
          className="field min-w-0 flex-1 text-sm"
          value={value}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
          aria-label={label}
        />
        <button type="button" className="btn-quiet min-h-[3rem] shrink-0 px-4 text-sm" onClick={copy}>
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      {note ? <p className="mt-2 text-sm text-text-dim">{note}</p> : null}
    </div>
  );
}
