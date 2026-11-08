import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/Logo";
import { DeckTile } from "@/components/DeckTile";
import { MyDecks } from "@/components/MyDecks";
import { BUILTIN_DECKS } from "@/lib/decks/builtin";
import { getDb } from "@/lib/db";
import { listOfficialDecks } from "@/lib/decks/service";

export const metadata: Metadata = { title: "デッキを選ぶ" };

const GRID = "grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-4";

export default function DecksPage() {
  return (
    <>
      <SiteHeader>
        <Link href="/decks/new" className="btn-ghost text-sm">
          デッキを作る
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="font-display text-[clamp(1.8rem,7vw,2.6rem)] leading-tight">デッキを選ぶ</h1>
        <p className="mt-2 text-text-dim">選んだデッキの山札から、1枚ずつ引いていきます。</p>

        <ul className={`${GRID} mt-9`}>
          {BUILTIN_DECKS.map((d) => (
            <DeckTile
              key={d.id}
              href={`/decks/${d.id}`}
              title={d.title}
              description={d.description}
              theme={d.theme}
              cardCount={d.cardCount}
            />
          ))}
          <Suspense fallback={null}>
            <OfficialDecks />
          </Suspense>
        </ul>

        <MyDecks />
      </main>
    </>
  );
}

async function OfficialDecks() {
  await connection();
  let decks: Awaited<ReturnType<typeof listOfficialDecks>> = [];
  try {
    decks = await listOfficialDecks(await getDb());
  } catch (err) {
    console.error("Failed to load official decks", err);
  }
  return decks.map((d) => (
    <DeckTile
      key={d.id}
      href={`/decks/${d.id}`}
      title={d.title}
      description={d.description}
      theme={d.theme}
      cardCount={d.cardCount}
    />
  ));
}
