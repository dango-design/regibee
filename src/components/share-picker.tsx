import Link from "next/link";
import { ChevronRight, Gift01, Lightbulb02, Link01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { RegistryAvatar, monogramFor } from "@/components/registry-avatar";
import { occasionLabel } from "@/lib/registry-copy";
import type { SharedLink } from "@/lib/shared-link";
import type { PersonalEventType, RegistryType } from "@/lib/types";

export interface ShareRegistry {
  id: string;
  title: string;
  registryType: RegistryType;
  eventType: PersonalEventType | null;
  photoUrl: string | null;
  /** Who the registry is for, for the monogram when there's no photo. */
  names: string | null;
}

function shareParams(shared: SharedLink): URLSearchParams {
  const params = new URLSearchParams({ add: "1", url: shared.url });
  if (shared.title) params.set("title", shared.title);
  return params;
}

/** The registry page with the add item dialog open on the shared link. */
export function addSharedLinkHref(registryId: string, shared: SharedLink): string {
  return `/dashboard/registry/${registryId}?${shareParams(shared)}`;
}

/** The Gift ideas view with the save dialog open on the shared link. */
export function saveGiftIdeaHref(shared: SharedLink): string {
  return `/dashboard/saved/ideas?${shareParams(shared)}`;
}

const choiceClass =
  "flex min-h-16 items-center gap-3 rounded-2xl border border-secondary bg-primary p-3 transition hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * What /share shows: where a product shared from a phone goes. It goes on one
 * of the owner's registries, or it's a gift idea for someone else, which only
 * the owner can see. Someone with no registry can still save a gift idea.
 */
export function SharePicker({ shared, registries }: { shared: SharedLink | null; registries: ShareRegistry[] }) {
  return (
    <div className="container mx-auto max-w-lg px-4 pt-6 pb-10">
      {!shared ? (
        <>
          <h1 className="font-display text-display-xs font-semibold text-primary">There&apos;s no link to add</h1>
          <p className="mt-2 text-tertiary">
            What you shared didn&apos;t include a link to a product. Open the product in its store&apos;s app or
            your browser, then share it to Regibee again.
          </p>
          <Button asChild className="mt-6 max-sm:w-full">
            <Link href="/dashboard">Go to my registries</Link>
          </Button>
        </>
      ) : (
        <>
          <h1 className="font-display text-display-xs font-semibold text-primary">Where should this go?</h1>

          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-secondary p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary">
              <Link01 aria-hidden="true" className="size-5 text-fg-quaternary" />
            </span>
            <div className="min-w-0">
              {shared.title && <p className="line-clamp-2 font-medium text-primary">{shared.title}</p>}
              <p className="truncate text-sm text-tertiary">{linkHost(shared.url)}</p>
            </div>
          </div>

          <h2 className="mt-6 text-sm font-semibold text-secondary">For you</h2>
          {registries.length === 0 ? (
            <p className="mt-2 text-sm text-tertiary">
              To add it to a registry of your own, first{" "}
              <Link
                href="/dashboard/registry/new"
                className="rounded-sm font-medium text-brand-tertiary underline underline-offset-4 outline-focus-ring hover:text-brand-secondary focus-visible:outline-2"
              >
                create a registry
              </Link>
              , then share it to Regibee again.
            </p>
          ) : (
            <ul className="mt-2 space-y-3">
              {registries.map((registry) => (
                <li key={registry.id}>
                  <Link href={addSharedLinkHref(registry.id, shared)} className={choiceClass}>
                    {registry.photoUrl || monogramFor(registry.names) ? (
                      <RegistryAvatar
                        photoUrl={registry.photoUrl}
                        names={registry.names}
                        className="size-12 text-base ring-2"
                      />
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-primary">
                        <Gift01 aria-hidden="true" className="size-5 text-brand-secondary" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-primary">{registry.title}</span>
                      <span className="block text-sm text-tertiary">
                        {occasionLabel(registry.registryType, registry.eventType)}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-quaternary" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-6 text-sm font-semibold text-secondary">For someone else</h2>
          <Link href={saveGiftIdeaHref(shared)} className={`mt-2 ${choiceClass}`}>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sunshine-100 dark:bg-sunshine-400/15">
              <Lightbulb02 aria-hidden="true" className="size-5 text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-primary">Save as a gift idea</span>
              <span className="block text-sm text-tertiary">Only you can see it. The person never does.</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-quaternary" />
          </Link>
        </>
      )}
    </div>
  );
}
