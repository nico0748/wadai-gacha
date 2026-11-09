import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DeckPlayer } from "@/components/DeckPlayer";
import { SiteHeader } from "@/components/Logo";
import { PlaySkeleton } from "@/components/PlaySkeleton";
import { getDb } from "@/lib/db";
import { findBuiltinDeck } from "@/lib/decks/builtin";
import { getPublicDeck } from "@/lib/decks/service";

// Ids are looked up before any Suspense boundary, so a request that is
// rendered dynamically (e.g. a link-preview bot) gets a real 404. There is
// deliberately no generateStaticParams: with it, `next start` writes a cache
// entry to disk for every unknown id requested, so random URLs would fill it.
export const instant = false;

async function loadAdminDeck(id: string) {
  await connection();
  return getPublicDeck(await getDb(), id);
}

export default async function DeckPage({ params }: PageProps<"/decks/[id]">) {
  const id = decodeURIComponent((await params).id);
  // Built-in decks never touch the database, so they keep working even if it
  // is down.
  const deck = findBuiltinDeck(id) ?? (await loadAdminDeck(id));
  if (!deck) notFound();
  return (
    <>
      <SiteHeader hideInLandscape>
        <Link href="/decks" className="btn-ghost text-sm">
          デッキ一覧
        </Link>
      </SiteHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center overflow-x-clip px-4 pt-2 pb-12 sm:px-6 short-landscape:py-4">
        <h1 className="mb-7 text-center text-sm font-bold text-text-dim short-landscape:sr-only">{deck.title}</h1>
        {/* The player shuffles on mount, so it is rendered per visit. */}
        <Suspense fallback={<PlaySkeleton />}>
          <DeckPlayer deck={deck} />
        </Suspense>
      </main>
    </>
  );
}
