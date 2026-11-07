"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { saveRoomSession } from "@/lib/client/storage";
import { LIMITS } from "@/lib/limits";
import type { EndMode, NameMode } from "@/lib/rooms/types";

function Choice<T extends string>({
  name,
  value,
  current,
  onChange,
  title,
  body,
  children,
}: {
  name: string;
  value: T;
  current: T;
  onChange: (v: T) => void;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const checked = current === value;
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-[0.9rem] border p-4 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-lemon ${
        checked ? "border-candy bg-candy/8" : "border-line bg-ink-raised/50 hover:border-text-dim"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${checked ? "border-candy" : "border-line"}`}
      >
        {checked ? <span className="h-2.5 w-2.5 rounded-full bg-candy" /> : null}
      </span>
      <span className="flex-1">
        <span className="block font-bold">{title}</span>
        <span className="mt-0.5 block text-sm text-text-dim">{body}</span>
        {checked && children ? <span className="mt-3 block">{children}</span> : null}
      </span>
    </label>
  );
}

export function NewRoomForm() {
  const router = useRouter();
  const [endMode, setEndMode] = useState<EndMode>("all");
  const [drawLimit, setDrawLimit] = useState("5");
  const [nameMode, setNameMode] = useState<NameMode>("anonymous");
  const [hostNickname, setHostNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api<{ code: string; token: string; participantId: string }>("/api/rooms", {
        body: {
          endMode,
          drawLimit: endMode === "count" ? Number(drawLimit) : null,
          nameMode,
          hostNickname: nameMode === "none" ? undefined : hostNickname,
        },
      });
      saveRoomSession(session.code, { token: session.token, participantId: session.participantId });
      router.push(`/room/${session.code}/host`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ルームを作れませんでした");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-9">
      <fieldset className="grid gap-3">
        <legend className="mb-3 font-display text-lg">いつ終わる？</legend>
        <Choice
          name="endMode"
          value="all"
          current={endMode}
          onChange={setEndMode}
          title="全部引き終わるまで"
          body="集まった話題を最後の1枚まで。途中でホストが終了することもできます。"
        />
        <Choice
          name="endMode"
          value="count"
          current={endMode}
          onChange={setEndMode}
          title="引く回数を決める"
          body="決めた回数を引いたら終了。話題がたくさん集まりそうなときに。"
        >
          <span className="flex items-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMITS.drawLimitMax}
              value={drawLimit}
              onChange={(e) => setDrawLimit(e.target.value)}
              className="field w-24 text-center font-bold"
              aria-label="引く回数"
              required
            />
            <span className="font-bold">回引いたら終了</span>
          </span>
        </Choice>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-3 font-display text-lg">誰が書いたか、見せる？</legend>
        <Choice
          name="nameMode"
          value="anonymous"
          current={nameMode}
          onChange={setNameMode}
          title="最後まで秘密にする"
          body="参加するときにニックネームは入れますが、終了後の一覧にも名前は出ません。"
        />
        <Choice
          name="nameMode"
          value="named"
          current={nameMode}
          onChange={setNameMode}
          title="終了後に名前を公開する"
          body="一覧で「この話題を書いたのは誰か」がわかります。答え合わせで盛り上がりたいときに。"
        />
        <Choice
          name="nameMode"
          value="none"
          current={nameMode}
          onChange={setNameMode}
          title="ニックネームなし"
          body="名前を入れずに、すぐ投稿できます。完全に匿名です。"
        />
      </fieldset>

      {nameMode !== "none" ? (
        <label className="block max-w-sm">
          <span className="label">あなたのニックネーム</span>
          <input
            className="field"
            value={hostNickname}
            onChange={(e) => setHostNickname(e.target.value)}
            maxLength={LIMITS.nicknameMax}
            placeholder="ホスト"
          />
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="font-bold text-danger">
          {error}
        </p>
      ) : null}

      <div>
        <button type="submit" className="btn-primary min-h-14 w-full text-[1.05rem] sm:w-auto sm:min-w-64" disabled={busy}>
          {busy ? "作っています…" : "ルームを作ってQRを出す"}
        </button>
        <p className="mt-3 text-sm text-text-dim">ルームは{LIMITS.roomTtlHours}時間後に自動で削除されます。</p>
      </div>
    </form>
  );
}
