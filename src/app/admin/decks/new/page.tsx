import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminDeckForm } from "@/components/admin/AdminClient";
import { SiteHeader } from "@/components/Logo";
import { isAdmin } from "@/lib/api";

export const metadata: Metadata = { title: "デッキを追加", robots: { index: false, follow: false } };

export default function NewOfficialDeckPage() {
  return (
    <>
      <SiteHeader>
        <Link href="/admin" className="btn-ghost text-sm">
          管理画面
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="mb-8 font-display text-[clamp(1.7rem,6vw,2.2rem)]">デッキを追加</h1>
        <Suspense fallback={<p className="text-text-dim">読み込んでいます…</p>}>
          <Guarded />
        </Suspense>
      </main>
    </>
  );
}

async function Guarded() {
  await connection();
  if (!(await isAdmin())) redirect("/admin");
  return <AdminDeckForm />;
}
