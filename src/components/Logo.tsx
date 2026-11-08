import Link from "next/link";

/** A gacha capsule: the mark used across the app. */
export function CapsuleMark({ size = 28, top = "#ff5c8a", className }: { size?: number; top?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path d="M2 16a14 14 0 0 1 28 0Z" fill={top} />
      <path d="M2 16a14 14 0 0 0 28 0Z" fill="#fffaf0" />
      <rect x="1.5" y="14.6" width="29" height="2.8" rx="1.4" fill="#16122b" opacity="0.85" />
      <ellipse cx="10.5" cy="8.6" rx="3.6" ry="2" fill="#fff" opacity="0.45" transform="rotate(-28 10.5 8.6)" />
    </svg>
  );
}

export function SiteHeader({ children, hideInLandscape = false }: { children?: React.ReactNode; hideInLandscape?: boolean }) {
  return (
    <header
      className={`mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 sm:px-6 ${
        hideInLandscape ? "short-landscape:hidden" : ""
      }`}
    >
      <Link href="/" className="flex items-center gap-2 rounded-full py-1 pr-2" aria-label="話題ガチャ トップへ">
        <CapsuleMark size={26} />
        <span className="font-display text-[1.05rem] tracking-wide">話題ガチャ</span>
      </Link>
      {children}
    </header>
  );
}
