// The invitation's sections below the RSVP: everyone's wishlists, the
// sign-up sheet, the gift exchange, who the guest drew, and group gifts. Each
// is the website's section of the same name: GuestWishLists,
// SignupSheetSection, SecretSantaCard and EventGroupGifts in src/components,
// and the Gift exchange part of EventInvitation. The lists the host linked
// are a row of the event's details (details.tsx).

import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { formatEventDate, storeName, type GuestWishList } from "@shared/events";
import { groupGiftPath, groupGiftProgress, type EventGroupGift } from "@shared/group-gifts";
import { initialsFor } from "@shared/initials";
import { invitationGiftPath, type InvitationPageData, type InvitationRegistry } from "@shared/invitation-page-types";
import { formatAmount } from "@shared/money";
import { formatSlotDate, spotsLabel } from "@shared/signups";

import { Icon, type IconName } from "@/components/icon";
import { ItemImage } from "@/components/item-image";
import { Button, haptic, ProgressBar, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useRunEventAction } from "@/lib/events-data";
import { radius, spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";

import { useSectionColors, type PanelColors } from "./colors";

/**
 * Opens a link from the invitation: the account's own list on its own
 * screen, any other page of the website inside the app, and any other site
 * (a list on a store's site) in the browser.
 */
export function openInvitationLink(href: string) {
  const own = href.match(/^\/dashboard\/registry\/([^/?#]+)/);
  if (own) router.push({ pathname: "/registry/[id]", params: { id: own[1] } });
  else if (href.startsWith("/")) openSite(href);
  else WebBrowser.openBrowserAsync(href);
}

/** A section's heading: an icon in a circle, a title and what comes under it. */
function SectionHeading({
  icon,
  title,
  ink,
  circle,
  children,
}: {
  icon: IconName;
  title: string;
  ink: string;
  circle: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
      <View style={[styles.circle, { backgroundColor: circle }]}>
        <Icon name={icon} size={17} color={ink} />
      </View>
      <View style={{ flex: 1, gap: 4, paddingTop: 6 }}>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}

// ── Everyone's wishlists ─────────────────────────────────────

/** "See Maya's list", by first name. A couple's names stay whole. */
function seeListLabel(name: string): string {
  const who = /\s(&|and)\s/i.test(name) ? name : name.split(/\s+/)[0];
  return `See ${who}'s list`;
}

/** Someone's initials in a circle, in the brand color when it's you. */
function Initials({ name, isYou }: { name: string; isYou: boolean }) {
  const theme = useTheme();
  const mint = useSectionColors("mint");
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { backgroundColor: isYou ? theme.tint : mint.fill }]}
    >
      <Text variant="footnote" style={{ fontWeight: "700", color: isYou ? theme.onTint : mint.ink }}>
        {initialsFor(name)}
      </Text>
    </View>
  );
}

/** One list in everyone's wishlists, a guest's or one the host linked. */
function WishListRow({
  leading,
  name,
  isYou = false,
  detail,
  giftIdeas,
  href,
  button,
  follow,
}: {
  leading: React.ReactNode;
  name: string;
  isYou?: boolean;
  detail: string | null;
  giftIdeas?: string | null;
  /** Where the list opens. Null when there's nothing to open. */
  href: string | null;
  button: string;
  follow?: React.ReactNode;
}) {
  const theme = useTheme();
  const body = (
    <>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
        {leading}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="callout" style={{ fontWeight: "600" }}>
            {name}
            {isYou ? <Text variant="footnote" tone="tertiary" style={{ fontWeight: "400" }}>{"  "}(you)</Text> : null}
          </Text>
          {detail ? (
            <Text variant="footnote" tone="tertiary">
              {detail}
            </Text>
          ) : null}
          {giftIdeas ? (
            <Text variant="footnote" tone="secondary" style={{ marginTop: 2 }}>
              {giftIdeas}
            </Text>
          ) : null}
        </View>
        {href ? <Icon name={href.startsWith("/") ? "chevronRight" : "external"} size={16} color={theme.textTertiary} /> : null}
      </View>
      {follow}
    </>
  );
  const box = [styles.wishRow, { backgroundColor: theme.surface, borderColor: theme.border }];
  if (!href) return <View style={box}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint={button}
      onPress={() => {
        haptic();
        openInvitationLink(href);
      }}
      style={({ pressed }) => [box, { opacity: pressed ? 0.85 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

/**
 * Everyone's wishlists, on an everyone-gives-everyone invitation. Anyone
 * with the link sees the lists the host linked; only the event's guests and
 * hosts see the guests' lists. Nobody shops their own list, so your own row
 * opens your own screen for it. A Regibee list your account doesn't own has
 * nothing to open, since its pages would show you what's been reserved.
 */
export function WishListsSection({ page, colors }: { page: InvitationPageData; colors: PanelColors & { hostColor: string | null } }) {
  const theme = useTheme();
  const lists = page.wishLists?.lists ?? null;
  const waitingCount = page.wishLists?.waitingCount ?? 0;
  const hrefFor = (slug: string) => invitationGiftPath(page.slug, page.guestToken, slug);
  const ownHref = (id: string) => `/dashboard/registry/${id}`;
  // A list the host linked that's also a guest's wishlist shows once, on the guest's row.
  const guestSlugs = new Set(
    (lists ?? []).flatMap((entry) => [...(entry.registry ? [entry.registry.slug] : []), ...(entry.more ?? []).map((list) => list.slug)]),
  );
  const linked = page.registries.filter((registry) => !guestSlugs.has(registry.slug));
  const withList = lists?.filter((l) => l.url).length ?? 0;
  const ink = colors.hostColor ? colors.ink : theme.tint;

  return (
    <View style={[{ gap: spacing.md }, colors.hostColor ? [styles.panel, { backgroundColor: colors.fill }] : null]}>
      <SectionHeading icon="people" title="Everyone's wishlists" ink={ink} circle={colors.hostColor ? theme.surface : theme.surfaceAlt}>
        {page.event.gift_note ? (
          <Text variant="callout" tone="secondary">
            {page.event.gift_note}
          </Text>
        ) : null}
        {page.exchange?.budget ? (
          <Text variant="callout" tone="secondary">
            About {page.exchange.budget} a gift.
          </Text>
        ) : null}
        {lists === null ? (
          <Text variant="callout" tone="secondary">
            Guests see each other&apos;s lists here.
          </Text>
        ) : null}
        <Text variant="footnote" tone="tertiary">
          Nobody sees what&apos;s been reserved from their own list until the day after.
        </Text>
      </SectionHeading>

      {linked.map((registry) => (
        <LinkedListRow key={`linked:${registry.slug}`} registry={registry} href={registry.isYours ? (registry.id ? ownHref(registry.id) : null) : hrefFor(registry.slug)} />
      ))}
      {(lists ?? []).map((entry) => (
        <GuestListRows key={entry.guestId} entry={entry} hrefFor={hrefFor} ownHref={ownHref} />
      ))}

      {lists && lists.length === 0 ? (
        <View style={[styles.wishRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text variant="footnote" tone="tertiary">
            Nobody has RSVPed yet.
          </Text>
        </View>
      ) : null}

      {lists && (waitingCount > 0 || (lists.length > 0 && withList < lists.length)) ? (
        <Text variant="caption" tone="tertiary" style={{ fontWeight: "400" }}>
          {[
            lists.length > 0 && withList < lists.length
              ? `${lists.length - withList} of ${lists.length} ${lists.length - withList === 1 ? "hasn't" : "haven't"} added a list yet.`
              : null,
            waitingCount > 0 ? `${waitingCount === 1 ? "1 guest hasn't" : `${waitingCount} guests haven't`} answered yet.` : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </Text>
      ) : null}
    </View>
  );
}

/** A list the host linked, shown like a guest's: whose it is, then its name. */
function LinkedListRow({ registry, href }: { registry: InvitationRegistry; href: string | null }) {
  const mint = useSectionColors("mint");
  const owner = registry.ownerName?.trim() || null;
  return (
    <WishListRow
      leading={
        owner ? (
          <Initials name={owner} isYou={Boolean(registry.isYours)} />
        ) : (
          <View style={[styles.circle, { backgroundColor: mint.fill }]}>
            <Icon name="gift" size={17} color={mint.ink} />
          </View>
        )
      }
      name={owner ?? registry.title}
      isYou={Boolean(registry.isYours)}
      detail={owner ? registry.title : null}
      href={href}
      button={registry.isYours ? "See your list" : owner ? seeListLabel(owner) : "See list"}
    />
  );
}

/** A guest's row, then a row for each other list they added, like one for their child. */
function GuestListRows({
  entry,
  hrefFor,
  ownHref,
}: {
  entry: GuestWishList;
  hrefFor: (slug: string) => string;
  ownHref: (id: string) => string;
}) {
  // Your own row opens your own screen for your Regibee list, or a list you
  // keep on another store's site. A Regibee list your account doesn't own
  // stays without a link.
  const href = entry.isYou
    ? entry.ownListId
      ? ownHref(entry.ownListId)
      : entry.registry
        ? null
        : entry.url
    : entry.registry
      ? hrefFor(entry.registry.slug)
      : entry.url;
  const firstName = entry.name.split(/\s+/)[0];
  return (
    <>
      <WishListRow
        leading={<Initials name={entry.name} isYou={entry.isYou} />}
        name={entry.name}
        isYou={entry.isYou}
        detail={
          entry.registry
            ? entry.registry.title
            : entry.url
              ? `A list on ${storeName(entry.url)}`
              : entry.isYou
                ? "Add your wishlist above"
                : "No wishlist yet"
        }
        giftIdeas={entry.giftIdeas}
        href={href}
        button={entry.isYou ? "See your list" : seeListLabel(entry.name)}
        follow={entry.follow && !entry.isYou ? <GuestFollowButton name={entry.name} follow={entry.follow} /> : null}
      />
      {(entry.more ?? []).map((list) => {
        const from = entry.isYou ? "Added by you" : `Added by ${firstName}`;
        return (
          <WishListRow
            key={`${entry.guestId}:${list.slug}`}
            leading={<Initials name={list.honoree ?? entry.name} isYou={entry.isYou} />}
            name={list.honoree ?? entry.name}
            isYou={entry.isYou && !list.honoree}
            detail={list.honoree ? `${list.title} · ${from}` : list.title}
            href={entry.isYou ? (list.ownListId ? ownHref(list.ownListId) : null) : hrefFor(list.slug)}
            button={list.honoree ? seeListLabel(list.honoree) : "See list"}
          />
        );
      })}
    </>
  );
}

/**
 * Follow, for another guest with an account the viewer may be shown: the
 * website's GuestFollowButton. Once approved it says so; unfollowing is rare,
 * and the guest's profile still offers it.
 */
function GuestFollowButton({ name, follow }: { name: string; follow: NonNullable<GuestWishList["follow"]> }) {
  const theme = useTheme();
  const { run } = useRunEventAction();
  const [state, setState] = useState(follow.state);
  const [busy, setBusy] = useState(false);

  async function go(action: string, next: typeof state) {
    setBusy(true);
    try {
      await run(action, follow.publicId);
      haptic("success");
      setState(next);
    } catch (e) {
      Alert.alert("That didn't work", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (state === "approved") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 48 }}>
        <Icon name="check" size={13} color={theme.textTertiary} />
        <Text variant="footnote" tone="tertiary">
          {follow.followsYou ? "Friends" : "Following"}
        </Text>
      </View>
    );
  }
  const label = state === "pending" ? "Requested" : follow.followsYou ? "Follow back" : "Follow";
  return (
    <Button
      size="small"
      variant="secondary"
      icon={state === "pending" ? undefined : "add"}
      loading={busy}
      title={label}
      accessibilityLabel={`${label} ${name}`}
      style={{ alignSelf: "flex-start", marginLeft: 48 }}
      onPress={() => {
        if (state === "none") go("follows.requestFollow", "pending");
        else
          Alert.alert(`Withdraw your request to follow ${name}?`, undefined, [
            { text: "Keep it", style: "cancel" },
            { text: "Withdraw", style: "destructive", onPress: () => go("follows.cancelFollow", "none") },
          ]);
      }}
    />
  );
}

// ── Sign-up sheet ────────────────────────────────────────────

/**
 * The sign-up sheet: each row, how many spots are left, and what people are
 * bringing. Guests sign up in the RSVP form. Nobody sees who took which spot
 * except the hosts.
 */
export function SignupSection({ page }: { page: InvitationPageData }) {
  const theme = useTheme();
  const colors = useSectionColors("sunshineSoft");
  const signup = page.signup;
  if (!signup) return null;
  return (
    <View style={[styles.panel, { backgroundColor: colors.fill }]}>
      <SectionHeading icon="checklist" title={signup.title} ink={colors.ink} circle={theme.surface}>
        {signup.note ? (
          <Text variant="callout" tone="secondary">
            {signup.note}
          </Text>
        ) : null}
      </SectionHeading>
      {signup.rows.length === 0 ? (
        <View style={[styles.inner, { backgroundColor: theme.surface }]}>
          <Text variant="footnote" tone="tertiary">
            {signup.mealTrain ? "The host hasn't added days yet." : "The host hasn't added anything yet."}
          </Text>
        </View>
      ) : (
        <View style={[styles.inner, { backgroundColor: theme.surface, paddingVertical: 0 }]}>
          {signup.rows.map((row, index) => {
            const full = row.taken >= row.needed;
            const extra = [row.mine?.note ? `You: ${row.mine.note}` : null, ...row.bringing].filter(Boolean).join(" · ");
            return (
              <View
                key={row.id}
                style={{
                  gap: 2,
                  paddingVertical: spacing.md,
                  opacity: row.passed ? 0.6 : 1,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: theme.border,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.md }}>
                  <Text variant="callout" style={{ flex: 1, fontWeight: "600" }}>
                    {row.slotDate ? `${formatSlotDate(row.slotDate)} · ` : ""}
                    {row.label}
                    {row.mine ? <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }}>{"  "}You</Text> : null}
                  </Text>
                  <Text variant="footnote" tone={full || row.passed ? "tertiary" : "success"} style={{ fontWeight: full ? "400" : "600" }}>
                    {row.passed ? "Over" : spotsLabel(row)}
                  </Text>
                </View>
                {extra ? (
                  <Text variant="footnote" tone="tertiary">
                    {extra}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Gift exchange ────────────────────────────────────────────

/** How a draw works, when names are drawn, and whether gifts are mailed. */
export function ExchangeSection({ page }: { page: InvitationPageData }) {
  const theme = useTheme();
  const colors = useSectionColors("mintSoft");
  const exchange = page.exchange;
  if (!exchange || exchange.kind === "everyone") return null;
  return (
    <View style={[styles.panel, { backgroundColor: colors.fill }]}>
      <SectionHeading icon="shuffle" title="Gift exchange" ink={colors.ink} circle={theme.surface}>
        <Text variant="callout" tone="secondary">
          Everyone who joins draws one name and gives that person a gift
          {exchange.budget ? `, about ${exchange.budget}` : ""}. Nobody knows who drew them.
        </Text>
        <Text variant="footnote" tone="tertiary">
          {exchange.drawn_at
            ? "Names have been drawn."
            : exchange.draw_by
              ? `Names are drawn by ${formatEventDate(exchange.draw_by)}.`
              : "Names are drawn once everyone's in."}{" "}
          {exchange.mailed ? "Gifts are mailed." : "Bring your gift to the party."}
        </Text>
      </SectionHeading>
    </View>
  );
}

/** Who the guest drew, on their own link. Nobody else sees it, the host included. */
export function SecretSantaCard({ santa }: { santa: NonNullable<InvitationPageData["santa"]> }) {
  const theme = useTheme();
  const colors = useSectionColors("mintSoft");
  const { giftee, budget, mailed, wishlistHref } = santa;
  return (
    <View style={[styles.panel, { backgroundColor: colors.fill, borderWidth: 2, borderColor: theme.dark ? colors.ink : "#09C69A" }]}>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
        <View style={[styles.circle, { backgroundColor: theme.surface, width: 40, height: 40, borderRadius: 20 }]}>
          <Icon name="gift" size={20} color={colors.ink} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" style={{ color: colors.ink, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Your Secret Santa name
          </Text>
          <Text variant="title" accessibilityRole="header">
            You&apos;re getting a gift for {giftee.name}
          </Text>
          <Text variant="footnote" tone="secondary">
            {budget ? `Budget: ${budget}. ` : ""}Only you know who you drew.
          </Text>
        </View>
      </View>

      {wishlistHref ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            haptic();
            openInvitationLink(wishlistHref);
          }}
          style={({ pressed }) => [styles.row, { backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="callout" style={{ fontWeight: "600" }}>
              {giftee.wishlistTitle ?? `${giftee.name}'s wishlist`}
            </Text>
            {giftee.wishlistTitle ? (
              <Text variant="footnote" tone="tertiary">
                If you reserve something there, {giftee.name} sees “Secret Santa”, not your name.
              </Text>
            ) : null}
          </View>
          <Icon name={giftee.wishlistTitle ? "chevronRight" : "external"} size={16} color={theme.textTertiary} />
        </Pressable>
      ) : null}

      {giftee.giftIdeas ? (
        <View style={{ gap: 2 }}>
          <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
            Their gift ideas
          </Text>
          <Text variant="callout">{giftee.giftIdeas}</Text>
        </View>
      ) : null}

      {!wishlistHref && !giftee.giftIdeas ? (
        <Text variant="footnote" tone="secondary">
          {giftee.name} hasn&apos;t added a wishlist or gift ideas yet.
        </Text>
      ) : null}

      {mailed ? (
        <View style={{ gap: 2 }}>
          <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
            Mail it to
          </Text>
          {giftee.shippingAddress ? (
            <Text variant="callout">{giftee.shippingAddress}</Text>
          ) : (
            <Text variant="footnote" tone="tertiary">
              {giftee.name} hasn&apos;t added an address yet. Ask the host.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

// ── Group gifts ──────────────────────────────────────────────

/**
 * Group gifts started from this event, on a guest's own link, so other
 * guests can chip in. Gifts for the guest's own lists are left out.
 */
export function GroupGiftsSection({ gifts }: { gifts: EventGroupGift[] }) {
  const theme = useTheme();
  if (gifts.length === 0) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Icon name="people" size={18} color={theme.text} />
          <Text variant="headline" accessibilityRole="header">
            Group gifts
          </Text>
        </View>
        <Text variant="footnote" tone="secondary">
          Guests are going in on these together.
        </Text>
      </View>
      {gifts.map((gift) => {
        const { percent, toGo } = groupGiftProgress(gift.pledged, gift.goalAmount);
        const progress = [
          formatAmount(gift.pledged),
          gift.goalAmount ? ` of ${formatAmount(gift.goalAmount)}` : " pledged",
          gift.pledgeCount > 0 ? ` from ${gift.pledgeCount} ${gift.pledgeCount === 1 ? "person" : "people"}` : "",
          gift.status === "bought" ? " · bought" : gift.goalAmount && toGo > 0 ? ` · ${formatAmount(toGo)} to go` : "",
        ].join("");
        return (
          <View key={gift.token} style={[styles.wishRow, { backgroundColor: theme.surface, borderColor: theme.border, gap: spacing.md }]}>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <ItemImage uri={gift.imageUrl} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="callout" style={{ fontWeight: "600" }}>
                  {gift.itemTitle}
                </Text>
                <Text variant="footnote" tone="tertiary">
                  For {gift.recipientName} · started by {gift.organizerName}
                </Text>
                <Text variant="footnote" tone="secondary">
                  {progress}
                </Text>
              </View>
            </View>
            {gift.goalAmount ? <ProgressBar value={percent / 100} /> : null}
            <Button
              title={gift.status === "bought" ? "See the group gift" : "Chip in"}
              size="medium"
              variant="secondary"
              onPress={() => openSite(groupGiftPath(gift.token))}
            />
          </View>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  panel: { gap: spacing.md, borderRadius: radius.lg, padding: spacing.lg },
  inner: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.md, padding: spacing.md },
  wishRow: { gap: spacing.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
});
