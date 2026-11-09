"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { usePolling } from "@/hooks/usePolling";
import { api, ApiError } from "@/lib/client/api";
import { LIMITS } from "@/lib/limits";
import type { RevealItem, RoomPublicInfo, RoomView } from "@/lib/rooms/types";
import { CardBack } from "../GachaCard";
import { JoinByCode } from "../JoinByCode";
import { Phrase } from "../Phrase";
import { Notice, OwnTopicList, RoomRules, WaitingCards } from "./bits";
import { RevealCountdown, useMsUntil } from "./countdown";
import { ShareListButton } from "./ResultActions";
import { RevealList } from "./RevealList";
import { TopicComposer } from "./TopicComposer";
import { jitterFor, phaseOf, useRoom } from "./useRoom";

export function ParticipantRoom({ code }: { code: string }) {
  const router = useRouter();
  const { session, state, refresh, offline, join, clockOffset } = useRoom(code, {
    pollMs: (v, due) => {
      if (!v) return 2500;
      switch (phaseOf(v)) {
        case "collecting":
          return 2500;
        case "drawing":
          return 4500 + jitterFor(v.me.id, 1000);
        // Often enough to catch the host's せーの with the countdown still running.
        case "held":
          return due ? 200 : 1500;
        case "answers":
          return v.room.authorsShown > 0 ? 1500 : 2500;
        case "done":
          return null;
      }
    },
  });
  const isHost = state.kind === "ready" && state.view.role === "host";
  useEffect(() => {
    if (isHost) router.replace(`/room/${code}/host`);
  }, [isHost, code, router]);

  if (session === undefined || (session && state.kind === "loading") || isHost) {
    return <p className="py-20 text-center text-text-dim">読み込んでいます…</p>;
  }
  if (state.kind === "gone") {
    return <RoomNotFound message={state.message} />;
  }
  if (!session || state.kind === "no-session") {
    return <JoinForm code={code} onJoined={join} />;
  }
  if (state.kind !== "ready") return null;

  const view = state.view;
  const phase = phaseOf(view);
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
      {phase === "collecting" ? (
        <Collecting view={view} token={session.token} refresh={refresh} />
      ) : phase === "drawing" ? (
        <Waiting view={view} />
      ) : phase === "held" ? (
        <>
          <Held view={view} />
          <RevealCountdown revealAt={view.revealAt} offsetMs={clockOffset} />
        </>
      ) : (
        <Reveal view={view} />
      )}
    </div>
  );
}

function RoomNotFound({ message }: { message: string }) {
  return (
    <Notice title="ルームが見つかりません" body={message} footer={<JoinByCode />}>
      <Link href="/" className="btn-quiet">
        トップへ
      </Link>
    </Notice>
  );
}

function JoinForm({ code, onJoined }: { code: string; onJoined: (s: { token: string }) => void }) {
  const [info, setInfo] = useState<{ data: RoomPublicInfo; offset: number } | null>(null);
  // status 0: the network; anything else came from the server.
  const [loadError, setLoadError] = useState<{ message: string; status: number } | null>(null);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInfo = useCallback(async () => {
    const sentAt = Date.now();
    try {
      const data = await api<RoomPublicInfo>(`/api/rooms/${encodeURIComponent(code)}/info`);
      setInfo({ data, offset: Date.parse(data.serverNow) - (sentAt + Date.now()) / 2 });
      setLoadError(null);
    } catch (e) {
      setLoadError(
        e instanceof ApiError ? { message: e.message, status: e.status } : { message: "ルームを読み込めませんでした", status: 0 },
      );
    }
  }, [code]);

  // Loads once; then only someone without a session (another browser, a
  // late arrival) watching a held list or a named room's 答え合わせ keeps
  // polling, to get the countdown and the names. A missing room stops it
  // (missed lookups count against the whole network's limit); a busy server
  // or a bad connection only slows it down.
  const data = info?.data ?? null;
  const heldUntil = data && data.status === "ended" && !data.reveal ? data.revealAt : null;
  const msLeft = useMsUntil(heldUntil, info?.offset ?? 0);
  const due = msLeft !== null && msLeft <= 0;
  const answering = Boolean(
    data?.reveal && data.nameMode === "named" && data.reveal.some((r) => r.author === null),
  );
  const gone = loadError?.status === 404;
  usePolling(
    loadInfo,
    loadError ? 5000 : heldUntil ? (due ? 300 : 2500) : 5000,
    !gone && (!data || Boolean(heldUntil) || answering),
  );

  if (gone) return <RoomNotFound message={loadError.message} />;
  if (!data && loadError) {
    return (
      <Notice title="つながりにくくなっています" body={`${loadError.message}（自動でつなぎ直します）`}>
        <Link href="/" className="btn-quiet">
          トップへ
        </Link>
      </Notice>
    );
  }
  if (!data || !info) return <p className="py-20 text-center text-text-dim">読み込んでいます…</p>;
  if (data.status === "ended") {
    if (!data.reveal) {
      return (
        <div className="mx-auto w-full max-w-xl">
          <HeldMessage code={code} />
          <RevealCountdown revealAt={data.revealAt} offsetMs={info.offset} />
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-xl">
        <h1 className="font-display text-[clamp(1.7rem,7.5vw,2.3rem)] leading-tight">ぜんぶオープン！</h1>
        <p className="jp-wrap mt-2 text-text-dim">
          <Phrase text={`ルーム ${code} で集まった話題を、全部公開しています。`} />
        </p>
        <AnswersNote reveal={data.reveal} named={data.nameMode === "named"} />
        <div className="mt-10">
          <RevealList items={data.reveal} named={data.nameMode === "named"} />
        </div>
        <EndActions items={data.reveal} />
      </div>
    );
  }

  const needsName = data.nameMode !== "none";

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api<{ token: string }>(
        `/api/rooms/${encodeURIComponent(code)}/participants`,
        { body: needsName ? { nickname } : {} },
      );
      onJoined(s);
    } catch (err) {
      setBusy(false);
      // The room may have ended while this screen was open: show its results.
      if (err instanceof ApiError && err.status === 409) {
        await loadInfo();
        return;
      }
      setError(err instanceof Error ? err.message : "参加できませんでした");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md pt-4">
      <div className="mx-auto mb-8 w-28 -rotate-6">
        <div className="relative aspect-[5/7] rounded-card shadow-[0_18px_34px_-16px_rgb(0_0_0/0.85)]">
          <CardBack theme="yoru" />
        </div>
      </div>
      <h1 className="text-center font-display text-[1.7rem] leading-tight">めくトークに参加</h1>
      <p className="mt-2 text-center text-text-dim">
        ルーム <span className="font-bold tracking-[0.15em] text-text">{code}</span>
        {data.status === "drawing" ? "（めくり中・投稿は締め切られています）" : null}
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
            <span className="jp-wrap mt-2 block text-sm text-text-dim">
              <Phrase
                text={
                  data.nameMode === "anonymous"
                    ? "誰が何を投稿したかは、最後まで公開されません。"
                    : "終わったあとの答え合わせで、投稿した話題にこの名前が表示されます。"
                }
              />
            </span>
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
        <p className="jp-wrap text-center text-xs text-text-dim">
          <Phrase text="ホストは終了後、話題を名前なしでデッキとして残せます。" />
        </p>
      </form>
    </div>
  );
}

