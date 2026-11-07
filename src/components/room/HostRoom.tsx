"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/client/api";
import type { DrawResult, RoomView } from "@/lib/rooms/types";
import { CardStage, type DrawnTopic } from "../CardStage";
import { QrCode } from "./QrCode";
import { RevealList } from "./RevealList";
import { TopicComposer } from "./TopicComposer";
import { useRoom } from "./useRoom";
import { Counter, Notice, RoomRules } from "./bits";

const ROOM_THEME = "candy";
const noop = () => () => {};

export function HostRoom({ code }: { code: string }) {
  const { session, state, setView, refresh, offline } = useRoom(code, (v) =>
    !v || v.room.status === "collecting" ? 2000 : 8000,
  );

  if (state.kind === "loading" || session === undefined) {
    return <p className="py-20 text-center text-text-dim">読み込んでいます…</p>;
  }
  if (state.kind === "gone") {
    return (
      <Notice title="ルームが見つかりません" body={state.message}>
        <Link href="/room/new" className="btn-primary">
          新しいルームを作る
        </Link>
      </Notice>
    );
  }
  if (state.kind === "no-session" || !session) {
    return (
      <Notice title="この端末はホストではありません" body="ホスト画面は、ルームを作った端末でだけ開けます。参加者として話題を投稿しますか？">
        <Link href={`/room/${code}`} className="btn-primary">
          参加者として開く
        </Link>
      </Notice>
    );
  }

  const view = state.view;

  return (
    <>
      {offline ? (
        <p role="status" className="mb-4 rounded-full bg-danger/15 px-4 py-2 text-center text-sm font-bold text-danger">
          接続が不安定です。再接続しています…
        </p>
      ) : null}
      {view.room.status === "collecting" ? (
        <Collecting view={view} token={session.token} refresh={refresh} />
      ) : view.room.status === "drawing" ? (
        <Drawing view={view} token={session.token} setView={setView} refresh={refresh} />
      ) : (
        <Ended view={view} />
      )}
    </>
  );
}

