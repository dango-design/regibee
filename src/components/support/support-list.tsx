// One list on the support pages (/support/lists/[registryId]): what its
// owner sees on their manage page, read only, plus who manages it. See
// "Support view" in CLAUDE.md.

import Link from "next/link";
import { EyeOff } from "lucide-react";
import { eventTypeLabel } from "@/lib/events";
import { giftActivityFor, giftActivityTag, ownerItemStatus } from "@/lib/gifts";
import { LIST_ACCESS, listVisibility } from "@/lib/list-access";
import { formatPrice } from "@/lib/money";
import { occasionLabel } from "@/lib/registry-copy";
import type { ListPageData, ListPageItem, ListPagePurchase } from "@/lib/list-page-types";
import type { SupportListFacts } from "@/lib/support";
import {
  SupportFacts,
  SupportPage,
  SupportRow,
  SupportRows,
  SupportSection,
  SupportTag,
  supportDate,
} from "./support-parts";

// The words the owner's suggestion inbox uses (suggestion-inbox.tsx).
const SUGGESTION_LABELS: Record<string, string> = {
  pending: "Pending",
  offering: "Offering to gift",
  added: "Added",
  accepted: "Accepted",
  declined: "Declined",
};

function person(p: { name: string | null; email: string | null }) {
  return [p.name || "No name", p.email].filter(Boolean).join(" · ");
}

function ItemRow({ item, purchases }: { item: ListPageItem; purchases: ListPagePurchase[] }) {
  const status = ownerItemStatus(item, purchases);
  // The owner's page says "Purchased by you". Here, "you" isn't the owner.
  const tag =
    status.tag?.kind === "purchased-by-you" ? { ...status.tag, label: "Bought by the owner" } : status.tag;
  return (
    <SupportRow>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {item.external_url ? (
          <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
            {item.title}
          </a>
        ) : (
          <span className="font-medium text-primary">{item.title}</span>
        )}
        {item.is_essential && <SupportTag tone="brand">Most wanted</SupportTag>}
        {tag && <SupportTag tone={tag.kind === "reserved" ? "warning" : "success"}>{tag.label}</SupportTag>}
      </div>
      <p className="text-tertiary">
        {item.price !== null ? formatPrice(item.price) : "No price"} · {status.quantity}
        {item.otherLists.length > 0 && ` · Also on ${item.otherLists.join(", ")}`}
      </p>
      {item.notes && <p className="mt-1 text-secondary">{item.notes}</p>}
    </SupportRow>
  );
}

