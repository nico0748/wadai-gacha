import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLogin, AdminLogout } from "@/components/admin/AdminClient";
import { SiteHeader } from "@/components/Logo";
import { Notice } from "@/components/room/bits";
import { isAdmin } from "@/lib/api";
import { adminEnabled } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { BUILTIN_DECKS } from "@/lib/decks/builtin";
import { listOfficialDecks } from "@/lib/decks/service";
import { themeOf } from "@/lib/decks/themes";

export const metadata: Metadata = { title: "管理", robots: { index: false, follow: false } };

export default function AdminPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <Suspense fallback={<p className="text-text-dim">読み込んでいます…</p>}>
          <AdminHome />
        </Suspense>
      </main>
    </>
  );
}

function Swatch({ theme }: { theme: string }) {
  const t = themeOf(theme);
  return (
    <span
      className="h-9 w-7 shrink-0 rounded-md"
      style={{ background: `linear-gradient(150deg, ${t.from}, ${t.to})` }}
      aria-hidden="true"
    />
  );
}

async function AdminHome() {
  await connection();
  if (!adminEnabled()) {
    return (
      <Notice
        title="管理画面は無効です"
        body="環境変数 ADMIN_PASSWORD を設定してサーバーを起動すると、ここから公式デッキを追加・編集できます。"
      />
    );
  }
  if (!(await isAdmin())) {
    return (
      <>
        <h1 className="mb-8 text-center font-display text-2xl">管理画面</h1>
        <AdminLogin />
      </>
    );
  }

  const decks = await listOfficialDecks(await getDb());

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[clamp(1.7rem,6vw,2.2rem)]">デッキの管理</h1>
        <AdminLogout />
      </div>

      <section className="mt-10" aria-labelledby="official">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="official" className="font-bold">
            管理画面で追加したデッキ
          </h2>
          <Link href="/admin/decks/new" className="btn-primary min-h-10 px-4 text-sm">
            デッキを追加
          </Link>
        </div>
        {decks.length === 0 ? (
          <p className="mt-4 text-sm text-text-dim">まだありません。追加したデッキはデッキ一覧の最後に並びます。</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/60 rounded-card border border-line/70">
            {decks.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/decks/${d.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-ink-raised/60">
                  <Swatch theme={d.theme} />
                  <span className="min-w-0 flex-1 truncate font-bold">{d.title}</span>
                  <span className="text-sm text-text-dim tabular-nums">{d.cardCount}枚</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12" aria-labelledby="builtin">
        <h2 id="builtin" className="font-bold">
          最初から入っているデッキ
        </h2>
        <p className="mt-1 text-sm text-text-dim">
          src/data/decks のJSONファイルで管理しています。変更するときはファイルを編集してデプロイしてください。
        </p>
        <ul className="mt-4 divide-y divide-line/60 rounded-card border border-line/70">
          {BUILTIN_DECKS.map((d) => (
            <li key={d.id} className="flex items-center gap-4 px-4 py-3">
              <Swatch theme={d.theme} />
              <span className="min-w-0 flex-1 truncate font-bold">{d.title}</span>
              <span className="text-sm text-text-dim tabular-nums">{d.cardCount}枚</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
