export function PlaySkeleton() {
  return (
    <div className="flex flex-col items-center" aria-busy="true" aria-label="読み込み中">
      <div className="card-size aspect-[5/7] animate-pulse rounded-card bg-ink-raised" />
    </div>
  );
}
