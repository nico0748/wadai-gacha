import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/Logo";
import { EditUserDeck } from "@/components/UserDeckForms";

export const metadata: Metadata = {
  title: "デッキを編集",
  // Edit links are secrets: keep them out of search engines and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function EditDeckPage({ params }: PageProps<"/d/[shareId]/edit/[key]">) {
  return (
    <>
      <SiteHeader>
        <Link href="/decks" className="btn-ghost text-sm">
          デッキ一覧
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="mb-8 font-display text-[clamp(1.8rem,7vw,2.4rem)] leading-tight">デッキを編集</h1>
        <Suspense fallback={<p className="text-text-dim">読み込んでいます…</p>}>
          <Editor params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Editor({ params }: Pick<PageProps<"/d/[shareId]/edit/[key]">, "params">) {
  const { shareId, key } = await params;
  return <EditUserDeck shareId={decodeURIComponent(shareId)} editKey={decodeURIComponent(key)} />;
}
