// Pieces the support pages share (/support). See "Support view" in CLAUDE.md.

import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { cx } from "@/lib/utils/cx";

/** The page's outer frame, with the read-only reminder at the top. */
export function SupportPage({
  children,
  back,
  recorded = true,
}: {
  children: React.ReactNode;
  /** Where the back link goes. Left out on the search page. */
  back?: { href: string; label: string };
  /** Whether opening this page was recorded. The search page isn't. */
  recorded?: boolean;
}) {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl">
      {back && (
        <Link
          href={back.href}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-tertiary hover:text-secondary"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-primary p-4 text-sm">
        <Eye aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-warning-primary" />
        <p className="text-secondary">
          <span className="font-semibold text-primary">Support view.</span> Read only: nothing here changes the
          account or sends anyone an email.
          {recorded && " Opening this page was recorded."}
        </p>
      </div>
      {children}
    </div>
  );
}

export function SupportSection({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mt-8", className)}>
      <h2 className="mb-3 text-lg font-semibold text-primary">
        {title}
        {count !== undefined && <span className="ml-2 text-sm font-normal text-tertiary">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

/** Label and value pairs, two columns on wide screens. */
export function SupportFacts({ facts }: { facts: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 rounded-2xl border border-secondary bg-primary p-4 text-sm sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-tertiary">{fact.label}</dt>
          <dd className="break-words font-medium text-primary">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A bordered list of rows. */
export function SupportRows({ children, empty }: { children: React.ReactNode[]; empty: string }) {
  if (children.length === 0) return <p className="text-sm text-tertiary">{empty}</p>;
  return (
    <ul className="divide-y divide-secondary overflow-hidden rounded-2xl border border-secondary bg-primary">
      {children}
    </ul>
  );
}

/** A row that opens another support page from a click anywhere on it. */
export function SupportLinkRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="block px-4 py-3 text-sm transition-colors hover:bg-secondary">
        {children}
      </Link>
    </li>
  );
}

export function SupportRow({ children }: { children: React.ReactNode }) {
  return <li className="px-4 py-3 text-sm">{children}</li>;
}

export function SupportTag({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: "gray" | "brand" | "warning" | "success";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "gray" && "bg-secondary text-secondary",
        tone === "brand" && "bg-brand-primary text-brand-secondary",
        // The 700 shades: the theme's warning and success text colors are too
        // light on these backgrounds for small text (WCAG AA needs 4.5:1).
        tone === "warning" && "bg-warning-primary text-warning-700",
        tone === "success" && "bg-success-primary text-success-700",
      )}
    >
      {children}
    </span>
  );
}

/** "Nov 22, 2026" from a timestamp, or from a YYYY-MM-DD date. */
export function supportDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** "Nov 22, 2026, 3:04 PM UTC" from a timestamp. */
export function supportDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}
