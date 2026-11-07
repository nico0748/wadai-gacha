"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const cleaned = code.replace(/[^0-9a-z]/gi, "").toUpperCase();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (cleaned.length === 6) router.push(`/room/${cleaned}`);
      }}
      className="flex items-end gap-2"
    >
      <label className="flex-1">
        <span className="label">QRが読めないときは、ルームコードで参加</span>
        <input
          className="field font-bold tracking-[0.25em] uppercase placeholder:tracking-normal"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6文字のコード"
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
        />
      </label>
      <button type="submit" className="btn-quiet min-h-[3.1rem]" disabled={cleaned.length !== 6}>
        参加
      </button>
    </form>
  );
}
