import Image from "next/image";
import Link from "next/link";
import title from "@/assets/mekutalk-title.png";

/** The speech bubble from the めくトーク icon, used on card backs and fronts. */
export function BubbleMark({
  color = "#8388af",
  dots = "#ffffff",
  className,
}: {
  color?: string;
  dots?: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path
        d="M16 4.5c7.46 0 13.5 4.66 13.5 10.4S23.46 25.3 16 25.3c-1.38 0-2.72-.16-3.98-.46L5.6 28.9l1.72-5.86C4.3 21.15 2.5 18.2 2.5 14.9 2.5 9.16 8.54 4.5 16 4.5z"
        fill={color}
      />
      <circle cx="10.3" cy="14.9" r="2.05" fill={dots} />
      <circle cx="16" cy="14.9" r="2.05" fill={dots} />
      <circle cx="21.7" cy="14.9" r="2.05" fill={dots} />
    </svg>
  );
}

export function SiteHeader({ children, hideInLandscape = false }: { children?: React.ReactNode; hideInLandscape?: boolean }) {
  return (
    <header
      className={`mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1 sm:px-6 ${
        hideInLandscape ? "short-landscape:hidden" : ""
      }`}
    >
      <Link href="/" className="-ml-1 block rounded-xl" aria-label="めくトーク トップへ">
        <Image src={title} alt="" preload sizes="(min-width: 640px) 182px, 148px" className="h-[3.25rem] w-auto sm:h-16" />
      </Link>
      {children}
    </header>
  );
}
