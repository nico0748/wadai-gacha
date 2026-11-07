"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { api, ApiError } from "@/lib/client/api";
import { LIMITS } from "@/lib/limits";
import type { NameMode, RoomStatus, RoomView } from "@/lib/rooms/types";
import { CardBack } from "../GachaCard";
import { Notice, RoomRules } from "./bits";
import { RevealList } from "./RevealList";
import { TopicComposer } from "./TopicComposer";
import { useRoom } from "./useRoom";

export function ParticipantRoom({ code }: { code: string }) {
  const router = useRouter();
  const { session, state, refresh, offline, join } = useRoom(code, () => 2500);

  const isHost = state.kind === "ready" && state.view.role === "host";
  useEffect(() => {
    if (isHost) router.replace(`/room/${code}/host`);
  }, [isHost, code, router]);

  if (session === undefined || (session && state.kind === "loading") || isHost) {
    return <p className="py-20 text-center text-text-dim">読み込んでいます…</p>;
  }
  if (state.kind === "gone") {
    return (
      <Notice title="ルームが見つかりません" body={state.message}>
        <Link href="/" className="btn-quiet">
          トップへ
        </Link>
      </Notice>
    );
  }
  if (!session || state.kind === "no-session") {
    return (
      <JoinForm code={code} onJoined={join} />
    );
  }
  if (state.kind !== "ready") return null;

  const view = state.view;
  return (
    <div className="mx-auto w-full max-w-xl">
      {offline ? (
        <p role="status" className="mb-4 rounded-full bg-danger/15 px-4 py-2 text-center text-sm font-bold text-danger">
          接続が不安定です。再接続しています…
        </p>
      ) : null}
      <p className="mb-1 text-sm text-text-dim">
        ルーム <span className="font-bold tracking-[0.15em] text-text">{view.room.code}</span>
        {view.me.nickname ? <> ・ {view.me.nickname}</> : null}
      </p>
      {view.room.status === "collecting" ? (
        <Collecting view={view} token={session.token} refresh={refresh} />
      ) : view.room.status === "drawing" ? (
        <Waiting view={view} />
      ) : (
        <Reveal view={view} />
      )}
    </div>
  );
}

function JoinForm({ code, onJoined }: { code: string; onJoined: (s: { token: string; participantId: string }) => void }) {
  const [info, setInfo] = useState<{ status: RoomStatus; nameMode: NameMode } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ status: RoomStatus; nameMode: NameMode }>(`/api/rooms/${encodeURIComponent(code)}/info`)
      .then(setInfo)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : "ルームを読み込めませんでした"));
  }, [code]);

  if (loadError) {
    return (
      <Notice title="ルームが見つかりません" body={loadError}>
        <Link href="/" className="btn-quiet">
          トップへ
        </Link>
      </Notice>
    );
  }
  if (!info) return <p className="py-20 text-center text-text-dim">読み込んでいます…</p>;
  if (info.status === "ended") {
    return <Notice title="このガチャは終了しています" body="次のルームが立ったら、また参加してください。" />;
  }

  const needsName = info.nameMode !== "none";

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api<{ token: string; participantId: string }>(
        `/api/rooms/${encodeURIComponent(code)}/participants`,
        { body: needsName ? { nickname } : {} },
      );
      onJoined(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "参加できませんでした");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md pt-4">
      <div className="mx-auto mb-8 w-28 -rotate-6">
        <div className="relative aspect-[5/7] shadow-[0_18px_34px_-16px_rgb(0_0_0/0.85)]">
          <CardBack theme="candy" />
        </div>
      </div>
      <h1 className="text-center font-display text-[1.7rem] leading-tight">話題ガチャに参加</h1>
      <p className="mt-2 text-center text-text-dim">
        ルーム <span className="font-bold tracking-[0.15em] text-text">{code}</span>
        {info.status === "drawing" ? "（ガチャ中・投稿は締め切られています）" : null}
      </p>
      <form onSubmit={join} className="mt-8 grid gap-4">
        {needsName ? (
          <label className="block">
            <span className="label">ニックネーム</span>
            <input
              className="field text-lg"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={LIMITS.nicknameMax}
              placeholder="みんなに呼ばれている名前"
              autoComplete="nickname"
              required
            />
            {info.nameMode === "anonymous" ? (
              <span className="mt-2 block text-sm text-text-dim">誰が何を投稿したかは、最後まで公開されません。</span>
            ) : (
              <span className="mt-2 block text-sm text-text-dim">ガチャが終わると、投稿した話題にこの名前が表示されます。</span>
            )}
          </label>
        ) : (
          <p className="text-center text-sm text-text-dim">名前の入力は不要です。投稿は完全に匿名です。</p>
        )}
        {error ? (
          <p role="alert" className="font-bold text-danger">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn-primary min-h-14 text-[1.05rem]" disabled={busy || (needsName && !nickname.trim())}>
          {busy ? "参加しています…" : "参加する"}
        </button>
      </form>
    </div>
  );
}

