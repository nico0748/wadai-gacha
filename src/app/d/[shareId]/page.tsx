import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DeckPlayer } from "@/components/DeckPlayer";
import { SiteHeader } from "@/components/Logo";
import { PlaySkeleton } from "@/components/PlaySkeleton";
import { ShareButton } from "@/components/ShareButton";
import { getDb } from "@/lib/db";
import { getUserDeck } from "@/lib/decks/service";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function UserDeckPage({ params }: PageProps<"/d/[shareId]">) {
  return (
    <>
      <SiteHeader hideInLandscape>
        <Link href="/decks" className="btn-ghost text-sm">
          デッキ一覧
        </Link>
      </SiteHeader>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center overflow-clip px-4 pt-2 pb-12 sm:px-6 short-landscape:py-4">
        <Suspense fallback={<PlaySkeleton />}>
          <Loader params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Loader({ params }: Pick<PageProps<"/d/[shareId]">, "params">) {
  const { shareId } = await params;
  await connection();
  const deck = await getUserDeck(await getDb(), decodeURIComponent(shareId));
  if (!deck) notFound();
  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-1 text-center short-landscape:sr-only">
        <h1 className="text-sm font-bold text-text-dim">{deck.title}</h1>
        <ShareButton title={`${deck.title} | 話題ガチャ`} />
      </div>
      <DeckPlayer deck={deck} />
    </>
  );
}
