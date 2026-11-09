"use client";

import { useState } from "react";
import { LIMITS } from "@/lib/limits";
import { DECK_THEMES, DECK_THEME_KEYS, type DeckTheme } from "@/lib/decks/themes";
import type { DeckInput } from "@/lib/decks/types";
import { CardBack, CardFront } from "./GachaCard";

export interface DeckEditorProps {
  initial?: Partial<DeckInput>;
  submitLabel: string;
  onSubmit: (input: DeckInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
}

export function DeckEditor({ initial, submitLabel, onSubmit, onDelete, deleteLabel = "このデッキを削除" }: DeckEditorProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [theme, setTheme] = useState<DeckTheme>(initial?.theme ?? "candy");
  const [cardsText, setCardsText] = useState((initial?.cards ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cards = cardsText
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);
  const tooLong = cards.filter((c) => [...c].length > LIMITS.cardTextMax).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ title, description, theme, cards });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除できませんでした");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_15rem] lg:gap-12">
      <div className="grid gap-6">
        <label className="block">
          <span className="label">デッキ名</span>
          <input
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.deckTitleMax}
            placeholder="例：サークルの同期会"
            required
          />
        </label>

        <label className="block">
          <span className="label">ひとこと説明（任意）</span>
          <input
            className="field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={LIMITS.deckDescriptionMax}
            placeholder="どんな場で使うデッキか"
          />
        </label>

        <fieldset>
          <legend className="label">カードの色</legend>
          <div className="flex flex-wrap gap-3">
            {DECK_THEME_KEYS.map((key) => (
              <label key={key} className="cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value={key}
                  checked={theme === key}
                  onChange={() => setTheme(key)}
                  className="peer sr-only"
                />
                <span
                  className="block h-12 w-12 rounded-full ring-offset-4 ring-offset-ink transition peer-checked:ring-3 peer-checked:ring-text peer-focus-visible:outline-3 peer-focus-visible:outline-lemon"
                  style={{ background: `linear-gradient(150deg, ${DECK_THEMES[key].from}, ${DECK_THEMES[key].to})` }}
                  title={DECK_THEMES[key].name}
                />
                <span className="sr-only">{DECK_THEMES[key].name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="lg:hidden" aria-hidden="true">
          <Preview theme={theme} title={title} sample={cards[0]} />
        </div>

        <label className="block">
          <span className="label flex items-baseline justify-between">
            <span>カード（1行に1枚）</span>
            <span className={`tabular-nums ${cards.length > LIMITS.deckCardsMax ? "text-danger" : ""}`}>
              {cards.length} / {LIMITS.deckCardsMax}枚
            </span>
          </span>
          <textarea
            className="field min-h-72 leading-relaxed"
            value={cardsText}
            onChange={(e) => setCardsText(e.target.value)}
            placeholder={"最近ハマっていることは？\n子どもの頃の夢は？\n無人島に1つ持っていくなら？"}
          />
          {tooLong > 0 ? (
            <span className="mt-2 block text-sm text-danger">
              {LIMITS.cardTextMax}文字を超えているカードが{tooLong}枚あります
            </span>
          ) : null}
        </label>

        {error ? (
          <p role="alert" className="font-bold text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary min-w-48" disabled={busy}>
            {busy ? "保存しています…" : submitLabel}
          </button>
          {onDelete ? (
            confirmDelete ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-text-dim">本当に削除しますか？元に戻せません。</span>
                <button type="button" className="btn-quiet border-danger/60 text-danger" onClick={remove} disabled={busy}>
                  削除する
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>
                  やめる
                </button>
              </span>
            ) : (
              <button type="button" className="btn-ghost text-danger/90 hover:text-danger" onClick={() => setConfirmDelete(true)}>
                {deleteLabel}
              </button>
            )
          ) : null}
        </div>
      </div>

      <aside className="hidden lg:block" aria-hidden="true">
        <div className="sticky top-8">
          <Preview theme={theme} title={title} sample={cards[0]} stacked />
        </div>
      </aside>
    </form>
  );
}

/** Both faces of the card as it will look on the table, using the first card as the sample. */
function Preview({ theme, title, sample, stacked = false }: { theme: DeckTheme; title: string; sample?: string; stacked?: boolean }) {
  const shadow = "rounded-card shadow-[0_22px_40px_-16px_rgb(0_0_0/0.8)]";
  return (
    <div>
      <span className="label">プレビュー</span>
      <div className={stacked ? "grid gap-5" : "flex gap-4"}>
        <div className={`relative aspect-[5/7] ${stacked ? "w-full" : "w-[min(40vw,9.5rem)]"} ${shadow}`}>
          <CardBack theme={theme} label={title.trim() || "デッキ名"} />
        </div>
        <div className={`relative aspect-[5/7] ${stacked ? "w-full" : "w-[min(40vw,9.5rem)] rotate-3"} ${shadow}`}>
          <CardFront theme={theme} text={sample ?? "1枚目のカードがここに表示されます"} deckTitle={title.trim() || "デッキ名"} order={1} />
        </div>
      </div>
    </div>
  );
}
