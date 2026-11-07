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

export default function DeckPage({ params }: PageProps<"/decks/[id]">) {
  return (
    <>
      <SiteHeader>
        <Link href="/decks" className="btn-ghost text-sm">
          デッキ一覧
        </Link>
      </SiteHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pt-2 pb-12 sm:px-6">
        <Suspense fallback={<PlaySkeleton />}>
          <DeckLoader params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function DeckLoader({ params }: Pick<PageProps<"/decks/[id]">, "params">) {
  const id = decodeURIComponent((await params).id);
  await connection();
  // Built-in decks never touch the database, so they keep working even if it is down.
  const deck = findBuiltinDeck(id) ?? (await getPublicDeck(await getDb(), id));
  if (!deck) notFound();
  return (
    <>
      <h1 className="mb-8 text-center font-display text-[1.5rem] leading-tight">{deck.title}</h1>
      <DeckPlayer deck={deck} />
    </>
  );
}
