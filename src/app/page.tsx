import Link from "next/link";
import { SiteHeader } from "@/components/Logo";
import { CardBack } from "@/components/GachaCard";
import { JoinByCode } from "@/components/JoinByCode";
import { Phrase } from "@/components/Phrase";
import { findBuiltinDeck } from "@/lib/decks/builtin";
import type { Deck } from "@/lib/decks/types";

/** The decks on the home table: よる, the logo's colours, in the middle. */
const FAN_DECKS = ["zatsudan", "shotaimen", "game"];
const FAN = [
  { rotate: -11, x: "-58%", y: "10%" },
  { rotate: 0, x: "0%", y: "0%" },
  { rotate: 11, x: "58%", y: "10%" },
];

export default function Home() {
  const fanDecks = FAN_DECKS.map((id) => findBuiltinDeck(id)).filter((d): d is Deck => d !== undefined);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-14 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:pt-14">
        <section>
          <h1 className="jp-wrap font-display text-[clamp(2.9rem,15vw,4.75rem)] leading-[1.14] tracking-[0.02em]">
            めくって、
            <br />
            話そう。
          </h1>
          <p className="jp-wrap mt-6 max-w-[30em] text-[1.02rem] text-text-dim">
            <Phrase text="みんなで話題を出し合って、テーブルに置いたスマホでカードを1枚ずつめくります。何が出るかは、お楽しみです。" />
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:max-w-sm">
            <Link href="/room/new" className="btn-primary min-h-14 text-[1.05rem]">
              ルームを作る
            </Link>
            <Link href="/decks" className="btn-quiet min-h-14 text-[1.05rem]">
              用意されたデッキでめくる
            </Link>
          </div>

          <div className="mt-8 sm:max-w-sm">
            <JoinByCode />
          </div>
        </section>

        <section aria-label="デッキ" className="@container mx-auto w-full max-w-[26rem]">
          {/* As tall as the fan: a card is 38% of the width (at most 10.5rem), 7/5 as tall,
              and the side cards hang a little lower. */}
          <div className="relative h-[min(62cqi,17.1rem)]">
            {fanDecks.map((deck, i) => (
              <Link
                key={deck.id}
                href={`/decks/${deck.id}`}
                className="group absolute top-0 left-1/2 w-[38%] max-w-[10.5rem] rounded-card"
                style={{
                  transform: `translateX(calc(-50% + ${FAN[i].x})) translateY(${FAN[i].y}) rotate(${FAN[i].rotate}deg)`,
                  zIndex: i === 1 ? 2 : 1,
                }}
                aria-label={`${deck.title}デッキでめくる`}
              >
                <div className="relative aspect-[5/7] w-full rounded-card shadow-[0_22px_40px_-16px_rgb(0_0_0/0.8)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-3 group-focus-visible:-translate-y-3">
                  <CardBack theme={deck.theme} label={i === 1 ? deck.title : undefined} />
                </div>
              </Link>
            ))}
          </div>
          <ul className="mt-3 flex justify-center gap-3 text-sm font-bold text-text-dim">
            {fanDecks.map((deck) => (
              <li key={deck.id}>
                <Link href={`/decks/${deck.id}`} className="inline-flex min-h-11 items-center rounded-full px-3 hover:text-text">
                  {deck.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-2" aria-labelledby="how">
          <h2 id="how" className="text-lg font-black">
            ルームの遊び方
          </h2>
          <ol className="mt-4 grid border-t border-line/70 sm:grid-cols-3 sm:gap-8 sm:border-t-0">
            {[
              ["ホストがルームを作る", "テーブルに置いたスマホにQRコードが出ます。"],
              ["みんなが話題を投稿する", "QRを読み込んで、聞いてみたいことを何件でも。誰が何を書いたかは秘密です。"],
              ["カードをめくって話す", "ホストのスマホで1枚ずつめくって、出た話題でトーク。終わったら全員のスマホに一覧が届きます。"],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-5 border-b border-line/70 py-5 sm:border-t sm:border-b-0">
                <span className="w-8 shrink-0 font-display text-[2.5rem] leading-none text-lamp tabular-nums" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-black">{title}</h3>
                  <p className="jp-wrap mt-1 text-sm text-text-dim">
                    <Phrase text={body} />
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-text-dim sm:px-6">
        <Link
          href="/decks/new"
          className="inline-flex min-h-11 items-center underline decoration-line underline-offset-4 hover:text-text"
        >
          自分だけのデッキを作る
        </Link>
      </footer>
    </>
  );
}
