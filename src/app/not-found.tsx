import type { Metadata } from "next";
import { LostCard } from "@/components/LostCard";
import { SiteHeader } from "@/components/Logo";

export const metadata: Metadata = { title: "見つかりません" };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="w-full flex-1 px-4 pt-4 pb-16">
        <LostCard
          title="このカードは山札にありません"
          body="URLが違うか、デッキやルームがもう片づけられたのかもしれません。"
        />
      </main>
    </>
  );
}
