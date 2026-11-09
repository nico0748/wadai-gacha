import Link from "next/link";
import { CardBack } from "./GachaCard";
import { JoinByCode } from "./JoinByCode";
import { Phrase } from "./Phrase";

/**
 * The screen for something that is not on the table: a face-down card, the
 * way to the decks and the room code field. The 404 page and rooms that do
 * not exist (any more) share it.
 */
export function LostCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center pt-4 text-center sm:pt-8">
      {/* A face-down card left on the table, with one more under it. */}
      <div className="relative aspect-[5/7] w-[min(46vw,11rem)]" aria-hidden="true">
        <div className="absolute inset-0 translate-x-[9%] translate-y-[3%] rotate-[9deg] brightness-[0.6]">
          <CardBack theme="yoru" />
        </div>
        <div className="absolute inset-0 -rotate-[5deg] rounded-card shadow-[0_22px_40px_-16px_rgb(0_0_0/0.85)]">
          <CardBack theme="yoru" />
        </div>
      </div>

      <h1 className="jp-wrap mt-10 font-display text-[clamp(1.45rem,6.4vw,1.9rem)] leading-snug">
        <Phrase text={title} />
      </h1>
      <p className="jp-wrap mt-3 text-text-dim">
        <Phrase text={body} />
      </p>

      <div className="mt-8 grid w-full max-w-xs gap-3">
        <Link href="/decks" className="btn-primary">
          デッキ一覧を見る
        </Link>
        <Link href="/" className="btn-quiet">
          トップへ戻る
        </Link>
      </div>

      <div className="mt-10 w-full max-w-xs text-left">
        <JoinByCode />
      </div>
    </div>
  );
}

/** A room code that leads nowhere: never made, mistyped, or expired. */
export function RoomNotFound() {
  return (
    <LostCard title="ルームが見つかりません" body="コードが違うか、ルームの期限が切れて片づけられたのかもしれません。" />
  );
}
