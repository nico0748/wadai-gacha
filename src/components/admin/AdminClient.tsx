"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import type { DeckInput } from "@/lib/decks/types";
import { DeckEditor } from "../DeckEditor";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mx-auto grid max-w-sm gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api("/api/admin/login", { body: { password } });
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "ログインできませんでした");
          setBusy(false);
        }
      }}
    >
      <label className="block">
        <span className="label">管理用パスワード</span>
        <input
          type="password"
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error ? (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary" disabled={busy || !password}>
        {busy ? "確認しています…" : "ログイン"}
      </button>
    </form>
  );
}

export function AdminLogout() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-ghost text-sm"
      onClick={async () => {
        await api("/api/admin/logout", { method: "POST" }).catch(() => undefined);
        router.refresh();
      }}
    >
      ログアウト
    </button>
  );
}

export function AdminDeckForm({ id, initial }: { id?: string; initial?: DeckInput }) {
  const router = useRouter();
  const done = () => {
    router.push("/admin");
    router.refresh();
  };
  return (
    <DeckEditor
      initial={initial}
      submitLabel={id ? "変更を保存" : "デッキを追加"}
      onSubmit={async (input) => {
        if (id) await api(`/api/admin/decks/${id}`, { method: "PUT", body: input });
        else await api("/api/admin/decks", { body: input });
        done();
      }}
      onDelete={
        id
          ? async () => {
              await api(`/api/admin/decks/${id}`, { method: "DELETE" });
              done();
            }
          : undefined
      }
    />
  );
}
