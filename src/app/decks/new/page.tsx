import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/Logo";
import { NewUserDeck } from "@/components/UserDeckForms";

export const metadata: Metadata = { title: "デッキを作る" };

export default function NewDeckPage() {
  return (
    <>
      <SiteHeader>
        <Link href="/decks" className="btn-ghost text-sm">
          デッキ一覧
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="font-display text-[clamp(1.8rem,7vw,2.4rem)] leading-tight">デッキを作る</h1>
        <p className="mt-2 max-w-[36em] text-text-dim">
          作ったデッキは、共有用のURLを知っている人だけが遊べます。ログインは不要で、編集用のURLを持っている人だけが内容を変えられます。
        </p>
        <div className="mt-10">
          <NewUserDeck />
        </div>
      </main>
    </>
  );
}
