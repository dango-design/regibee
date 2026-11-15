"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/utils/cx";

// The two views of the Saved tab: things saved for yourself, on your lists,
// and gift ideas for other people, which only you can see.
const VIEWS = [
  { href: "/dashboard/saved", label: "For me" },
  { href: "/dashboard/saved/ideas", label: "Gift ideas" },
];

export function SavedViews() {
  const pathname = usePathname() ?? "";
  return (
    <div className="container mx-auto px-4 pt-6">
      <nav aria-label="Saved">
        <ul className="inline-flex rounded-lg bg-secondary_alt p-0.5 ring-1 ring-secondary ring-inset max-sm:flex max-sm:w-full">
          {VIEWS.map((view) => {
            const current = pathname === view.href;
            return (
              <li key={view.href} className="max-sm:flex-1">
                <Link
                  href={view.href}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "flex min-h-9 items-center justify-center rounded-md px-3 text-sm font-semibold whitespace-nowrap outline-focus-ring transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2",
                    current
                      ? "bg-primary_alt text-secondary shadow-xs ring-1 ring-primary ring-inset"
                      : "text-tertiary hover:text-secondary",
                  )}
                >
                  {view.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
