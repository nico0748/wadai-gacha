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
import { JoinByCode } from "../JoinByCode";
import { Phrase } from "../Phrase";
import { BottomBar, Notice, RoomRules } from "./bits";
import { RevealCountdown } from "./countdown";
import { QrCode } from "./QrCode";
import { MakeDeckButton, ShareListButton } from "./ResultActions";
import { RevealList } from "./RevealList";
import { TopicComposer } from "./TopicComposer";
import { phaseOf, useRoom } from "./useRoom";

const ROOM_THEME = "yoru";
const noop = () => () => {};
const readHashKey = () => new URLSearchParams(window.location.hash.slice(1)).get("k");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Claim = { kind: "confirm" } | { kind: "invalid"; message: string };

/** The host drives every change, so it only polls to see guests arrive and, rarely, to catch a reveal. */
function hostPollMs(view: RoomView | null, due: boolean): number | null {
  if (!view) return 2000;
  switch (phaseOf(view)) {
    case "collecting":
      return 2000;
    case "drawing":
      return 8000;
    // Cheap (?v=) and lets a host whose last refresh failed catch up.
    case "held":
      return due ? 200 : 3000;
    default:
      return null;
  }
}

export function HostRoom({ code }: { code: string }) {
  // A host link (#k=…) moves host rights to this device, once checked.
  const hashKey = useSyncExternalStore(noop, readHashKey, () => null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const { session, state, setView, refresh, offline, mutate, clockOffset } = useRoom(code, {
    pollMs: hostPollMs,
    paused: Boolean(hashKey),
  });
  const phase = state.kind === "ready" ? phaseOf(state.view) : null;
  // The phone stays awake on the table until there is nothing left to show.
  useWakeLock(state.kind === "ready" && state.view.role === "host" && phase !== "done");
  // Each screen starts at the top. The last card stays put while the list is held.
  const screen =
    phase === null ? null : phase === "collecting" ? "collect" : phase === "drawing" || phase === "held" ? "draw" : "results";
  useEffect(() => {
    if (screen) window.scrollTo(0, 0);
  }, [screen]);

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
      <Notice title="ルームが見つかりません" body={state.message} footer={<JoinByCode />}>
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
      {phase === "collecting" ? (
        <Collecting view={view} token={session.token} refresh={refresh} mutate={mutate} />
      ) : phase === "drawing" || phase === "held" ? (
        <Drawing view={view} token={session.token} setView={setView} refresh={refresh} mutate={mutate} />
      ) : (
        <Results view={view} token={session.token} refresh={refresh} mutate={mutate} />
      )}
      {phase === "held" ? <RevealCountdown revealAt={view.revealAt} offsetMs={clockOffset} /> : null}
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
          note="別の端末でこのリンクを開くと、そこから続けられます。参加者には見せないでください。"
        />
      </div>
    </details>
  );
}

type Mutate = <T>(fn: () => Promise<T>) => Promise<T>;

function errorText(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

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
      setError(errorText(e, "始められませんでした"));
      setBusy(false);
    }
  }

  return (
    <div className="pb-52">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-16">
        <section className="mx-auto w-full max-w-[22rem] text-center" aria-labelledby="qr-heading">
          <h1 id="qr-heading" className="font-display text-[1.6rem] leading-tight">
            QRを読み込んで、
            <br />
            話題を投稿してね
          </h1>
          {/* Smaller on short phones, so the code and the bottom bar fit too. */}
          <div className="mx-auto mt-6 w-[min(80vw,21rem)] [@media(max-height:759.98px)]:w-[min(64vw,17rem)]">
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

      {/* Sticky so the counts and the start button are always in reach on a phone. */}
      <BottomBar>
        <div className="flex items-baseline justify-center gap-x-5" aria-live="polite">
          <p className="flex items-baseline gap-1.5">
            <motion.span
              key={topics}
              initial={reduce ? false : { scale: 1.35, color: "#f2c46d" }}
              animate={{ scale: 1, color: "#eef0f7" }}
              transition={{ type: "spring", stiffness: 300, damping: 16 }}
              className="inline-block font-display text-[2rem] leading-none"
            >
              {topics}
            </motion.span>
            <span className="font-black">件の話題</span>
          </p>
          <p className="text-sm text-text-dim">
            参加 <span className="font-bold text-text tabular-nums">{guests}</span> 人
            <span className="sr-only">（ホストを除く）</span>
          </p>
        </div>
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
              締め切ってめくり始める
            </button>
            {topics === 0 ? <p className="text-center text-xs text-text-dim">話題が1件以上集まると始められます</p> : null}
          </>
        )}
        {error ? (
          <p role="alert" className="text-center text-sm font-bold text-danger">
            {error}
          </p>
        ) : null}
      </BottomBar>
    </div>
  );
}

