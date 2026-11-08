import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/Logo";
import { ParticipantRoom } from "@/components/room/ParticipantRoom";

export const metadata: Metadata = { title: "ルームに参加", robots: { index: false, follow: false } };

export default function RoomPage({ params }: PageProps<"/room/[code]">) {
  return (
    <>
      <SiteHeader />
      <main className="w-full flex-1 px-4 pt-4 pb-16 sm:px-6">
        <Suspense fallback={<p className="py-20 text-center text-text-dim">読み込んでいます…</p>}>
          <Room params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Room({ params }: Pick<PageProps<"/room/[code]">, "params">) {
  const { code } = await params;
  return <ParticipantRoom code={code.toUpperCase()} />;
}
