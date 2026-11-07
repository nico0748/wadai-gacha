import Link from "next/link";
import { SiteHeader } from "@/components/Logo";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-20 text-center">
        <h1 className="font-display text-2xl">ページが見つかりません</h1>
        <p className="mt-3 text-text-dim">URLが間違っているか、デッキやルームが削除された可能性があります。</p>
        <div className="mt-8 flex justify-center">
          <Link href="/" className="btn-primary">
            トップへ
          </Link>
        </div>
      </main>
    </>
  );
}
