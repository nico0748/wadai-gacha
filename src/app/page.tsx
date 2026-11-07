import Link from "next/link";
import { SiteHeader } from "@/components/Logo";
import { CardBack } from "@/components/GachaCard";
import { JoinByCode } from "@/components/JoinByCode";
import { BUILTIN_DECKS } from "@/lib/decks/builtin";

const FAN = [
  { rotate: -11, x: "-58%", y: "10%" },
  { rotate: 0, x: "0%", y: "0%" },
  { rotate: 11, x: "58%", y: "10%" },
];

export default function Home() {
  const fanDecks = BUILTIN_DECKS.slice(0, 3);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-14 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10 lg:pt-14">
        <section>
          <h1 className="font-display text-[clamp(2.3rem,10.5vw,4.4rem)] leading-[1.18] tracking-[0.01em]">
            今夜の話題は、
            <br />
            ガチャで決める。
          </h1>
          <p className="mt-5 max-w-[30em] text-[1.02rem] text-text-dim">
            その場のみんなが話題を出し合って、ホストのスマホでカードを1枚ずつ引く。何が出るかは、めくるまで誰にもわかりません。
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:max-w-sm">
            <Link href="/room/new" className="btn-primary min-h-14 text-[1.05rem]">
              ルームを作る
            </Link>
            <Link href="/decks" className="btn-quiet min-h-14 text-[1.05rem]">
              用意されたデッキから引く
            </Link>
          </div>

          <div className="mt-8 sm:max-w-sm">
            <JoinByCode />
          </div>
        </section>

        <section aria-label="デッキ" className="relative mx-auto h-[19rem] w-full max-w-[26rem] sm:h-[23rem]">
          {fanDecks.map((deck, i) => (
            <Link
              key={deck.id}
              href={`/decks/${deck.id}`}
              className="group absolute top-0 left-1/2 w-[38%] max-w-[10.5rem] rounded-card"
              style={{
                transform: `translateX(calc(-50% + ${FAN[i].x})) translateY(${FAN[i].y}) rotate(${FAN[i].rotate}deg)`,
                zIndex: i === 1 ? 2 : 1,
              }}
              aria-label={`${deck.title}デッキで引く`}
            >
              <div className="relative aspect-[5/7] w-full shadow-[0_22px_40px_-16px_rgb(0_0_0/0.8)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-3 group-focus-visible:-translate-y-3">
                <CardBack theme={deck.theme} label={deck.title} />
              </div>
            </Link>
          ))}
          <div className="absolute inset-x-0 bottom-0 text-center text-sm text-text-dim">
            カードをタップすると、そのデッキで引けます
          </div>
        </section>

        <section className="lg:col-span-2" aria-labelledby="how">
          <h2 id="how" className="font-display text-xl">
            ルームの遊び方
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {[
              ["ホストがルームを作る", "テーブルに置いたスマホにQRコードが出ます。"],
              ["みんなが話題を投稿する", "QRを読み込んで、聞いてみたいことを何件でも。誰が何を書いたかは秘密です。"],
              ["カードを引いて話す", "ホストのスマホでめくって、出た話題でトーク。終わったら全員のスマホに一覧が届きます。"],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4 rounded-card border border-line/70 bg-ink-raised/60 p-5">
                <span className="font-display text-2xl leading-none text-lemon tabular-nums" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 text-sm text-text-dim">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-sm text-text-dim sm:px-6">
        <Link href="/decks/new" className="underline decoration-line underline-offset-4 hover:text-text">
          自分だけのデッキを作る
        </Link>
      </footer>
    </>
  );
}
