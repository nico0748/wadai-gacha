import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminDeckForm } from "@/components/admin/AdminClient";
import { SiteHeader } from "@/components/Logo";
import { isAdmin } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getOfficialDeck } from "@/lib/decks/service";

export const metadata: Metadata = { title: "デッキを編集", robots: { index: false, follow: false } };

export default function EditOfficialDeckPage({ params }: PageProps<"/admin/decks/[id]">) {
  return (
    <>
      <SiteHeader>
        <Link href="/admin" className="btn-ghost text-sm">
          管理画面
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="mb-8 font-display text-[clamp(1.7rem,6vw,2.2rem)]">デッキを編集</h1>
        <Suspense fallback={<p className="text-text-dim">読み込んでいます…</p>}>
          <Editor params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/decks/[id]">, "params">) {
  const { id } = await params;
  await connection();
  if (!(await isAdmin())) redirect("/admin");
  const deck = await getOfficialDeck(await getDb(), id);
  if (!deck) notFound();
  return (
    <AdminDeckForm
      id={deck.id}
      initial={{ title: deck.title, description: deck.description, theme: deck.theme, cards: deck.cards }}
    />
  );
}
