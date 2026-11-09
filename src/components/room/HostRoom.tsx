"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useWakeLock } from "@/hooks/useWakeLock";
import { api, ApiError } from "@/lib/client/api";
import { saveRoomSession } from "@/lib/client/storage";
import type { DrawResult, RoomView } from "@/lib/rooms/types";
import { CardStage, type DrawnTopic } from "../CardStage";
import { CopyField } from "../CopyField";
import { Phrase } from "../Phrase";
import { Notice, RoomRules } from "./bits";
import { QrCode } from "./QrCode";
import { RevealList } from "./RevealList";
import { TopicComposer } from "./TopicComposer";
import { useRoom } from "./useRoom";

const ROOM_THEME = "yoru";
const noop = () => () => {};
const readHashKey = () => new URLSearchParams(window.location.hash.slice(1)).get("k");

type Claim = { kind: "confirm" } | { kind: "invalid"; message: string };

export function HostRoom({ code }: { code: string }) {
  // After the last card, stay on it until the host chooses to see the results.
  const [holding, setHolding] = useState(false);
  // A host link (#k=…) moves host rights to this device, once checked.
  const hashKey = useSyncExternalStore(noop, readHashKey, () => null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const { session, state, setView, refresh, offline, mutate } = useRoom(code, {
    pollMs: (v) => (!v || v.room.status === "collecting" ? 2000 : 8000),
    paused: holding || Boolean(hashKey),
  });
  const status = state.kind === "ready" ? state.view.room.status : null;
  useWakeLock(state.kind === "ready" && state.view.role === "host" && status !== "ended");
  // Each phase starts at the top of the screen.
  const phase = holding ? "holding" : status;
  useEffect(() => {
    if (phase && phase !== "holding") window.scrollTo(0, 0);
  }, [phase]);

  const clearHash = useCallback(() => window.history.replaceState(null, "", window.location.pathname), []);
  const takeOver = useCallback(
    (key: string) => {
      saveRoomSession(code, { token: key });
      clearHash();
      setClaim(null);
    },
    [code, clearHash],
  );

  useEffect(() => {
    if (!hashKey || session === undefined) return;
    if (session?.token === hashKey) {
      clearHash();
      return;
    }
    let cancelled = false;
    // Only a real host token may replace what this device already has.
    api<RoomView>(`/api/rooms/${encodeURIComponent(code)}`, { token: hashKey })
      .then((v) => {
        if (cancelled) return;
        if (v.role !== "host") {
          clearHash();
          setClaim({ kind: "invalid", message: "このリンクはホスト用ではありません。" });
        } else if (session) {
          setClaim({ kind: "confirm" });
        } else {
          takeOver(hashKey);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        clearHash();
        setClaim({
          kind: "invalid",
          message: e instanceof ApiError ? e.message : "リンクを確認できませんでした。電波のよい場所でもう一度開いてください。",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [hashKey, session, code, clearHash, takeOver]);

  if (claim?.kind === "invalid") {
    return (
      <Notice title="ホスト用リンクを使えませんでした" body={claim.message}>
        <Link href={`/room/${code}`} className="btn-quiet">
          参加者として開く
        </Link>
      </Notice>
    );
  }
  if (hashKey && claim?.kind === "confirm") {
    return (
      <Notice
        title="この端末をホストに切り替えますか？"
        body="この端末はすでにこのルームに参加しています。切り替えると、この端末からは参加者として出した話題が見えなくなります。"
      >
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-primary" onClick={() => takeOver(hashKey)}>
            ホストに切り替える
          </button>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => {
              clearHash();
              setClaim(null);
            }}
          >
            やめる
          </button>
        </div>
      </Notice>
    );
  }
  if (state.kind === "loading" || session === undefined || hashKey) {
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
  if (state.kind === "no-session" || !session || state.view.role !== "host") {
    return (
      <Notice
        title="この端末はホストではありません"
        body="ホスト画面は、ルームを作った端末か、ホスト用リンクを開いた端末でだけ使えます。参加者として話題を投稿しますか？"
      >
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
        <Collecting view={view} token={session.token} refresh={refresh} mutate={mutate} />
      ) : view.room.status === "drawing" || holding ? (
        <Drawing
          view={view}
          token={session.token}
          setView={setView}
          refresh={refresh}
          mutate={mutate}
          ended={holding}
          onEnded={() => setHolding(true)}
          onShowResults={async () => {
            // Fetch the reveal first, so the draw button never comes back in between.
            await refresh();
            setHolding(false);
          }}
        />
      ) : (
        <Ended view={view} />
      )}
    </>
  );
}

function HostLink({ code, token }: { code: string; token: string }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  return (
    <details className="group text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-text-dim underline decoration-line underline-offset-4 hover:text-text">
        このスマホが使えなくなったら
      </summary>
      <div className="mt-3 rounded-card border border-line/70 p-4">
        <CopyField
          label="ホスト用リンク"
          value={`${origin}/room/${code}/host#k=${token}`}
          note="別の端末でこのリンクを開くと、そこからガチャを続けられます。参加者には見せないでください。"
        />
      </div>
    </details>
  );
}

type Mutate = <T>(fn: () => Promise<T>) => Promise<T>;

function Collecting({
  view,
  token,
  refresh,
  mutate,
}: {
  view: RoomView;
  token: string;
  refresh: () => Promise<void>;
  mutate: Mutate;
}) {
  const reduce = useReducedMotion();
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const joinUrl = `${origin}/room/${view.room.code}`;
  const [confirming, setConfirming] = useState(false);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guests = view.counts.participants - 1;
  const topics = view.counts.topics;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await mutate(() => api(`/api/rooms/${view.room.code}/start`, { method: "POST", token }));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "始められませんでした");
      setBusy(false);
    }
  }

  return (
    <div className="pb-40">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-16">
        <section className="mx-auto w-full max-w-[22rem] text-center" aria-labelledby="qr-heading">
          <h1 id="qr-heading" className="font-display text-[1.6rem] leading-tight">
            QRを読み込んで、
            <br />
            話題を投稿してね
          </h1>
          <div className="mx-auto mt-6 w-[min(80vw,21rem)]">
            {origin ? <QrCode value={joinUrl} label={`参加用QRコード（${joinUrl}）`} /> : null}
          </div>
          <p className="mt-5 text-sm text-text-dim">
            ルームコード
            <span className="sr-only">{view.room.code.split("").join(" ")}</span>
          </p>
          <p className="font-display text-[2.1rem] leading-none tracking-[0.18em] tabular-nums" aria-hidden="true">
            {view.room.code}
          </p>
          {origin ? (
            <div className="mt-6 text-left">
              <CopyField label="QRが読めない人には、このURLを送る" value={joinUrl} />
            </div>
          ) : null}
        </section>

        <section className="grid gap-8" aria-label="受付の状況">
          <div className="text-center lg:text-left" aria-live="polite">
            <p className="flex items-baseline justify-center gap-2 lg:justify-start">
              <motion.span
                key={topics}
                initial={reduce ? false : { scale: 1.3, color: "#f2c46d" }}
                animate={{ scale: 1, color: "#f3efff" }}
                transition={{ type: "spring", stiffness: 300, damping: 16 }}
                className="inline-block font-display text-[3.5rem] leading-none tabular-nums"
              >
                {topics}
              </motion.span>
              <span className="text-lg font-black">件の話題が集まりました</span>
            </p>
            <p className="mt-2 text-text-dim">
              参加 <span className="font-bold text-text tabular-nums">{guests}</span> 人（ホストを除く）
            </p>
          </div>

          <div className="flex justify-center lg:justify-start">
            <RoomRules room={view.room} />
          </div>

          <div className="border-t border-line/70 pt-6">
            {composing || view.myTopics.length > 0 ? (
              <TopicComposer code={view.room.code} token={token} topics={view.myTopics} onChange={refresh} compact />
            ) : (
              <button type="button" className="btn-quiet w-full sm:w-auto" onClick={() => setComposing(true)}>
                自分も話題を出す
              </button>
            )}
          </div>

          <HostLink code={view.room.code} token={token} />
        </section>
      </div>

      {/* Sticky so the start button is always in reach on a phone. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-ink/92 px-4 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto grid max-w-xl gap-2">
          {confirming ? (
            <>
              <p className="text-center text-sm font-bold">締め切ると、もう投稿できなくなります。始めますか？</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-quiet" onClick={() => setConfirming(false)} disabled={busy}>
                  もう少し待つ
                </button>
                <button type="button" className="btn-primary" onClick={start} disabled={busy}>
                  {busy ? "準備しています…" : "始める"}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-primary min-h-14 text-[1.05rem]"
                onClick={() => setConfirming(true)}
                disabled={topics === 0}
              >
                締め切ってガチャを始める
              </button>
              {topics === 0 ? <p className="text-center text-xs text-text-dim">話題が1件以上集まると始められます</p> : null}
            </>
          )}
          {error ? (
            <p role="alert" className="text-center text-sm font-bold text-danger">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Drawing({
  view,
  token,
  setView,
  refresh,
  mutate,
  ended,
  onEnded,
  onShowResults,
}: {
  view: RoomView;
  token: string;
  setView: (v: RoomView) => void;
  refresh: () => Promise<void>;
  mutate: Mutate;
  ended: boolean;
  onEnded: () => void;
  onShowResults: () => Promise<void>;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [opening, setOpening] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const last = view.drawn.at(-1);
  const { room } = view;
  const drawsLeft =
    room.endMode === "count" && room.drawLimit ? Math.max(room.drawLimit - room.drawCount, 0) : null;
  const left = drawsLeft !== null ? Math.min(view.counts.remaining, drawsLeft) : view.counts.remaining;

  const draw = useCallback(
    (): Promise<DrawnTopic> =>
      mutate(async () => {
        const res = await api<DrawResult>(`/api/rooms/${room.code}/draw`, { method: "POST", token });
        if (res.ended) onEnded();
        setView({
          ...view,
          room: { ...room, drawCount: res.card.order },
          counts: { ...view.counts, remaining: res.remaining },
          drawn: [...view.drawn, res.card],
        });
        return { text: res.card.text, order: res.card.order };
      }),
    [room, token, view, setView, onEnded, mutate],
  );

  async function end() {
    setEndError(null);
    try {
      await mutate(() => api(`/api/rooms/${room.code}/end`, { method: "POST", token }));
      await refresh();
    } catch (e) {
      setEndError(e instanceof Error ? e.message : "終了できませんでした");
    }
  }

  return (
    <div className="flex flex-col items-center">
      <p className="mb-6 text-center text-sm text-text-dim tabular-nums short-landscape:sr-only">
        {ended
          ? `${room.drawCount}枚引きました`
          : drawsLeft !== null
            ? `あと${left}回引けます`
            : `${view.counts.topics}件の話題から引いています`}
      </p>
      <CardStage
        theme={ROOM_THEME}
        deckTitle="みんなの話題"
        remaining={left}
        onDraw={draw}
        canDraw={!ended}
        initial={last ? { text: last.text, order: last.order } : null}
        blockedNote={
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <p className="font-bold">これが最後の1枚です</p>
            <p className="jp-wrap text-sm text-text-dim">
              <Phrase text="参加者のスマホには、もう全部の話題が届いています。" />
            </p>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={opening}
              onClick={async () => {
                setOpening(true);
                await onShowResults();
                setOpening(false);
              }}
            >
              {opening ? "読み込んでいます…" : "結果を見る"}
            </button>
          </div>
        }
      />

      {!ended ? (
        <div className="mt-4 w-full max-w-xs text-center">
          {confirmEnd ? (
            <div className="grid gap-3 rounded-card border border-line p-4">
              <p className="text-sm font-bold">ここで終わりにして、全員に一覧を公開しますか？</p>
              <div className="flex justify-center gap-2">
                <button type="button" className="btn-ghost min-h-11 text-sm" onClick={() => setConfirmEnd(false)}>
                  続ける
                </button>
                <button type="button" className="btn-quiet min-h-11 text-sm" onClick={end}>
                  終了して公開
                </button>
              </div>
              {endError ? (
                <p role="alert" className="text-sm text-danger">
                  {endError}
                </p>
              ) : null}
            </div>
          ) : (
            <button type="button" className="btn-ghost min-h-11 text-sm" onClick={() => setConfirmEnd(true)}>
              ここでガチャを終了する
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-8">
        <HostLink code={room.code} token={token} />
      </div>
    </div>
  );
}

function Ended({ view }: { view: RoomView }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="font-display text-[clamp(1.7rem,7vw,2.3rem)] leading-tight">ガチャ終了！</h1>
      <p className="jp-wrap mt-2 text-text-dim">
        <Phrase text="集まった話題を全部公開しました。参加者のスマホにも同じ一覧が表示されています。" />
      </p>
      <div className="mt-10">
        <RevealList
          items={view.reveal ?? []}
          mine={view.myTopics.map((t) => t.id)}
          theme={ROOM_THEME}
          named={view.room.nameMode === "named"}
        />
      </div>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/room/new" className="btn-primary">
          もう1回ルームを作る
        </Link>
        <Link href="/" className="btn-quiet">
          トップへ
        </Link>
      </div>
    </div>
  );
}