function Collecting({ view, token, refresh }: { view: RoomView; token: string; refresh: () => Promise<void> }) {
  return (
    <>
      <h1 className="font-display text-[clamp(1.6rem,7vw,2.1rem)] leading-tight">話題を投稿しよう</h1>
      <p className="mt-2 text-text-dim">
        ほかの人の投稿は、ガチャが終わるまで見えません。今は
        <span className="mx-1 font-bold text-lemon tabular-nums">{view.counts.topics}件</span>
        集まっています。
      </p>
      <div className="mt-4">
        <RoomRules room={view.room} />
      </div>
      <div className="mt-8">
        <TopicComposer code={view.room.code} token={token} topics={view.myTopics} onChange={refresh} />
      </div>
    </>
  );
}

function Waiting({ view }: { view: RoomView }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <div className="relative mb-10 h-44 w-32" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 shadow-[0_18px_34px_-16px_rgb(0_0_0/0.85)]"
            initial={false}
            animate={reduce ? undefined : { rotate: [i * 6 - 6, i * 6 - 3, i * 6 - 6], y: [0, -4, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
            style={{ rotate: i * 6 - 6 }}
          >
            <CardBack theme="candy" />
          </motion.div>
        ))}
      </div>
      <h1 className="font-display text-[clamp(1.6rem,7vw,2.1rem)] leading-tight">ホストのスマホに注目！</h1>
      <p className="mt-3 text-text-dim">
        ガチャが始まりました。いま
        <span className="mx-1 font-bold text-text tabular-nums">{view.room.drawCount}枚目</span>
        まで引かれています。終わったら、ここに全部の話題が届きます。
      </p>
      {view.myTopics.length > 0 ? (
        <section className="mt-10 w-full text-left" aria-label="あなたの投稿">
          <h2 className="mb-2 text-sm font-bold text-text-dim">あなたの投稿（{view.myTopics.length}件）</h2>
          <ul className="grid gap-2">
            {view.myTopics.map((t) => (
              <li key={t.id} className="rounded-[0.8rem] border border-line/70 bg-ink-raised px-4 py-2.5 break-words">
                {t.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Reveal({ view }: { view: RoomView }) {
  const reduce = useReducedMotion();
  const total = view.reveal?.length ?? 0;
  return (
    <>
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
      >
        <h1 className="font-display text-[clamp(1.7rem,7.5vw,2.3rem)] leading-tight">ガチャ終了！</h1>
        <p className="mt-2 text-text-dim">
          みんなが出した<span className="mx-1 font-bold text-lemon tabular-nums">{total}件</span>の話題を、全部公開します。
        </p>
      </motion.div>
      <div className="mt-10">
        <RevealList items={view.reveal ?? []} mine={view.myTopics.map((t) => t.id)} />
      </div>
      <div className="mt-12">
        <Link href="/" className="btn-quiet">
          トップへ
        </Link>
      </div>
    </>
  );
}