function Collecting({ view, token, refresh }: { view: RoomView; token: string; refresh: () => Promise<void> }) {
  return (
    <>
      <h1 className="font-display text-[clamp(1.6rem,7vw,2.1rem)] leading-tight">話題を投稿しよう</h1>
      <p className="jp-wrap mt-2 text-text-dim">
        <Phrase text="ほかの人の投稿は、終わるまで見えません。" />
        <br />
        今は<span className="mx-1 font-bold text-lamp tabular-nums">{view.counts.topics}件</span>集まっています。
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
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <WaitingCards />
      <h1 className="font-display text-[clamp(1.6rem,7vw,2.1rem)] leading-tight">ホストのスマホに注目！</h1>
      <p className="jp-wrap mt-3 text-text-dim">
        {view.room.drawCount === 0 ? (
          "めくり始めました。もうすぐ1枚目が出ます。"
        ) : (
          <>
            これまでに<span className="mx-1 font-bold text-text tabular-nums">{view.room.drawCount}枚</span>めくりました。
          </>
        )}
        <br />
        終わったら、ここに全部の話題が届きます。
      </p>
      <OwnTopicList topics={view.myTopics} />
    </div>
  );
}

function HeldMessage({ code }: { code?: string }) {
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <WaitingCards />
      <h1 className="font-display text-[clamp(1.6rem,7vw,2.1rem)] leading-tight">ホストの合図で公開します</h1>
      <p className="jp-wrap mt-3 text-text-dim">
        <Phrase
          text={`${code ? `ルーム ${code} は` : ""}全部めくり終わりました。合図があると、みんなのスマホで一覧が一斉に開きます。`}
        />
      </p>
    </div>
  );
}

function Held({ view }: { view: RoomView }) {
  return (
    <>
      <HeldMessage />
      <OwnTopicList topics={view.myTopics} />
    </>
  );
}

function AnswersNote({ reveal, named }: { reveal: RevealItem[]; named: boolean }) {
  const hidden = reveal.filter((r) => r.author === null).length;
  if (!named || hidden === 0) return null;
  return (
    <p role="status" className="mt-4 rounded-card border border-lamp/40 bg-lamp/5 px-4 py-3 text-sm font-bold">
      {hidden < reveal.length
        ? "ホストのスマホで、誰が書いたかの答え合わせをしています。"
        : "誰が書いたかは、ホストの合図で公開されます。"}
    </p>
  );
}

function Reveal({ view }: { view: RoomView }) {
  const reduce = useReducedMotion();
  const items = view.reveal ?? [];
  return (
    <>
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
      >
        <h1 className="font-display text-[clamp(1.7rem,7.5vw,2.3rem)] leading-tight">ぜんぶオープン！</h1>
        <p className="mt-2 text-text-dim">
          みんなが出した<span className="mx-1 font-bold text-lamp tabular-nums">{items.length}件</span>の話題を、全部公開します。
        </p>
      </motion.div>
      <AnswersNote reveal={items} named={view.room.nameMode === "named"} />
      <div className="mt-10">
        <RevealList items={items} mine={view.myTopics.map((t) => t.id)} named={view.room.nameMode === "named"} />
      </div>
      <EndActions items={items} />
    </>
  );
}

function EndActions({ items }: { items: RevealItem[] }) {
  return (
    <div className="mt-12 grid gap-6">
      <div>
        <ShareListButton items={items} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/room/new" className="btn-primary">
          自分もルームを作る
        </Link>
        <Link href="/" className="btn-quiet">
          トップへ
        </Link>
      </div>
    </div>
  );
}
