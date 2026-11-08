import type { Metadata } from "next";
import { SiteHeader } from "@/components/Logo";
import { NewRoomForm } from "@/components/room/NewRoomForm";

export const metadata: Metadata = { title: "ルームを作る" };

export default function NewRoomPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-16 sm:px-6">
        <h1 className="font-display text-[clamp(1.8rem,7vw,2.4rem)] leading-tight">ルームを作る</h1>
        <p className="mt-2 text-text-dim">あとから変えられないので、始める前に決めておきましょう。</p>
        <div className="mt-10">
          <NewRoomForm />
        </div>
      </main>
    </>
  );
}