function Collecting({ view, token, refresh }: { view: RoomView; token: string; refresh: () => Promise<void> }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const joinUrl = `${origin}/room/${view.room.code}`;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const others = view.counts.participants - 1;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/rooms/${view.room.code}/start`, { method: "POST", token });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "始められませんでした");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-16">
      <section className="mx-auto w-full max-w-[22rem] text-center" aria-labelledby="qr-heading">
        <h1 id="qr-heading" className="font-display text-[1.6rem] leading-tight">
          QRを読み込んで、
          <br />
          話題を投稿してね
        </h1>
        <div className="mx-auto mt-6 w-[min(78vw,20rem)]">
          {origin ? <QrCode value={joinUrl} label={`参加用QRコード（${joinUrl}）`} /> : null}
        </div>
        <p className="mt-5 text-sm text-text-dim">ルームコード</p>
        <p className="font-display text-[2.1rem] leading-none tracking-[0.18em] tabular-nums" aria-label={`ルームコード ${view.room.code.split("").join(" ")}`}>
          {view.room.code}
        </p>
      </section>

      <section className="grid gap-8" aria-label="受付の状況">
        <div className="grid grid-cols-2 gap-3">
          <Counter label="参加者" value={others} unit="人" hint="ホストを除く" />
          <Counter label="集まった話題" value={view.counts.topics} unit="件" highlight />
        </div>

        <RoomRules room={view.room} />

        <div className="rounded-card border border-line/70 bg-ink-raised/50 p-5">
          <TopicComposer code={view.room.code} token={token} topics={view.myTopics} onChange={refresh} compact />
        </div>

        <div className="grid gap-3">
          {confirming ? (
            <div className="grid gap-3 rounded-card border border-candy/60 bg-candy/8 p-5">
              <p className="font-bold">締め切ると、もう投稿できなくなります。ガチャを始めますか？</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={start} disabled={busy}>
                  {busy ? "準備しています…" : "締め切って始める"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
                  もう少し待つ
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary min-h-14 text-[1.05rem]"
              onClick={() => setConfirming(true)}
              disabled={view.counts.topics === 0}
            >
              受付を締め切ってガチャを始める
            </button>
          )}
          {view.counts.topics === 0 ? (
            <p className="text-center text-sm text-text-dim">話題が1件以上集まると始められます</p>
          ) : null}
          {error ? (
            <p role="alert" className="text-center text-sm font-bold text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Drawing({
  view,
  token,
  setView,
  refresh,
}: {
  view: RoomView;
  token: string;
  setView: (v: RoomView) => void;
  refresh: () => Promise<void>;
}) {
  const [ended, setEnded] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const last = view.drawn.at(-1);
  const { room } = view;
  const drawsLeft = room.endMode === "count" && room.drawLimit ? Math.max(room.drawLimit - room.drawCount, 0) : null;

  const draw = useCallback(async (): Promise<DrawnTopic> => {
    const res = await api<DrawResult>(`/api/rooms/${room.code}/draw`, { method: "POST", token });
    setView({
      ...view,
      room: { ...room, drawCount: res.card.order },
      counts: { ...view.counts, remaining: res.remaining },
      drawn: [...view.drawn, res.card],
    });
    if (res.ended) setEnded(true);
    return { text: res.card.text, order: res.card.order };
  }, [room, token, view, setView]);

  async function end() {
    setEndError(null);
    try {
      await api(`/api/rooms/${room.code}/end`, { method: "POST", token });
      await refresh();
    } catch (e) {
      setEndError(e instanceof Error ? e.message : "終了できませんでした");
    }
  }

  return (
    <div className="flex flex-col items-center">
      <p className="mb-6 text-center text-sm text-text-dim tabular-nums">
        {drawsLeft !== null ? `あと${drawsLeft}回引けます` : `${view.counts.topics}件の話題から引いています`}
      </p>
      <CardStage
        theme={ROOM_THEME}
        deckTitle="みんなの話題"
        remaining={drawsLeft !== null ? Math.min(view.counts.remaining, drawsLeft) : view.counts.remaining}
        onDraw={draw}
        canDraw={!ended}
        initial={last ? { text: last.text, order: last.order } : null}
        blockedNote={
          <div className="flex w-full max-w-xs flex-col items-center gap-3 text-center">
            <p className="font-bold">これが最後の1枚です</p>
            <p className="text-sm text-text-dim">みんなのスマホに、全部の話題が届きました。</p>
            <button type="button" className="btn-primary w-full" onClick={() => void refresh()}>
              結果を見る
            </button>
          </div>
        }
      />

      {!ended ? (
        <div className="mt-6 w-full max-w-xs text-center">
          {confirmEnd ? (
            <div className="grid gap-2 rounded-card border border-line p-4">
              <p className="text-sm font-bold">ここで終わりにして、全員に一覧を公開しますか？</p>
              <div className="flex justify-center gap-2">
                <button type="button" className="btn-quiet min-h-10 text-sm" onClick={end}>
                  終了して公開
                </button>
                <button type="button" className="btn-ghost min-h-10 text-sm" onClick={() => setConfirmEnd(false)}>
                  続ける
                </button>
              </div>
              {endError ? <p role="alert" className="text-sm text-danger">{endError}</p> : null}
            </div>
          ) : (
            <button type="button" className="btn-ghost text-sm" onClick={() => setConfirmEnd(true)}>
              ここでガチャを終了する
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Ended({ view }: { view: RoomView }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="font-display text-[clamp(1.7rem,7vw,2.3rem)] leading-tight">ガチャ終了！</h1>
      <p className="mt-2 text-text-dim">集まった話題を全部公開しました。参加者のスマホにも同じ一覧が表示されています。</p>
      <div className="mt-10">
        <RevealList items={view.reveal ?? []} mine={view.myTopics.map((t) => t.id)} theme={ROOM_THEME} />
      </div>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/room/new" className="btn-primary">
          新しいルームを作る
        </Link>
        <Link href="/" className="btn-quiet">
          トップへ
        </Link>
      </div>
    </div>
  );
}
