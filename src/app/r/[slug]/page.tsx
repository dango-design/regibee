import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Gift } from "lucide-react";
import { readEventGuestCookie } from "@/lib/event-guest-cookie";
import { buildBuyerRegistryUrl, verifyBuyerLink } from "@/lib/buyer-link";
import { listForOldLink } from "@/lib/list-links";
import type { Metadata } from "next";
import { ScrollToTop } from "@/components/scroll-to-top";
import { PoweredByFooter } from "@/components/site-footer";
import { SuggestItemDialog } from "@/components/suggest-item-dialog";
import { PublicRegistryGrid } from "@/components/public-registry-grid";
import { PublicRegistryHero } from "@/components/public-registry-hero";
import { WishListHero } from "@/components/wish-list-hero";
import { OwnerChip } from "@/components/owner-chip";
import { FollowButton } from "@/components/follow-button";
import { Nav } from "@/components/nav";
import { SECRET_GIVER_NAME, isGiftLinkStep } from "@/lib/gifts";
import { ReservationsHiddenNotice } from "@/components/reservations-hidden-notice";
import { FellowGuestsNotice } from "@/components/fellow-guests-notice";
import type { OpenGift } from "@/components/reserve-item-dialog";
import { GuestPrefillProvider } from "@/components/guest-prefill-context";
import { registrySettingsHref } from "@/lib/registry-settings-sections";
import { ListEventsNotice } from "@/components/list-events-notice";
import { MY_GIFTS_COOKIE } from "@/lib/my-gifts-cookie";
import { getPublicRegistry, listHiddenFromViewer, loadPublicList } from "@/lib/public-list-page";
import type { GuestGifts } from "@/lib/public-list-page-types";

// Someone else's list, as its guests see it. What it shows comes from
// loadPublicList (src/lib/public-list-page.ts), which the phone app's list
// screen uses too. This page reads the guest's cookies and passes them in.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const registry = await getPublicRegistry(slug);

  if (!registry || (await listHiddenFromViewer(registry))) return { title: "Registry Not Found" };

  return {
    title: `${registry.title} | Regibee`,
    description: registry.description || `View and shop ${registry.title}`,
    ...(!registry.is_public && { robots: { index: false, follow: false } }),
  };
}

/** The guest's gifts from their cookie, or none when it's missing or not JSON. */
async function readMyGiftsCookie(): Promise<GuestGifts> {
  const raw = (await cookies()).get(MY_GIFTS_COOKIE)?.value;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as GuestGifts) : {};
  } catch {
    return {};
  }
}

