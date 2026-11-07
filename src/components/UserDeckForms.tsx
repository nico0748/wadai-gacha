"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api, ApiError } from "@/lib/client/api";
import { forgetOwnedDeck, saveOwnedDeck } from "@/lib/client/storage";
import type { Deck, DeckInput } from "@/lib/decks/types";
import { CopyField } from "./CopyField";
import { DeckEditor } from "./DeckEditor";

const noop = () => () => {};
function useOrigin() {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}

export function NewUserDeck() {
  const router = useRouter();
  const created = useRef<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  // Next keeps this page alive in the background after we navigate to the new
  // deck. Start from an empty form when it is hidden, so going back does not
  // offer to create the same deck a second time.
  useEffect(
    () => () => {
      created.current = null;
      setFormKey((k) => k + 1);
    },
    [],
  );

  return (
    <DeckEditor
      key={formKey}
      submitLabel="デッキを作る"
      onSubmit={async (input) => {
        if (!created.current) {
          const { shareId, editKey } = await api<{ shareId: string; editKey: string }>("/api/decks", { body: input });
          saveOwnedDeck({ shareId, editKey, title: input.title.trim(), theme: input.theme });
          created.current = `/d/${shareId}/edit/${editKey}?created=1`;
        }
        router.push(created.current);
      }}
    />
  );
}

export function EditUserDeck({ shareId, editKey }: { shareId: string; editKey: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const origin = useOrigin();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const created = search.get("created") === "1";

  useEffect(() => {
    const ctrl = new AbortController();
    api<Deck>(`/api/decks/${encodeURIComponent(shareId)}`, { headers: { "X-Edit-Key": editKey }, signal: ctrl.signal })
      .then((d) => {
        setDeck(d);
        // Opening an edit link on a new device adds the deck to "自分のデッキ" there too.
        saveOwnedDeck({ shareId, editKey, title: d.title, theme: d.theme });
      })
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setLoadError(e instanceof ApiError ? e.message : "デッキを読み込めませんでした");
      });
    return () => ctrl.abort();
  }, [shareId, editKey]);

  if (loadError) {
    return (
      <div className="max-w-md">
        <p role="alert" className="font-bold text-danger">
          {loadError}
        </p>
        <Link href="/decks" className="btn-quiet mt-6">
          デッキ一覧へ
        </Link>
      </div>
    );
  }
  if (!deck) return <p className="text-text-dim">読み込んでいます…</p>;

  const shareUrl = `${origin}/d/${shareId}`;
  const editUrl = `${origin}/d/${shareId}/edit/${editKey}`;

  return (
    <div className="grid gap-12">
      <section
        className={`grid gap-5 rounded-card border p-5 sm:p-6 ${created ? "border-mint/60 bg-mint/5" : "border-line/70 bg-ink-raised/50"}`}
        aria-labelledby="share-heading"
      >
        <div>
          <h2 id="share-heading" className="font-bold">
            {created ? "デッキができました" : "共有と編集"}
          </h2>
          <p className="mt-1 text-sm text-text-dim">
            遊ぶ人には共有用URLを送ってください。編集用URLは、なくすと編集できなくなるので大切に保管してください。
          </p>
        </div>
        <CopyField label="共有用URL（遊ぶ人に送る）" value={shareUrl} />
        <CopyField label="編集用URL（自分だけで保管）" value={editUrl} note="このURLを知っている人は誰でも内容を変更・削除できます。" />
        <div>
          <Link href={`/d/${shareId}`} className="btn-primary">
            このデッキで引く
          </Link>
        </div>
      </section>

      <section aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="mb-6 text-xl font-black">
          内容を編集
        </h2>
        {saved ? (
          <p role="status" className="mb-6 font-bold text-mint">
            保存しました
          </p>
        ) : null}
        <DeckEditor
          key={deck.title + deck.cards.length}
          initial={deck}
          submitLabel="変更を保存"
          onSubmit={async (input: DeckInput) => {
            setSaved(false);
            await api(`/api/decks/${encodeURIComponent(shareId)}`, {
              method: "PUT",
              body: input,
              headers: { "X-Edit-Key": editKey },
            });
            saveOwnedDeck({ shareId, editKey, title: input.title.trim(), theme: input.theme });
            setSaved(true);
          }}
          onDelete={async () => {
            await api(`/api/decks/${encodeURIComponent(shareId)}`, { method: "DELETE", headers: { "X-Edit-Key": editKey } });
            forgetOwnedDeck(shareId);
            router.push("/decks");
          }}
        />
      </section>
    </div>
  );
}
