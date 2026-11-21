import Link from "next/link";
import { BRAND } from "@/lib/brand";

/**
 * The monogram on card backs and fronts: an M set in the Latin serif. It
 * takes its size and colour from the text around it.
 */
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`font-latin leading-none font-medium ${className}`}>
      M
    </span>
  );
}

/** The name, typeset: spaced capitals in the Latin serif. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-latin leading-none font-medium tracking-[0.32em] ${className}`}>{BRAND.name}</span>
  );
}

export function SiteHeader({ children, hideInLandscape = false }: { children?: React.ReactNode; hideInLandscape?: boolean }) {
  return (
    <header
      className={`mx-auto flex min-h-16 w-full max-w-5xl items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1 sm:px-6 ${
        hideInLandscape ? "short-landscape:hidden" : ""
      }`}
    >
      <Link
        href="/"
        className="-ml-1 inline-flex min-h-11 items-center rounded-md px-1 text-text"
        aria-label={`${BRAND.name} トップへ`}
      >
        <Wordmark className="text-[1.3rem] sm:text-[1.45rem]" />
      </Link>
      {children}
    </header>
  );
}
