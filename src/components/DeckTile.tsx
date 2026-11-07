import Link from "next/link";
import { CardBack } from "./GachaCard";

export function DeckTile({
  href,
  title,
  description,
  theme,
  cardCount,
  children,
}: {
  href: string;
  title: string;
  description?: string;
  theme: string;
  cardCount?: number;
  children?: React.ReactNode;
}) {
  return (
    <li className="group relative">
      <Link href={href} className="block rounded-card focus-visible:outline-offset-4">
        <div className="relative mx-auto aspect-[5/7] w-[78%]">
          <div className="absolute inset-0 translate-x-[7%] translate-y-[4%] rotate-[5deg] brightness-[0.72]">
            <CardBack theme={theme} />
          </div>
          <div className="absolute inset-0 shadow-[0_18px_34px_-16px_rgb(0_0_0/0.85)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-2 group-hover:-rotate-2">
            <CardBack theme={theme} label={title} />
          </div>
        </div>
        <div className="mt-4 px-1">
          <h3 className="flex items-baseline justify-between gap-2 font-bold">
            <span className="truncate">{title}</span>
            {cardCount !== undefined ? (
              <span className="shrink-0 text-xs font-bold text-text-dim tabular-nums">{cardCount}枚</span>
            ) : null}
          </h3>
          {description ? <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-text-dim">{description}</p> : null}
        </div>
      </Link>
      {children}
    </li>
  );
}
