"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cx } from "@/lib/utils/cx";

/**
 * A page split into sections with a navigation beside them, like the Account
 * page and the edit event page. The page lays out the navigation and its
 * sections with SECTION_NAV_GRID, inside a container that's max-w-2xl, and
 * lg:max-w-5xl from lg. Each section has its id and SECTION_SCROLL_MARGIN,
 * and a SectionTitle.
 */
export interface PageSection {
  /** The section's id on the page, and its link's #fragment. */
  id: string;
  label: string;
  /** Things waiting, like follow requests, shown as a number next to the label. */
  waiting?: number;
}

/** The navigation on the left from `lg`, and the sections beside it. */
export const SECTION_NAV_GRID = "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-10";

/**
 * Room above a section when the page scrolls to it: the top bar, plus the
 * row of section links that sticks under it below `lg`. The navigation reads
 * it back to tell which section is current.
 */
export const SECTION_SCROLL_MARGIN = "scroll-mt-34 lg:scroll-mt-24";

export function sectionTitleId(sectionId: string) {
  return `${sectionId}-title`;
}

/**
 * A section's title. It's the h2 that the navigation moves focus to, so
 * screen readers say which section someone jumped to and Tab carries on from
 * there. It looks like a card title, unless the page gives it a look of its own.
 */
export function SectionTitle({
  sectionId,
  className = "font-sans leading-none font-semibold tracking-normal",
  children,
}: {
  sectionId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={sectionTitleId(sectionId)} tabIndex={-1} className={cx(className, "outline-none")}>
      {children}
    </h2>
  );
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function scrollMargin(element: HTMLElement) {
  return parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
}

/**
 * Which section is current, and a way to go to one.
 *
 * As the page scrolls, the current section is the last one whose top has
 * reached the top of the page. At the very bottom it's the last section,
 * since the short ones down there never reach the top. A section someone
 * picked stays current while the page scrolls to it, and after, as long as
 * it's in view and the page can't scroll any further: at the bottom, or on a
 * screen tall enough to show the whole page.
 */
function useCurrentSection(ids: string[], aliases: Record<string, string>) {
  const [current, setCurrent] = useState<string | null>(ids[0] ?? null);
  const idsRef = useRef(ids);
  // A page's old ids don't change while it's open.
  const aliasesRef = useRef(aliases);
  // The section someone picked, and whether the scroll to it is still going.
  const picked = useRef<string | null>(null);
  const scrolling = useRef(false);
  const settleTimer = useRef<number | undefined>(undefined);

  const update = useCallback(() => {
    const sections = idsRef.current
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    if (sections.length === 0) return;

    const root = document.documentElement;
    // The page can't scroll any further down: it's at the bottom, or it all fits.
    const atEnd = window.innerHeight + window.scrollY >= root.scrollHeight - 2;
    const atBottom = window.scrollY > 0 && atEnd;

    const pickedSection = picked.current ? document.getElementById(picked.current) : null;
    if (pickedSection) {
      const { top, bottom } = pickedSection.getBoundingClientRect();
      const inView = top < window.innerHeight && bottom > scrollMargin(pickedSection);
      if (scrolling.current || (atEnd && inView)) {
        setCurrent(pickedSection.id);
        return;
      }
      picked.current = null;
    }

    if (atBottom) {
      setCurrent(sections[sections.length - 1].id);
      return;
    }
    let next = sections[0].id;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= scrollMargin(section) + 24) next = section.id;
    }
    setCurrent(next);
  }, []);

  // A scroll has settled once no scroll event comes for a moment.
  const waitForScrollToSettle = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      scrolling.current = false;
      update();
    }, 150);
  }, [update]);

  const goTo = useCallback(
    (requested: string, { smooth = true, rewriteUrl = true }: { smooth?: boolean; rewriteUrl?: boolean } = {}) => {
      const id = aliasesRef.current[requested] ?? requested;
      const section = document.getElementById(id);
      if (!section || !idsRef.current.includes(id)) return;

      picked.current = id;
      scrolling.current = true;
      setCurrent(id);
      waitForScrollToSettle();
      section.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto", block: "start" });
      (document.getElementById(sectionTitleId(id)) ?? section).focus({ preventScroll: true });
      // null lets Next.js keep its own history state and learn the new URL.
      if (rewriteUrl && window.location.hash !== `#${id}`) window.history.replaceState(null, "", `#${id}`);
    },
    [waitForScrollToSettle],
  );

  // Sections come and go, like Blocked after blocking someone. This runs
  // before the effect below, so a link's section is known on the first visit.
  const key = ids.join(" ");
  useEffect(() => {
    idsRef.current = key.split(" ");
    update();
  }, [key, update]);

  useEffect(() => {
    const onScroll = () => {
      if (scrolling.current) waitForScrollToSettle();
      update();
    };
    // A link to a section, from another page or an email, lands here. When
    // the page has a loading skeleton, it shows first, so Next.js has already
    // scrolled to the top by the time the section exists: go to it now.
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      // Section ids are plain words, so a hash that needs decoding isn't one.
      if (/^[\w-]+$/.test(hash)) goTo(hash, { smooth: false });
    };

    fromHash();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("hashchange", fromHash);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      window.removeEventListener("hashchange", fromHash);
      window.clearTimeout(settleTimer.current);
    };
  }, [goTo, update, waitForScrollToSettle]);

  return [current, goTo] as const;
}