/** Draws once more if the network dropped the request; `expectedOrder` keeps that from drawing twice. */
async function postDraw(code: string, token: string, expectedOrder: number): Promise<DrawResult> {
  const send = () => api<DrawResult>(`/api/rooms/${code}/draw`, { body: { expectedOrder }, token });
  try {
    return await send();
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 0) throw e;
    await sleep(700);
    return send();
  }
}

function Drawing({
  view,
  token,
  setView,
  refresh,
  mutate,
}: {
  view: RoomView;
  token: string;
  setView: (v: RoomView) => void;
  refresh: () => Promise<void>;
  mutate: Mutate;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  // Ending or signalling the reveal; stays on until the list arrives.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const last = view.drawn.at(-1);
  const { room } = view;
  const ended = room.status === "ended";
  const drawsLeft =
    room.endMode === "count" && room.drawLimit ? Math.max(room.drawLimit - room.drawCount, 0) : null;
  const left = drawsLeft !== null ? Math.min(view.counts.remaining, drawsLeft) : view.counts.remaining;

  const draw = useCallback(
    async (): Promise<DrawnTopic> => {
      try {
        return await mutate(async () => {
          const res = await postDraw(room.code, token, room.drawCount + 1);
          const known = view.drawn.some((c) => c.id === res.card.id);
          setView({
            ...view,
            room: {
              ...room,
              drawCount: Math.max(room.drawCount, res.card.order),
              status: res.ended ? "ended" : room.status,
            },
            counts: { ...view.counts, remaining: res.remaining },
            drawn: known ? view.drawn : [...view.drawn, res.card],
            revealAt: res.revealAt,
          });
          return { text: res.card.text, order: res.card.order, rare: res.card.rare };
        });
      } catch (e) {
        // Another host device drew meanwhile: show the room as it is now.
        if (e instanceof ApiError && e.status === 409) void refresh();
        throw e;
      }
    },
    [room, token, view, setView, mutate, refresh],
  );

  async function run(path: "end" | "reveal") {
    setBusy(true);
    setError(null);
    try {
      const res = await mutate(() =>
        path === "end"
          ? api<{ revealAt: string | null }>(`/api/rooms/${room.code}/end`, { body: { reveal: true }, token })
          : api<{ revealAt: string | null }>(`/api/rooms/${room.code}/reveal`, { method: "POST", token }),
      );
      // Start the countdown from the answer itself, so it runs even if the refresh fails.
      setView({ ...view, room: { ...room, status: "ended" }, revealAt: res.revealAt });
      // The countdown takes over from here; the list replaces this screen when it opens.
      await refresh();
    } catch (e) {
      setError(errorText(e, path === "end" ? "終了できませんでした" : "合図を送れませんでした"));
      setBusy(false);
    }
  }

  const why =
    view.counts.remaining === 0
      ? "これが最後の1枚です"
      : drawsLeft === 0
        ? "決めた回数をめくりました"
        : "ここで終わりにしました";

  return (
    <div className={`flex flex-col items-center ${confirmEnd && !ended ? "pb-44" : ""}`}>
      <p className="mb-6 text-center text-sm text-text-dim tabular-nums short-landscape:sr-only">
        {ended
          ? `${room.drawCount}枚めくりました`
          : drawsLeft !== null
            ? `あと${left}回めくれます`
            : `${view.counts.topics}件の話題からめくっています`}
      </p>
      <CardStage
        theme={ROOM_THEME}
        deckTitle="みんなの話題"
        remaining={left}
        onDraw={draw}
        canDraw={!ended}
        initial={last ? { text: last.text, order: last.order, rare: last.rare } : null}
        blockedNote={
          <div className="flex w-full flex-col items-center gap-3 text-center">
            <p className="font-bold">{why}</p>
            <p className="jp-wrap text-sm text-text-dim">
              <Phrase text="合図をすると、みんなのスマホで一覧が一斉に開きます。" />
            </p>
            <button type="button" className="btn-primary w-full" disabled={busy} onClick={() => run("reveal")}>
              {busy ? "合図を送っています…" : "せーので公開"}
            </button>
            {error ? (
              <p role="alert" className="text-sm font-bold text-danger">
                {error}
              </p>
            ) : null}
          </div>
        }
      />

      {!ended && !confirmEnd ? (
        <div className="mt-4 w-full max-w-xs text-center">
          <button type="button" className="btn-ghost min-h-11 text-sm" onClick={() => setConfirmEnd(true)}>
            ここで終わりにする
          </button>
        </div>
      ) : null}

      <div className="mt-8">
        <HostLink code={room.code} token={token} />
      </div>

      {confirmEnd && !ended ? (
        <BottomBar>
          <p className="text-center text-sm font-bold">ここで終わりにして、せーので一覧を公開しますか？</p>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" className="btn-quiet" onClick={() => setConfirmEnd(false)} disabled={busy}>
              続ける
            </button>
            <button type="button" className="btn-primary px-4" onClick={() => run("end")} disabled={busy}>
              {busy ? "合図を送っています…" : "終了してせーので公開"}
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-center text-sm font-bold text-danger">
              {error}
            </p>
          ) : null}
        </BottomBar>
      ) : null}
    </div>
  );
}

