import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/Logo";
import { EditUserDeck } from "@/components/UserDeckForms";
import { getDb } from "@/lib/db";
import { getUserDeck } from "@/lib/decks/service";

export const metadata: Metadata = {
  title: "デッキを編集",
  // Edit links are secrets: keep them out of search engines and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// The deck is looked up before any Suspense boundary, so a missing deck shows
// the not-found screen (a real 404 when rendered dynamically). The edit key is
// still checked by the API the editor calls.
export const instant = false;

export default async function EditDeckPage({ params }: PageProps<"/d/[shareId]/edit/[key]">) {
  const { shareId, key } = await params;
  await connection();
  const id = decodeURIComponent(shareId);
  if (!(await getUserDeck(await getDb(), id))) notFound();
  return (
    <>
      <SiteHeader>
        <Link href="/decks" className="btn-ghost text-sm">
          デッキ一覧
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="mb-8 font-display text-[clamp(1.8rem,7vw,2.4rem)] leading-tight">デッキを編集</h1>
        {/* The editor reads ?created=1 from the URL. */}
        <Suspense fallback={<p className="text-text-dim">読み込んでいます…</p>}>
          <EditUserDeck shareId={id} editKey={decodeURIComponent(key)} />
        </Suspense>
      </main>
    </>
  );
}
