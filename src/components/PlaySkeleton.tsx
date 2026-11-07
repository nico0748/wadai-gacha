import { CARD_WIDTH } from "./GachaCard";

export function PlaySkeleton() {
  return (
    <div className="flex flex-col items-center" aria-busy="true" aria-label="読み込み中">
      <div className="mb-8 h-8 w-40 animate-pulse rounded-full bg-ink-raised" />
      <div className="animate-pulse rounded-card bg-ink-raised" style={{ width: CARD_WIDTH, aspectRatio: "5 / 7" }} />
    </div>
  );
}