const NO_ALIASES: Record<string, string> = {};

/**
 * A page's list of sections. On wide screens it's a column on the left that
 * stays in view; below `lg` it's a row of links that sticks under the top bar
 * and scrolls sideways on its own, never the page. The current section
 * follows the scroll, and following a link moves focus to that section's
 * title.
 */
export function SectionNav({
  sections,
  label,
  aliases = NO_ALIASES,
}: {
  sections: PageSection[];
  /** What screen readers call the navigation: "Account sections". */
  label: string;
  /** Old section ids that links still use, and the section each one means now. */
  aliases?: Record<string, string>;
}) {
  const [current, goTo] = useCurrentSection(
    sections.map((section) => section.id),
    aliases,
  );
  const listRef = useRef<HTMLUListElement>(null);

  // In the row of links, bring the current one into view.
  useEffect(() => {
    const list = listRef.current;
    const link = current ? list?.querySelector<HTMLElement>(`a[href="#${current}"]`) : null;
    if (!list || !link || list.scrollWidth <= list.clientWidth) return;
    const left = link.offsetLeft;
    const right = left + link.offsetWidth;
    if (left >= list.scrollLeft && right <= list.scrollLeft + list.clientWidth) return;
    list.scrollTo({
      left: left - (list.clientWidth - link.offsetWidth) / 2,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [current]);

  return (
    <nav
      aria-label={label}
      className={cx(
        "sticky top-16 z-30 -mx-4 mb-6 border-b border-secondary bg-primary/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-primary/80",
        "lg:top-24 lg:mx-0 lg:mb-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none lg:supports-[backdrop-filter]:bg-transparent",
      )}
    >
      <ul
        ref={listRef}
        className="scrollbar-hide relative flex gap-1 overflow-x-auto py-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:py-0"
      >
        {sections.map((section) => {
          const isCurrent = section.id === current;
          return (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={isCurrent ? "location" : undefined}
                onClick={(event) => {
                  // Let a new tab or window open the link as it would.
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                  event.preventDefault();
                  goTo(section.id);
                }}
                className={cx(
                  "flex min-h-9 items-center gap-2 rounded-full px-3 text-sm whitespace-nowrap transition-colors outline-focus-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
                  "lg:min-h-10 lg:justify-between lg:rounded-md lg:whitespace-normal",
                  isCurrent ? "bg-brand-50 font-medium text-brand-600" : "text-tertiary hover:bg-secondary hover:text-primary",
                )}
              >
                {section.label}
                {section.waiting ? (
                  <Badge>
                    {section.waiting}
                    <span className="sr-only"> waiting</span>
                  </Badge>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
