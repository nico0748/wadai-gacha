import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/Logo";
import { HostRoom } from "@/components/room/HostRoom";

export const metadata: Metadata = { title: "ホスト", robots: { index: false, follow: false } };

export default function HostPage({ params }: PageProps<"/room/[code]/host">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-16 sm:px-6">
        <Suspense fallback={<p className="py-20 text-center text-text-dim">読み込んでいます…</p>}>
          <Host params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Host({ params }: Pick<PageProps<"/room/[code]/host">, "params">) {
  const { code } = await params;
  return <HostRoom code={code.toUpperCase()} />;
}