export function SupportListView({
  page,
  facts,
  showHiddenGifts,
  ownerHidesGifts,
}: {
  page: ListPageData;
  facts: SupportListFacts;
  /** The page shows the gifts the owner hid from themselves. */
  showHiddenGifts: boolean;
  /** Some gifts on this list are hidden from the owner. */
  ownerHidesGifts: boolean;
}) {
  const { registry } = page;
  const visibility = listVisibility({ is_public: Boolean(registry.is_public), is_private: Boolean(registry.is_private) });
  const purchasesFor = (itemId: string) => page.purchases.filter((p) => p.registry_item_id === itemId);

  const categoryIds = new Set(page.categories.map((c) => c.id));
  const groups = [
    ...page.categories.map((c) => ({ id: c.id, name: c.name, items: page.items.filter((i) => i.category_id === c.id) })),
    { id: "none", name: "No category", items: page.items.filter((i) => !i.category_id || !categoryIds.has(i.category_id)) },
  ].filter((g) => g.items.length > 0);

  const listHref = `/support/lists/${registry.id}`;

  return (
    <SupportPage back={{ href: `/support/users/${facts.owner.id}`, label: facts.owner.name || "The owner's account" }}>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-display-xs font-semibold text-primary">{registry.title}</h1>
        <SupportTag>{LIST_ACCESS[visibility].short}</SupportTag>
      </div>
      <p className="mt-1 text-sm text-tertiary">
        {occasionLabel(registry.registry_type, registry.event_type)} ·{" "}
        <Link href={`/support/users/${facts.owner.id}`} className="underline underline-offset-2">
          {person(facts.owner)}
        </Link>
      </p>

      {(ownerHidesGifts || showHiddenGifts) && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-secondary p-4 text-sm">
          <EyeOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" />
          {showHiddenGifts ? (
            <p className="text-secondary">
              Showing the gifts the owner hid from themselves. They don&apos;t see these.{" "}
              <Link href={listHref} className="font-medium text-primary underline underline-offset-2">
                Show what the owner sees
              </Link>
            </p>
          ) : (
            <p className="text-secondary">
              The owner hides what&apos;s been reserved from themselves, so this page shows what they see.{" "}
              <Link href={`${listHref}?gifts=shown`} className="font-medium text-primary underline underline-offset-2">
                Show hidden gifts
              </Link>{" "}
              (this is recorded too)
            </p>
          )}
        </div>
      )}

      <SupportSection title="List">
        <SupportFacts
          facts={[
            { label: "Who can open it", value: LIST_ACCESS[visibility].label },
            {
              label: "Link",
              value:
                visibility === "private" ? (
                  `/r/${registry.slug} (guests get the not-found page)`
                ) : (
                  <a href={`/r/${registry.slug}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    /r/{registry.slug}
                  </a>
                ),
            },
            { label: "Made", value: supportDate(registry.created_at as string | undefined) },
            { label: "Date", value: supportDate(registry.event_date) },
            { label: "Old links", value: facts.oldLinkCount === 0 ? "None" : String(facts.oldLinkCount) },
            {
              label: "Co-managers",
              value: facts.managers.length === 0 ? "None" : facts.managers.map(person).join("; "),
            },
            {
              label: "Pending co-manager invites",
              value:
                facts.pendingInvites.length === 0
                  ? "None"
                  : facts.pendingInvites
                      .map((i) => `${i.email ?? "Anyone with the link"} (until ${supportDate(i.expiresAt)})`)
                      .join("; "),
            },
            {
              label: "Events",
              value:
                page.linkedEvents.length === 0
                  ? "None"
                  : page.linkedEvents
                      .map((e) => `${e.title} (${eventTypeLabel(e.event_type)}, ${supportDate(e.event_date)})`)
                      .join("; "),
            },
          ]}
        />
      </SupportSection>

      <SupportSection title="Items" count={page.items.length}>
        {groups.length === 0 ? (
          <p className="text-sm text-tertiary">No items yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.id}>
                <h3 className="mb-2 text-sm font-semibold text-secondary">{group.name}</h3>
                <SupportRows empty="">
                  {group.items.map((item) => (
                    <ItemRow key={item.id} item={item} purchases={purchasesFor(item.id)} />
                  ))}
                </SupportRows>
              </div>
            ))}
          </div>
        )}
      </SupportSection>

      {page.funds.length > 0 && (
        <SupportSection title="Gift funds" count={page.funds.length}>
          <SupportRows empty="">
            {page.funds.map((fund) => (
              <SupportRow key={fund.id}>
                <p className="font-medium text-primary">{fund.title}</p>
                <p className="text-tertiary">
                  {formatPrice(fund.current_amount)} given
                  {fund.goal_amount !== null && ` of ${formatPrice(fund.goal_amount)}`}
                </p>
              </SupportRow>
            ))}
          </SupportRows>
        </SupportSection>
      )}

      <SupportSection title="Gifts" count={page.purchases.length}>
        <SupportRows empty={page.hideReservations ? "None the owner can see yet." : "No gifts yet."}>
          {page.purchases.map((gift) => {
            const item = gift.registry_item_id ? page.items.find((i) => i.id === gift.registry_item_id) : undefined;
            const tag = giftActivityTag(gift, Boolean(item?.is_parent_purchased));
            return (
              <SupportRow key={gift.id}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-primary">{giftActivityFor(gift, gift.item_title)}</span>
                  <SupportTag tone={tag.kind === "cancelled" ? "gray" : tag.kind === "reserved" ? "warning" : "success"}>
                    {tag.label}
                  </SupportTag>
                </div>
                <p className="text-tertiary">
                  {[gift.buyer_name, gift.buyer_email].filter(Boolean).join(" · ")}
                  {gift.amount !== null && ` · ${formatPrice(gift.amount)}`} · {supportDate(gift.created_at)}
                </p>
                {gift.message && <p className="mt-1 text-secondary">&ldquo;{gift.message}&rdquo;</p>}
              </SupportRow>
            );
          })}
        </SupportRows>
      </SupportSection>

      {page.suggestions.length > 0 && (
        <SupportSection title="Suggestions from guests" count={page.suggestions.length}>
          <SupportRows empty="">
            {page.suggestions.map((s) => (
              <SupportRow key={s.id}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-primary">{s.title}</span>
                  <SupportTag>{SUGGESTION_LABELS[s.status] ?? s.status}</SupportTag>
                </div>
                <p className="text-tertiary">
                  {[s.suggested_by_name, s.suggested_by_email].filter(Boolean).join(" · ")} · {supportDate(s.created_at)}
                </p>
              </SupportRow>
            ))}
          </SupportRows>
        </SupportSection>
      )}
    </SupportPage>
  );
}
