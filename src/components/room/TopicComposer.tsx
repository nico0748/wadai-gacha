"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { LIMITS } from "@/lib/limits";
import type { OwnTopic } from "@/lib/rooms/types";
import { DrawnBadge } from "./bits";

const IDEAS = ["最近ハマっていることは？", "子どもの頃の夢は？", "人生で一番おいしかったもの", "最近買ってよかったもの"];

export function TopicComposer({
  code,
  token,
  topics,
  onChange,
  compact = false,
}: {
  code: string;
  token: string;
  topics: OwnTopic[];
  onChange: () => void | Promise<void>;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const length = [...text.trim()].length;
  const atLimit = topics.length >= LIMITS.topicsPerParticipant;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api<OwnTopic>(`/api/rooms/${encodeURIComponent(code)}/topics`, { body: { text }, token });
      setText("");
      setJustAdded(created.id);
      await onChange();
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿できませんでした");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api(`/api/rooms/${encodeURIComponent(code)}/topics/${id}`, { method: "DELETE", token });
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "取り消せませんでした");
    }
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} className="grid gap-2">
        <label htmlFor="topic-input" className={compact ? "label" : "font-bold"}>
          {compact ? "あなたも話題を出す" : "みんなに聞いてみたいことは？"}
        </label>
        <div className="flex gap-2">
          <input
            id="topic-input"
            ref={inputRef}
            className="field min-w-0 flex-1"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={LIMITS.topicMax + 10}
            placeholder={IDEAS[topics.length % IDEAS.length]}
            enterKeyHint="send"
            autoComplete="off"
            disabled={atLimit}
          />
          <button type="submit" className="btn-primary shrink-0 px-5" disabled={busy || length === 0 || length > LIMITS.topicMax || atLimit}>
            投稿
          </button>
        </div>
        <div className="flex justify-between text-xs text-text-dim">
          <span>{atLimit ? `投稿は1人${LIMITS.topicsPerParticipant}件までです` : "何件でも投稿できます"}</span>
          <span className={`tabular-nums ${length > LIMITS.topicMax ? "font-bold text-danger" : ""}`}>
            {length}/{LIMITS.topicMax}
          </span>
        </div>
        {error ? (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        ) : null}
      </form>

      {topics.length > 0 ? (
        <section aria-label="あなたの投稿">
          <h3 className="mb-2 text-sm font-bold text-text-dim">あなたの投稿（{topics.length}件）</h3>
          <ul className="grid gap-2">
            <AnimatePresence initial={false}>
              {topics.map((t) => (
                <motion.li
                  key={t.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, scale: 0.94, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
                  className={`flex items-center gap-3 rounded-[0.8rem] border bg-ink-raised px-4 py-2.5 ${
                    t.drawn ? "border-lamp/50" : justAdded === t.id ? "border-accent/60" : "border-line/70"
                  }`}
                >
                  <span className="min-w-0 flex-1 break-words">{t.text}</span>
                  {t.drawn ? (
                    <DrawnBadge />
                  ) : (
                    <button
                      type="button"
                      className="-my-1.5 -mr-2 inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-xs font-bold text-text-dim hover:text-text"
                      onClick={() => remove(t.id)}
                      aria-label={`「${t.text}」を取り消す`}
                    >
                      取り消す
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      ) : null}
    </div>
  );
}