type AnswerMode = "choose" | "guess" | "list";

function Results({
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
  const items = view.reveal ?? [];
  const total = items.length;
  const shown = view.room.authorsShown;
  const named = view.room.nameMode === "named" && total > 0;
  // A reload in the middle of 答え合わせ picks up at the next hidden author.
  const [mode, setMode] = useState<AnswerMode>(() =>
    !named || shown >= total ? "list" : shown === 0 ? "choose" : "guess",
  );
  const [cursor, setCursor] = useState(() => Math.min(shown, Math.max(total - 1, 0)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function showUpTo(upTo: number) {
    setBusy(true);
    setError(null);
    try {
      await mutate(() => api(`/api/rooms/${view.room.code}/answers`, { body: { upTo }, token }));
      await refresh();
      if (upTo >= total) setMode("list");
    } catch (e) {
      setError(errorText(e, "うまくいきませんでした"));
    } finally {
      setBusy(false);
    }
  }

  const errorLine = error ? (
    <p role="alert" className="text-center text-sm font-bold text-danger">
      {error}
    </p>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <h1 className="font-display text-[clamp(1.7rem,7vw,2.3rem)] leading-tight">ぜんぶオープン！</h1>
      <p className="jp-wrap mt-2 text-text-dim">
        <Phrase text="集まった話題を全部公開しました。参加者のスマホにも同じ一覧が表示されています。" />
      </p>

      {mode === "choose" ? (
        <section className="mt-8 grid gap-3 rounded-card border border-lamp/40 bg-lamp/5 p-5" aria-labelledby="answers-heading">
          <h2 id="answers-heading" className="font-black">
            誰が書いたかは、まだ秘密です
          </h2>
          <p className="text-sm text-text-dim">みんなで当ててから名前を出すか、すぐに全部見せるかを選べます。</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setCursor(Math.min(shown, total - 1));
                setMode("guess");
              }}
            >
              誰が書いたか当てる
            </button>
            <button type="button" className="btn-quiet" onClick={() => showUpTo(total)} disabled={busy}>
              名前を全部見せる
            </button>
          </div>
          {errorLine}
        </section>
      ) : null}

      {mode === "guess" ? (
        <Guess
          items={items}
          cursor={cursor}
          shown={shown}
          busy={busy}
          onAnswer={() => showUpTo(cursor + 1)}
          onNext={() => (cursor + 1 < total ? setCursor(cursor + 1) : setMode("list"))}
          onShowAll={() => showUpTo(total)}
          error={errorLine}
        />
      ) : (
        <div className="mt-10">
          <RevealList items={items} mine={view.myTopics.map((t) => t.id)} theme={ROOM_THEME} named={named} />
        </div>
      )}

      <div className="mt-12 grid gap-3 sm:flex sm:flex-wrap">
        <ShareListButton items={items} />
        <MakeDeckButton items={items} />
      </div>
      <p className="mt-2 text-sm text-text-dim">デッキには名前を入れません。作るボタンを押すまで保存されません。</p>
      <div className="mt-10 flex flex-wrap gap-3">
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

/** 答え合わせ on the host's phone: one topic at a time, everyone guesses, then 答え. */
function Guess({
  items,
  cursor,
  shown,
  busy,
  onAnswer,
  onNext,
  onShowAll,
  error,
}: {
  items: { id: string; text: string; author: string | null }[];
  cursor: number;
  shown: number;
  busy: boolean;
  onAnswer: () => void;
  onNext: () => void;
  onShowAll: () => void;
  error: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const item = items[cursor];
  const revealed = cursor < shown;
  if (!item) return null;
  return (
    <section className="mt-8 grid justify-items-center gap-5 text-center" aria-labelledby="guess-heading">
      <h2 id="guess-heading" className="text-sm font-bold text-text-dim tabular-nums">
        誰が書いたか当てよう（{cursor + 1} / {items.length}）
      </h2>
      <motion.div
        key={item.id}
        initial={reduce ? false : { opacity: 0, y: 12, rotate: -2 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        className="grid min-h-48 w-full max-w-sm place-items-center rounded-card bg-paper px-6 py-8 text-paper-ink shadow-[0_24px_48px_-20px_rgb(0_0_0/0.85)]"
      >
        <p className="jp-wrap text-[clamp(1.35rem,6vw,1.8rem)] leading-snug font-black">
          <Phrase text={item.text} />
        </p>
      </motion.div>
      <div aria-live="polite">
        <p className="text-sm text-text-dim">書いたのは</p>
        <motion.p
          key={revealed ? "name" : "hidden"}
          initial={reduce || !revealed ? false : { scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
          className={`font-display text-[clamp(1.8rem,9vw,2.6rem)] leading-tight ${revealed ? "text-lamp" : ""}`}
        >
          {revealed ? item.author : "？"}
        </motion.p>
      </div>
      <div className="grid w-full max-w-sm gap-2">
        {revealed ? (
          <button type="button" className="btn-primary min-h-14 text-[1.05rem]" onClick={onNext}>
            {cursor + 1 < items.length ? "次へ" : "一覧を見る"}
          </button>
        ) : (
          <button type="button" className="btn-primary min-h-14 text-[1.05rem]" onClick={onAnswer} disabled={busy}>
            答え
          </button>
        )}
        {shown < items.length ? (
          <button type="button" className="btn-ghost text-sm" onClick={onShowAll} disabled={busy}>
            残りを全部見せる
          </button>
        ) : null}
        {error}
      </div>
    </section>
  );
}