export default async function PublicRegistryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ email?: string; sig?: string; gift?: string; step?: string }>;
}) {
  const { slug } = await params;
  const { email: buyerEmail, sig, gift: giftParam, step: stepParam } = await searchParams;

  const [gifts, eventGuest] = await Promise.all([
    readMyGiftsCookie(),
    readEventGuestCookie().catch((err) => {
      console.error("[registry] Failed to read the event guest cookie:", err);
      return null;
    }),
  ]);
  const page = await loadPublicList(slug, {
    gifts,
    buyer: buyerEmail && sig ? { email: buyerEmail, sig } : null,
    eventGuest,
  });

  if (!page) {
    // The list may have a new link (src/lib/list-links.ts). A guest's signed
    // link from their gift emails still leads to it. Anyone else with the old
    // link sees the not-found page. A private list is not found either way.
    if (buyerEmail && sig && !(await getPublicRegistry(slug))) {
      const moved = await listForOldLink(slug);
      let signed = false;
      try {
        signed = Boolean(moved) && verifyBuyerLink(buyerEmail, slug, sig);
      } catch {
        // A signature of the wrong length.
      }
      if (moved && signed) {
        redirect(buildBuyerRegistryUrl({ siteUrl: "", slug: moved.slug, buyerEmail }));
      }
    }
    notFound();
  }

  const {
    registry,
    owner,
    ownerRelation,
    parentName,
    giftProfile,
    showBirthday,
    hideReservations,
    santaFor,
    fellowGuests,
    guestPrefill,
  } = page;
  const isBabyRegistry = registry.registry_type === "baby";
  const allCategories = page.categories;

  // A link from a guest's email opens the gift dialog at a step. The link
  // route has already put the gift in this browser's cookie.
  const openGift: OpenGift | undefined =
    giftParam &&
    page.items.some((i) => i.id === giftParam) &&
    (isGiftLinkStep(stepParam) || stepParam === "ended")
      ? { itemId: giftParam, step: stepParam }
      : undefined;

  return (
    <div className="min-h-screen bg-primary">
      {/* The site's top bar. Logging in or signing up from it comes back
          to this list. */}
      <Nav returnTo={`/r/${registry.slug}`} />

      <div id="main-content">
        {isBabyRegistry ? (
          <PublicRegistryHero
            isBabyRegistry
            title={registry.title}
            photoUrl={registry.photo_url}
            names={registry.honoree_names || registry.parent_names}
            eventDate={registry.event_date}
            description={registry.description}
            fulfilledItems={page.fulfilledItems}
            totalItems={page.totalItems}
            owner={owner && ownerRelation ? owner : null}
            followButton={
              owner &&
              ownerRelation &&
              !ownerRelation.isOwner && (
                <FollowButton
                  publicId={owner.publicId}
                  name={owner.name}
                  state={ownerRelation.state}
                  returnTo={`/r/${slug}`}
                />
              )
            }
          />
        ) : (
          // A wishlist: no date, since one list usually serves many
          // occasions. The owner's sizes and likes go in its summary card.
          <WishListHero
            title={registry.title}
            photoUrl={registry.photo_url}
            description={registry.description}
            fulfilledItems={page.fulfilledItems}
            totalItems={page.totalItems}
            ownerName={owner?.name}
            ownerChip={
              owner &&
              ownerRelation && (
                <OwnerChip
                  name={owner.name}
                  path={owner.path}
                  publicId={owner.publicId}
                  state={ownerRelation.isOwner ? null : ownerRelation.state}
                  returnTo={`/r/${slug}`}
                />
              )
            }
            giftProfile={giftProfile}
            giftProfileName={page.giftProfileName}
            showBirthday={showBirthday}
          />
        )}

        {/* Items. With no items or funds yet, the grid says so and still offers
            "Suggest an item". */}
        <main className="container mx-auto px-4 py-8">
          {hideReservations && (
            <ReservationsHiddenNotice
              className="mb-6"
              settingsHref={registrySettingsHref(registry.id, "reservations")}
              turnedOnByExchange={page.hiddenByExchange}
            />
          )}
          {santaFor && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sunshine-200 dark:border-sunshine-900 bg-sunshine-50 dark:bg-sunshine-400/10 p-4">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold text-primary">You&apos;re {santaFor}&apos;s Secret Santa.</p>
                <p className="text-sm text-secondary">
                  {santaFor} sees &ldquo;{SECRET_GIVER_NAME}&rdquo; instead of your name.
                </p>
              </div>
            </div>
          )}
          <ListEventsNotice
            className="mb-6"
            // The notice below already names the event this guest came from.
            events={page.listEvents}
          />
          {fellowGuests && (
            <FellowGuestsNotice
              className="mb-6"
              eventTitle={fellowGuests.eventTitle}
              eventHref={`/e/${fellowGuests.eventSlug}`}
              ownerName={fellowGuests.ownerName}
            />
          )}
          <GuestPrefillProvider value={guestPrefill}>
            <PublicRegistryGrid
              items={page.items}
              categories={allCategories}
              cashFunds={page.cashFunds}
              parentName={parentName}
              paymentMethods={page.paymentMethods ?? undefined}
              shippingAddress={page.shippingAddress ?? undefined}
              myGifts={page.myGifts}
              myItemGifts={page.myItemGifts}
              reservedCounts={page.reservedCounts}
              claims={fellowGuests?.claims}
              openGift={openGift}
              coverCounts={page.coverCounts}
              selfPurchasedLabel={page.selfPurchasedLabel}
              coverFlavor={page.coverFlavor}
              linkedStores={page.linkedStores}
              showStoreRegistries={page.showStoreRegistries}
              groupGifts={
                page.groupGifts
                  ? {
                      registryId: registry.id,
                      signedIn: page.signedIn,
                      returnTo: `/r/${slug}`,
                      mine: page.groupGifts.mine,
                      eventTitle: page.groupGifts.eventTitle,
                    }
                  : undefined
              }
              suggestButton={
                <SuggestItemDialog
                  registryId={registry.id}
                  categories={allCategories.map((c) => ({ id: c.id, name: c.name }))}
                />
              }
            />
          </GuestPrefillProvider>
        </main>
      </div>

      <PoweredByFooter />

      <ScrollToTop />
    </div>
  );
}
