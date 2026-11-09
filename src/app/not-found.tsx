import type { Metadata } from "next";
import Link from "next/link";
import { CardBack } from "@/components/GachaCard";
import { JoinByCode } from "@/components/JoinByCode";
import { SiteHeader } from "@/components/Logo";
import { Phrase } from "@/components/Phrase";

export const metadata: Metadata = { title: "見つかりません" };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center px-4 pt-8 pb-16 text-center sm:pt-12">
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
          <Phrase text="このカードは山札にありません" />
        </h1>
        <p className="jp-wrap mt-3 text-text-dim">
          <Phrase text="URLが違うか、デッキやルームがもう片づけられたのかもしれません。" />
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
      </main>
    </>
  );
}
