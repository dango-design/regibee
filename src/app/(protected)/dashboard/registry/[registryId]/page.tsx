import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink,
  Settings,
  ClipboardList,
  Mail,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddItemDialog } from "@/components/add-item-dialog";
import { ItemCard } from "@/components/item-card";
import { PlainLinksNotice } from "@/components/plain-links-notice";
import { MissingDetailsNotice } from "@/components/missing-details-notice";
import { DetailReview } from "@/components/detail-review";
import { CopyLinkButton } from "@/components/copy-link-button";
import { RegistryTabs } from "@/components/registry-tabs";
import { StorePerksCard } from "@/components/store-perks-card";
import { SuggestionInbox } from "./suggestion-inbox";
import { CategoryNav, type CategoryNavItem } from "@/components/category-nav";
import { getCategorySectionId } from "@/lib/category-section-id";
import { ScrollToTop } from "@/components/scroll-to-top";
import { ProgressCircle } from "@/components/ui/progress-circle";
import { AddCashFundDialog } from "@/components/add-cash-fund-dialog";
import { CashFundCard } from "@/components/cash-fund-card";
import { PandaMark } from "@/components/panda-mark";
import { copyForRegistry } from "@/lib/registry-copy";
import { formatDollars, formatPrice } from "@/lib/money";
import { formatGiftDate, giftActivityFor, giftActivityTag } from "@/lib/gifts";
import { ReservationsHiddenNotice } from "@/components/reservations-hidden-notice";
import { PlanEventButton, RegistryEventsBanner } from "@/components/registry-events-banner";
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
    showPlanEventButton,
    pendingSuggestionCount,
    missingDetails = [],
    detailReview = [],
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
  const fulfilledItems = allItems.filter(
    (i) => i.quantity_fulfilled >= i.quantity_needed
  ).length;
  const progress = totalItems > 0 ? (fulfilledItems / totalItems) * 100 : 0;
  const totalValue = allItems.reduce((sum, i) => sum + (i.price || 0), 0);

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
  if (allFunds.length > 0) {
    navItems.unshift({
      id: "gift-funds",
      name: "Gift Funds",
      count: allFunds.length,
    });
  }

  const registryUrl = `/r/${registry.slug}`;
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{registry.title}</h1>
          {registry.event_date && (
            <p className="text-tertiary">
              {copy.eventDateLabel}:{" "}
              {new Date(registry.event_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <CopyLinkButton path={`/r/${registry.slug}`} />
          <Button variant="outline" asChild>
            <a href={registryUrl} target="_blank" rel="noopener noreferrer">
              <span className="inline-flex items-center gap-1.5">
                <ExternalLink className="h-4 w-4 shrink-0" />
                Preview
              </span>
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/dashboard/registry/${registryId}/settings`}>
              <span className="inline-flex items-center gap-1.5">
                <Settings className="h-4 w-4 shrink-0" />
                Settings
              </span>
            </Link>
          </Button>
          {showPlanEventButton && <PlanEventButton registryId={registryId} />}
        </div>
      </div>

      {hideReservations && (
        <ReservationsHiddenNotice
          className="mt-6"
          settingsHref={settingsHref}
          turnedOnByExchange={turnedOnByExchange}
          reveal={revealInfo}
        />
      )}

      {/* Events that link to this registry, or a small prompt to plan one. */}
      {(canPlanEvents || linkedEvents.length > 0) && (
        <RegistryEventsBanner
          className="mt-6"
          registryId={registryId}
          events={linkedEvents}
          promptDismissed={eventPromptDismissed}
        />
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-tertiary">Total items</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-tertiary">Gifted</p>
            <p className="text-2xl font-bold">{fulfilledItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-tertiary">Completion</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{Math.round(progress)}%</p>
              <Progress value={progress} aria-label="Registry completion" className="flex-1" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-tertiary">Total value</p>
            <p className="text-2xl font-bold">{formatDollars(totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <RegistryTabs
        totalItems={totalItems + allFunds.length}
        purchaseCount={allPurchases.length}
        suggestionCount={pendingSuggestionCount}
        itemsContent={
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h2 className="text-xl font-semibold">Registry Items</h2>
              <div className="flex flex-wrap items-center gap-2">
                {showChecklist && (
                  <Button variant="outline" asChild>
                    <Link href={`/dashboard/registry/${registryId}/checklist`}>
                      <span className="inline-flex items-center gap-1.5">
                        <ProgressCircle
                          value={checklistProgress.total > 0 ? (checklistProgress.matched / checklistProgress.total) * 100 : 0}
                          size={20}
                          strokeWidth={2}
                        />
                        Checklist
                      </span>
                    </Link>
                  </Button>
                )}
                <AddCashFundDialog registryId={registryId} />
                <AddItemDialog registryId={registryId} categories={allCategories} zipCode={zipCode} registryType={registry.registry_type} eventType={registry.event_type} linkedRegistries={linkedRegistries} storesWithRegistryLinks={registryLinkStores} openWithLink={sharedLink ?? undefined} />
              </div>
            </div>

            <DetailReview registryId={registryId} reviews={detailReview} className="mb-6" />

            {/* Always there, so it keeps reading while the page refreshes after each item. */}
            <MissingDetailsNotice registryId={registryId} items={missingDetails} className="mb-6" />

            {plainLinkGroups.length > 0 && (
              <div className="mb-6">
                <PlainLinksNotice registryId={registryId} groups={plainLinkGroups} />
              </div>
            )}

            {totalItems === 0 && allFunds.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <PandaMark className="mb-4 h-20 w-auto" />
                  <p className="text-tertiary">
                    {showChecklist
                      ? "No items yet. Add items manually or browse the checklist."
                      : "No items yet. Add items from any store to get started."}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <AddItemDialog registryId={registryId} categories={allCategories} zipCode={zipCode} registryType={registry.registry_type} eventType={registry.event_type} linkedRegistries={linkedRegistries} storesWithRegistryLinks={registryLinkStores} />
                    {showChecklist && (
                      <Button variant="outline" asChild>
                        <Link href={`/dashboard/registry/${registryId}/checklist`}>
                          Browse Checklist
                        </Link>
                      </Button>
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
                  {/* Gift Funds */}
                  {allFunds.length > 0 && (
                    <div id="gift-funds" className="scroll-mt-20">
                      <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
                        Gift Funds
                        <Badge variant="secondary">{allFunds.length}</Badge>
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {allFunds.map((fund) => (
                          <CashFundCard key={fund.id} fund={fund} registryId={registryId} highlightId={highlight} purchases={purchasesByFundId.get(fund.id)} />
                        ))}
                      </div>
                    </div>
                  )}

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
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Uncategorized items */}
                  {(itemsByCategory.get(null) || []).length > 0 && (
                    <div id={getCategorySectionId(null)} className="scroll-mt-20">
                      <h3 className="font-display text-lg font-semibold mb-3">Other</h3>
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
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        }
        purchasesContent={
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Gift Activity</h2>
              <p className="text-sm text-tertiary">
                See who has reserved or bought items and contributed to funds
              </p>
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
                    No gifts reserved yet. Share your registry link to get started!
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
                                      ? "bg-mint-500 border-mint-500 text-primary"
                                      : tagType === "covered"
                                        ? "bg-mint-200 border-mint-200 text-primary"
                                        : tagType === "reserved"
                                          ? "bg-sunshine-50 border-sunshine-200 text-primary"
                                          : "bg-sunshine-100 border-sunshine-100 text-primary"
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
    </div>
  );
}
