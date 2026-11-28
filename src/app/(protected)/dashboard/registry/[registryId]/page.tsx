import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AddItemDialog } from "@/components/add-item-dialog";
import { ItemCard } from "@/components/item-card";
import { PlainLinksNotice } from "@/components/plain-links-notice";
import { MissingDetailsNotice } from "@/components/missing-details-notice";
import { PriceCheck } from "@/components/price-check";
import { ElfsterSync } from "@/components/elfster-sync";
import { SortIntoCategoriesButton } from "@/components/sort-into-categories-button";
import { DetailReview } from "@/components/detail-review";
import { RegistryTabs } from "@/components/registry-tabs";
import { StorePerksCard } from "@/components/store-perks-card";
import { SuggestionInbox } from "./suggestion-inbox";
import { CategoryNav, type CategoryNavItem } from "@/components/category-nav";
import { getCategorySectionId } from "@/lib/category-section-id";
import { ScrollToTop } from "@/components/scroll-to-top";
import { ArriveAtTop } from "@/components/arrive-at-top";
import { AddCashFundDialog } from "@/components/add-cash-fund-dialog";
import { CashFundCard } from "@/components/cash-fund-card";
import { FundsPositionMenu } from "@/components/funds-position-menu";
import { coveredQuantity, fundsPosition, listProgress } from "@/lib/gifts";
import type { PaymentMethods } from "@/lib/types";
import { PandaMark } from "@/components/panda-mark";
import { copyForRegistry, occasionLabel } from "@/lib/registry-copy";
import { formatPrice } from "@/lib/money";
import { formatGiftDate, giftActivityFor, giftActivityTag } from "@/lib/gifts";
import { ReservationsHiddenNotice } from "@/components/reservations-hidden-notice";
import { OwnerListTop } from "@/components/owner-list-top";
import { ListHeaderPicker } from "@/components/list-header-picker";
import { headerChoice, headerOccasion, listHeader } from "@/lib/list-headers";
import { listVisibility, profileAudience } from "@/lib/list-access";
import { findSharedLink } from "@/lib/shared-link";
import { getSessionUser } from "@/lib/viewer";
import { loadListPage, type ListPageItem } from "@/lib/list-page";
import { registrySettingsHref } from "@/lib/registry-settings-sections";

