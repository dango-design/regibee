import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One section of the My registries tab: a heading, maybe a link to see more,
 * and what's under it. The tab is a stack of these, so it can show whatever
 * matters most to the person right now. Today that's their events and their
 * lists. Later it may add recent updates, such as gifts and new items on
 * lists they follow or price changes. A new section is one more of these.
 * The phone app's home screen has the same parts (mobile/src/components/home).
 */
export function HomeSection({
  id,
  title,
  more,
  className,
  children,
}: {
  /** Names the section for screen readers, as `${id}-heading`. */
  id: string;
  title: string;
  /** A link at the heading's right, like "All events". */
  more?: { title: string; href: string };
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={className}>
      <div className="flex items-baseline justify-between gap-4 px-1">
        {/* tracking-normal: the base h2 style tightens letter spacing. */}
        <h2 id={`${id}-heading`} className="font-display text-xl font-bold tracking-normal">
          {title}
        </h2>
        {more && (
          <Link href={more.href} className="text-sm font-semibold text-brand-tertiary hover:underline">
            {more.title}
          </Link>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
