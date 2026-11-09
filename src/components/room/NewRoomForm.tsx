"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { saveRoomSession } from "@/lib/client/storage";
import { LIMITS } from "@/lib/limits";
import { Phrase } from "../Phrase";
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
    <div
      className={`rounded-[0.9rem] border transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-lamp ${
        checked ? "border-primary bg-primary/8" : "border-line bg-ink-raised/50 hover:border-text-dim"
      }`}
    >
      <label className="flex cursor-pointer gap-3 p-4">
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
          className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${checked ? "border-primary" : "border-line"}`}
        >
          {checked ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
        </span>
        <span className="flex-1">
          <span className="block font-bold">{title}</span>
          <span className="jp-wrap mt-0.5 block text-sm text-text-dim">
            <Phrase text={body} />
          </span>
        </span>
      </label>
      {checked && children ? <div className="-mt-1 pr-4 pb-4 pl-12">{children}</div> : null}
    </div>
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

  // Next keeps this page alive in the background after navigating to the
  // room, so clear the busy state when it is hidden; coming back with the
  // browser's back button then shows a usable form again.
  useEffect(() => () => setBusy(false), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await api<{ code: string; token: string }>("/api/rooms", {
        body: {
          endMode,
          drawLimit: endMode === "count" ? Number(drawLimit) : null,
          nameMode,
          hostNickname: nameMode === "none" ? undefined : hostNickname,
        },
      });
      saveRoomSession(session.code, { token: session.token });
      router.push(`/room/${session.code}/host`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ルームを作れませんでした");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-9">
      <fieldset className="grid gap-3">
        <legend className="mb-3 text-lg font-black">いつ終わる？</legend>
        <Choice
          name="endMode"
          value="all"
          current={endMode}
          onChange={setEndMode}
          title="全部めくり終わるまで"
          body="集まった話題を最後の1枚まで。途中でホストが終了することもできます。"
        />
        <Choice
          name="endMode"
          value="count"
          current={endMode}
          onChange={setEndMode}
          title="めくる回数を決める"
          body="決めた回数をめくったら終了。話題がたくさん集まりそうなときに。"
        >
          <label className="flex items-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={LIMITS.drawLimitMax}
              value={drawLimit}
              onChange={(e) => setDrawLimit(e.target.value)}
              className="field w-24 text-center font-bold"
              required
            />
            <span className="font-bold">回めくったら終了</span>
          </label>
        </Choice>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-3 text-lg font-black">誰が書いたか、見せる？</legend>
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
          title="名前を聞かない"
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

      {/* On a phone the button stays in reach at the bottom while the choices scroll. */}
      <div className="sticky bottom-0 z-30 -mx-4 border-t border-line/70 bg-ink/92 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <button type="submit" className="btn-primary min-h-14 w-full text-[1.05rem] sm:w-auto sm:min-w-64" disabled={busy}>
          {busy ? "作っています…" : "ルームを作ってQRを出す"}
        </button>
        <p className="mt-2 text-center text-xs text-text-dim sm:mt-3 sm:text-left sm:text-sm">
          ルームは{LIMITS.roomTtlHours}時間後に自動で削除されます。
        </p>
      </div>
    </form>
  );
}