export default async function RegistryManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ registryId: string }>;
  searchParams: Promise<{ highlight?: string; tab?: string; add?: string; url?: string; title?: string }>;
}) {
  const { registryId } = await params;
  const { highlight, tab, add, url: addUrl, title: addTitle } = await searchParams;
  // A product shared from a phone (/share): open the add item dialog on it.
  const sharedLink = add ? findSharedLink({ url: addUrl, title: addTitle }) : null;

  if (!(await getSessionUser())) {
    redirect("/login");
  }

  // The phone app loads the same data (src/lib/list-page.ts).
  const data = await loadListPage(registryId);
  if (!data) {
    notFound();
  }

  const {
    registry,
    hideReservations,
    turnedOnByExchange,
    revealInfo,
    linkedEvents,
    checklistProgress,
    showChecklist,
    linkedRegistries,
    plainLinkGroups,
    perkRows,
    zipCode,
    canPlanEvents,
    eventPromptDismissed,
    pendingSuggestionCount,
    missingDetails = [],
    priceChecks = [],
    detailReview = [],
    elfsterSyncs = [],
  } = data;
  const registryLinkStores = data.storesWithRegistryLinks;
  const allSuggestions = data.suggestions;
  const allPurchases = data.purchases;
  const allFunds = data.funds;
  const allCategories = data.categories;
  const allItems = data.items;
  const otherListsByItem = new Map(allItems.map((item) => [item.id, item.otherLists.length > 0 ? item.otherLists : undefined]));
  // Under hidden reservations, "Change this in settings" goes to that setting.
  const settingsHref = registrySettingsHref(registryId, "reservations");
  const copy = copyForRegistry(registry);

  // Build purchase lookup maps for item/fund cards
  const purchasesByItemId = new Map<string, typeof allPurchases>();
  const purchasesByFundId = new Map<string, typeof allPurchases>();
  for (const p of allPurchases) {
    if (p.registry_item_id) {
      if (!purchasesByItemId.has(p.registry_item_id)) purchasesByItemId.set(p.registry_item_id, []);
      purchasesByItemId.get(p.registry_item_id)!.push(p);
    }
    if (p.cash_fund_id) {
      if (!purchasesByFundId.has(p.cash_fund_id)) purchasesByFundId.set(p.cash_fund_id, []);
      purchasesByFundId.get(p.cash_fund_id)!.push(p);
    }
  }

  const totalItems = allItems.length;
  // An item a manager bought counts as gifted only once guests cover it or
  // they mark it as gifted (src/lib/gifts.ts).
  const progress = listProgress(allItems, (i) => coveredQuantity(purchasesByItemId.get(i.id)));

  // Group items by category
  const itemsByCategory = new Map<string | null, ListPageItem[]>();
  for (const item of allItems) {
    const key = item.category_id;
    if (!itemsByCategory.has(key)) {
      itemsByCategory.set(key, []);
    }
    itemsByCategory.get(key)!.push(item);
  }

  // Build navigation items for category sidebar
  const navItems: CategoryNavItem[] = [];
  for (const category of allCategories) {
    const categoryItems = itemsByCategory.get(category.id) || [];
    if (categoryItems.length > 0) {
      navItems.push({
        id: getCategorySectionId(category.id),
        name: category.name,
        count: categoryItems.length,
      });
    }
  }
  const uncategorizedItems = itemsByCategory.get(null) || [];
  if (uncategorizedItems.length > 0) {
    navItems.push({
      id: getCategorySectionId(null),
      name: "Other",
      count: uncategorizedItems.length,
    });
  }
  // Gift funds go above the items or after them, as the list's managers chose.
  const fundsAt = fundsPosition(registry.settings);
  if (allFunds.length > 0) {
    const fundsNav = { id: "gift-funds", name: "Gift Funds", count: allFunds.length };
    if (fundsAt === "top") navItems.unshift(fundsNav);
    else navItems.push(fundsNav);
  }
  const paymentMethods = (registry.settings?.payment_methods as PaymentMethods | undefined) ?? null;

  const fundsSection =
    allFunds.length > 0 ? (
      <div id="gift-funds" className="scroll-mt-20">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            Gift Funds
            <Badge variant="secondary">{allFunds.length}</Badge>
          </h3>
          <FundsPositionMenu registryId={registryId} position={fundsAt} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {allFunds.map((fund) => (
            <CashFundCard key={fund.id} fund={fund} registryId={registryId} highlightId={highlight} purchases={purchasesByFundId.get(fund.id)} />
          ))}
        </div>
      </div>
    ) : null;

  const registryUrl = `/r/${registry.slug}`;
  const accessColumns = {
    is_public: Boolean(registry.is_public),
    is_private: registry.is_private as boolean | null,
    listed_on_profile: registry.listed_on_profile as boolean | null,
    profile_audience: registry.profile_audience as string | null,
  };
  const visibility = listVisibility(accessColumns);
  const audience = profileAudience(accessColumns);

  return (
    <>
      {/* The top looks like the page guests see. Notices that used to stack
          here each take one part of the card under the title. */}
      <OwnerListTop
        registryId={registryId}
        title={registry.title}
        photoUrl={registry.photo_url}
        occasion={occasionLabel(registry.registry_type, registry.event_type)}
        itemCount={totalItems}
        dateLabel={
          registry.event_date
            ? `${copy.eventDateLabel}: ${new Date(registry.event_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}`
            : null
        }
        // canPlanEvents is false only for a guest account, which has no profile.
        access={{ visibility, audience, href: registrySettingsHref(registryId, "sharing"), noProfile: !canPlanEvents }}
        sharePath={registryUrl}
        links={{
          preview: registryUrl,
          settings: `/dashboard/registry/${registryId}/settings`,
          // Once the card's "Planning a party?" is dismissed, or the list has
          // an event, planning one is still in the ⋯ menu.
          plan:
            canPlanEvents && (eventPromptDismissed || linkedEvents.length > 0)
              ? `/dashboard/events/new?registry=${registryId}`
              : null,
        }}
        manager={!data.isOwner}
        header={listHeader(headerChoice(registry.settings))}
        customize={
          <ListHeaderPicker
            registryId={registryId}
            title={registry.title}
            header={listHeader(headerChoice(registry.settings))}
            occasion={headerOccasion(registry.registry_type, registry.event_type)}
          />
        }
        progress={hideReservations ? null : progress}
        hidden={
          hideReservations
            ? {
                revealed: revealInfo?.revealedCount ?? 0,
                href: `/dashboard/registry/${registryId}?tab=purchases`,
                settingsHref,
                next: revealInfo?.next,
                turnedOnByExchange,
              }
            : null
        }
        events={linkedEvents}
        planPrompt={canPlanEvents && !eventPromptDismissed}
        checklist={
          showChecklist
            ? { ...checklistProgress, essentials: data.checklistEssentials, href: `/dashboard/registry/${registryId}/checklist` }
            : null
        }
      />

    <div className="container mx-auto px-4 py-8">

      <RegistryTabs
        totalItems={totalItems + allFunds.length}
        purchaseCount={allPurchases.length}
        suggestionCount={pendingSuggestionCount}
        itemsContent={
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h2 className="text-xl font-semibold">Registry Items</h2>
              <div className="flex flex-wrap items-center gap-2">
                <AddCashFundDialog registryId={registryId} paymentMethods={paymentMethods} />
                <AddItemDialog registryId={registryId} categories={allCategories} zipCode={zipCode} registryType={registry.registry_type} eventType={registry.event_type} linkedRegistries={linkedRegistries} storesWithRegistryLinks={registryLinkStores} openWithLink={sharedLink ?? undefined} />
              </div>
            </div>

            <DetailReview registryId={registryId} reviews={detailReview} className="mb-6" />

            {/* Always there, so it keeps reading while the page refreshes after each item. */}
            <MissingDetailsNotice registryId={registryId} items={missingDetails} className="mb-6" />

            {/* Always there too, so a page refresh after a new price doesn't start it again. */}
            <PriceCheck registryId={registryId} items={priceChecks} className="mb-6" />

            {/* The same, for a list kept in sync with an Elfster wishlist. */}
            <ElfsterSync registryId={registryId} wishlistIds={elfsterSyncs} className="mb-6" />

            {plainLinkGroups.length > 0 && (
              <div className="mb-6">
                <PlainLinksNotice registryId={registryId} groups={plainLinkGroups} />
              </div>
            )}

            {totalItems === 0 && allFunds.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <PandaMark className="mb-4 h-20 w-auto" />
                  {/* A baby registry starts from the checklist: what most
                      new parents need, a tap each to add. */}
                  <p className="text-tertiary">
                    {showChecklist ? "No items yet. Start with the essentials on the checklist." : "No items yet."}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {showChecklist ? (
                      <>
                        <Button asChild>
                          <Link href={`/dashboard/registry/${registryId}/checklist`}>
                            <span className="inline-flex items-center gap-1.5">
                              <ListChecks className="h-4 w-4 shrink-0" />
                              Open the checklist
                            </span>
                          </Link>
                        </Button>
                        <AddItemDialog
                          registryId={registryId}
                          categories={allCategories}
                          zipCode={zipCode}
                          registryType={registry.registry_type}
                          eventType={registry.event_type}
                          linkedRegistries={linkedRegistries}
                          storesWithRegistryLinks={registryLinkStores}
                          trigger={
                            <Button variant="outline">
                              <span className="inline-flex items-center gap-1.5">
                                <Plus className="h-4 w-4 shrink-0" />
                                Add item
                              </span>
                            </Button>
                          }
                        />
                      </>
                    ) : (
                      <AddItemDialog registryId={registryId} categories={allCategories} zipCode={zipCode} registryType={registry.registry_type} eventType={registry.event_type} linkedRegistries={linkedRegistries} storesWithRegistryLinks={registryLinkStores} />
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex gap-8 items-start">
                {/* Shown from one section up, like the public page, so a
                    registry with a single category still gets the sidebar. */}
                {navItems.length >= 1 && <CategoryNav categories={navItems} />}
                <div className="flex-1 min-w-0 space-y-8">
                  {fundsAt === "top" && fundsSection}

                  {allCategories.map((category) => {
                    const categoryItems = itemsByCategory.get(category.id) || [];
                    if (categoryItems.length === 0) return null;

                    return (
                      <div key={category.id} id={getCategorySectionId(category.id)} className="scroll-mt-20">
                        <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                          {category.name}
                          <Badge variant="secondary">{categoryItems.length}</Badge>
                        </h3>
                        <div className="grid gap-3 md:grid-cols-2">
                          {categoryItems.map((item) => (
                            <ItemCard
                              key={item.id}
                              item={item}
                              registryId={registryId}
                              isOwner
                              categories={allCategories}
                              zipCode={zipCode}
                              highlightId={highlight}
                              purchases={purchasesByItemId.get(item.id)}
                              selfPurchaseButtonLabel={copy.selfPurchaseButton}
                              registryType={registry.registry_type}
                              eventType={registry.event_type}
                              linkedRegistries={linkedRegistries}
                              storesWithRegistryLinks={registryLinkStores}
                              otherLists={otherListsByItem.get(item.id)}
                              otherListIds={item.otherListIds}
                              ownerLists={data.ownerLists}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Uncategorized items */}
                  {(itemsByCategory.get(null) || []).length > 0 && (
                    <div id={getCategorySectionId(null)} className="scroll-mt-20">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-display text-lg font-semibold">Other</h3>
                        <SortIntoCategoriesButton registryId={registryId} count={itemsByCategory.get(null)!.length} />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {itemsByCategory.get(null)!.map((item) => (
                          <ItemCard
                            key={item.id}
                            item={item}
                            registryId={registryId}
                            isOwner
                            categories={allCategories}
                            zipCode={zipCode}
                            highlightId={highlight}
                            purchases={purchasesByItemId.get(item.id)}
                            selfPurchaseButtonLabel={copy.selfPurchaseButton}
                            registryType={registry.registry_type}
                            eventType={registry.event_type}
                            linkedRegistries={linkedRegistries}
                            storesWithRegistryLinks={registryLinkStores}
                            otherLists={otherListsByItem.get(item.id)}
                            otherListIds={item.otherListIds}
                            ownerLists={data.ownerLists}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {fundsAt === "bottom" && fundsSection}
                </div>
              </div>
            )}
          </>
        }
        purchasesContent={
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Gift Activity</h2>
            </div>

            {/* With reservations hidden, only revealed gifts are listed. */}
            {hideReservations && (
              <ReservationsHiddenNotice
                className={allPurchases.length > 0 ? "mb-4" : undefined}
                settingsHref={settingsHref}
                turnedOnByExchange={turnedOnByExchange}
                reveal={revealInfo}
              />
            )}
            {allPurchases.length === 0 ? (
              hideReservations ? null : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-tertiary">
                    No gifts yet.
                  </p>
                </CardContent>
              </Card>
              )
            ) : (
              <div className="space-y-3">
                {allPurchases.map((purchase: any) => {
                  const isCancelled = purchase.status === "cancelled";
                  const isParentPurchased = purchase.registry_items?.is_parent_purchased ?? false;
                  // The app's Gifts tab words them the same way (src/lib/gifts.ts).
                  const tag = giftActivityTag(purchase, isParentPurchased);
                  const tagType = tag.kind;
                  const displayAmount = purchase.cash_fund_id
                    ? purchase.amount
                    : purchase.registry_items?.price;
                  return (
                    <Card
                      key={purchase.id}
                      className={`py-0 ${isCancelled ? "opacity-50" : ""}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:flex-nowrap">
                            <span className="min-w-0 sm:flex-1 text-sm font-medium text-secondary">
                              {purchase.buyer_name}
                            </span>
                            <div className="min-w-0 sm:flex-1">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                                  tagType === "cancelled"
                                    ? "bg-error-primary/10 border-error-primary/20 text-error-primary"
                                    : tagType === "contribution"
                                      ? "bg-mint-500 border-mint-500 text-gray-900"
                                      : tagType === "covered"
                                        ? "bg-mint-200 dark:bg-mint-500/20 border-mint-200 dark:border-mint-800 text-primary"
                                        : tagType === "reserved"
                                          ? "bg-sunshine-50 dark:bg-sunshine-400/10 border-sunshine-200 dark:border-sunshine-900 text-primary"
                                          : "bg-sunshine-100 dark:bg-sunshine-400/15 border-sunshine-100 dark:border-sunshine-900 text-primary"
                                }`}
                              >
                                {tag.label}
                              </span>
                            </div>
                            <div className="min-w-0 sm:flex-1">
                              <span className="text-xs text-secondary">
                                {giftActivityFor(purchase, purchase.item_title)}
                              </span>
                            </div>
                            <div className="min-w-0 sm:flex-1">
                              <span className="text-sm font-semibold text-secondary">
                                {displayAmount != null
                                  ? formatPrice(Number(displayAmount))
                                  : ""}
                              </span>
                            </div>
                            <div className="min-w-0 sm:flex-1">
                              <span className="text-xs break-all text-secondary">
                                {purchase.buyer_email}
                              </span>
                            </div>
                            <div className="min-w-0 sm:flex-1 sm:text-right">
                              <span className="text-xs text-secondary">
                                {formatGiftDate(purchase.created_at)}
                              </span>
                            </div>
                          </div>
                          {purchase.message && (
                            <p className="text-sm text-secondary whitespace-pre-line">
                              {purchase.message}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        }
        suggestionsContent={
          <SuggestionInbox suggestions={allSuggestions} registryId={registryId} />
        }
        perksContent={
          perkRows.length > 0 ? (
            <StorePerksCard
              registryId={registryId}
              rows={perkRows}
              emails={data.perkEmails}
              hasDueDate={!!registry.event_date}
            />
          ) : undefined
        }
        perksCount={data.readyPerkCount}
        defaultTab={tab}
      />

      <ScrollToTop />
      <ArriveAtTop />
    </div>
    </>
  );
}
