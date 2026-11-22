import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { EventInvitation, type InvitationRegistry } from "@/components/event-invitation";
import { RsvpForm } from "@/components/rsvp-form";
import type { RsvpWishlist } from "@/components/rsvp-wishlist-step";
import { PoweredByFooter } from "@/components/site-footer";
import { SecretSantaCard } from "@/components/secret-santa-card";
import { EventGroupGifts } from "@/components/event-group-gifts";
import { groupGiftsForEvent, listsOfViewer } from "@/lib/group-gifts-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getEventForManager,
  getEventRegistries,
  getGifteeFor,
  getGiftExchange,
  getGuestWishLists,
  getInvitationUpdates,
  getSignupSheet,
  registrySlugFromLink,
  withGuestsLinkedLists,
} from "@/lib/events-server";
import { hidesAddressUntilSignup, signupRowsForGuest, withAddressFor } from "@/lib/signups";
import { storedAnswers, storedQuestions } from "@/lib/rsvp-questions";
import {
  eventHasPassed,
  exchangeKind,
  formatEventDate,
  googleCalendarUrl,
  type EventDetails,
  type EventGuest,
} from "@/lib/events";
import { getViewer, getViewerRelation } from "@/lib/viewer";

// Event pages are read with the service-role client, always filtered by the
// slug in the URL (and a guest's token). The event tables have no access rules
// for the API roles, so the anon key can't list events or guests.

// Cached, so the metadata and the page share one read.
const getEvent = cache(async (slug: string): Promise<EventDetails | null> => {
  const { data } = await supabaseAdmin.from("events").select("*").eq("slug", slug).maybeSingle();
  return (data as EventDetails | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Event Not Found" };

  const description = [
    event.event_date ? formatEventDate(event.event_date) : null,
    event.hosted_by ? `Hosted by ${event.hosted_by}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: `${event.title} | Regibee`,
    description: description || `You're invited to ${event.title}`,
    // Event pages can show a home address, so they're never in search results.
    robots: { index: false, follow: false },
    // Links texted or posted to friends show the invitation picture, or
    // Regibee's share image (src/app/opengraph-image.tsx) for an event without
    // one. This openGraph replaces the site-wide one, so without that second
    // choice the link would have no picture and Messenger would pick one off
    // the page.
    openGraph: {
      title: event.title,
      description: description || undefined,
      images: [{ url: event.image_url || "/opengraph-image" }],
    },
  };
}

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ g?: string }>;
}) {
  const [{ slug }, { g: token }] = await Promise.all([params, searchParams]);
  const [event, viewer] = await Promise.all([getEvent(slug), getViewer()]);
  if (!event) notFound();

  const [registries, exchange, signupSheet, updates, guestResult] = await Promise.all([
    getEventRegistries(event.id, { withItems: true }),
    getGiftExchange(event.id),
    getSignupSheet(event.id),
    // The host's messages and changes, for anyone with the link (#129).
    getInvitationUpdates(event.id),
    token
      ? supabaseAdmin
          .from("event_guests")
          .select(
            "id, name, email, rsvp_status, party_size, kids_count, rsvp_note, token, in_exchange, wishlist_url, gift_ideas, shipping_address, giftee_id, answers",
          )
          .eq("event_id", event.id)
          .eq("token", token)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const guest = guestResult.data as Pick<
    EventGuest,
    | "id"
    | "name"
    | "email"
    | "rsvp_status"
    | "party_size"
    | "kids_count"
    | "rsvp_note"
    | "token"
    | "in_exchange"
    | "wishlist_url"
    | "gift_ideas"
    | "shipping_address"
    | "giftee_id"
    | "answers"
  > | null;

  // Group gifts started from this event, on a guest's own link only. Gifts
  // for lists the guest manages stay hidden, so their surprise holds.
  const groupGifts = guest
    ? await listsOfViewer(
        registries.map((r) => r.id),
        { viewerId: viewer?.id ?? null, guestEmail: guest.email },
      )
        .then((own) => groupGiftsForEvent(event.id, { hideRegistryIds: own }))
        .catch((err) => {
          console.error("[event] Failed to load group gifts:", err);
          return [];
        })
    : [];

  // Who this guest drew, once names are drawn. Only their own link shows it.
  const giftee = exchange?.drawn_at && guest ? await getGifteeFor(event.id, guest.giftee_id) : null;
  const gifteeWishlistSlug = giftee?.wishlistUrl ? registrySlugFromLink(giftee.wishlistUrl) : null;
  const gifteeWishlistHref = giftee?.wishlistUrl
    ? giftee.wishlistTitle && gifteeWishlistSlug && guest
      ? `/e/${event.slug}/gifts?g=${encodeURIComponent(guest.token)}&to=${encodeURIComponent(gifteeWishlistSlug)}`
      : giftee.wishlistUrl
    : null;

  // Everyone gives everyone: the event's guests and hosts see everyone's
  // wish lists. A signed-in guest can pick one of their own lists after they
  // RSVP. Private lists are left out, since nobody else can open them.
  const everyone = exchangeKind(exchange) === "everyone";
  const [isHost, guestLists, waiting, myLists] = everyone
    ? await Promise.all([
        viewer ? getEventForManager(event.id, viewer.id).then(Boolean) : false,
        // A list the host linked that belongs to a guest without a wish list
        // is theirs, on their row and in their wish list step.
        getGuestWishLists(event.id, guest?.id ?? null).then((lists) => withGuestsLinkedLists(lists, registries)),
        supabaseAdmin
          .from("event_guests")
          .select("id", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("rsvp_status", "pending")
          .then(({ count }) => count ?? 0),
        viewer
          ? supabaseAdmin
              .from("registries")
              .select("id, title, slug")
              .eq("owner_id", viewer.id)
              .eq("is_private", false)
              .order("created_at", { ascending: false })
              .then(({ data }) => (data || []) as { id: string; title: string; slug: string }[])
          : [],
      ])
    : [false, [], 0, []];
  const showGuestLists = everyone && (Boolean(guest) || isHost);
  // Everyone gives everyone: each list the host linked shows whose it is,
  // like a guest's. Its owner sees their own name. Anyone else sees the
  // owner's name only when the list's own page shows it (on their profile,
  // and they haven't blocked the viewer), or else the names written on the
  // list. The owner's id and account name stay on the server.
  const invitationRegistries: InvitationRegistry[] = await Promise.all(
    registries.map(async ({ owner, ...list }) => {
      if (!everyone || !owner) return list;
      const isYours = viewer?.id === owner.id;
      const named = isYours
        ? owner.accountName
        : owner.name && !(await getViewerRelation(owner.id)).hidden
          ? owner.name
          : null;
      return { ...list, ownerName: named ?? list.honoree, isYours };
    }),
  );
  // The guest's own wish list, for the step after their RSVP: the one they
  // added, or else their own list the host linked.
  const ownEntry = guestLists.find((entry) => entry.isYou) ?? null;
  const ownList = ownEntry?.registry ? myLists.find((list) => list.slug === ownEntry.registry!.slug) : undefined;
  const ownUrl = guest?.wishlist_url || ownEntry?.url || null;
  const wishlist: RsvpWishlist | null = everyone
    ? {
        current: ownUrl
          ? { url: ownUrl, title: ownEntry?.registry?.title ?? null, ownListId: ownList?.id ?? null }
          : null,
        giftIdeas: guest?.gift_ideas ?? null,
        account: viewer ? { lists: myLists.map(({ id, title }) => ({ id, title })) } : null,
      }
    : null;
  // The event's own time zone could be a day behind UTC, so it counts as over
  // only once yesterday in UTC is past it. Sign-up days work the same way.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const signupRows = signupSheet ? signupRowsForGuest(signupSheet, guest?.id ?? null, yesterday) : [];
  // A meal train's drop-off address shows only to guests who signed up for a day.
  const signedUp = signupRows.some((row) => row.mine);
  const shown = withAddressFor(event, signedUp);
  const addressHidden = shown !== event && Boolean(event.location_name || event.location_address);
  const mealTrain = hidesAddressUntilSignup(event.event_type);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const eventUrl = `${siteUrl}/e/${event.slug}`;
  const google = googleCalendarUrl(shown, eventUrl);
  // The .ics file has no guest, so it never has a meal train's address.

  return (
    <div className="min-h-screen bg-primary">
      {/* The site's top bar. Logging in or signing up from it comes back to
          this invitation, on the guest's own link when they have one. */}
      <Nav returnTo={`/e/${event.slug}${guest ? `?g=${encodeURIComponent(guest.token)}` : ""}`} />

      <main id="main-content" className="container mx-auto px-4 py-8 sm:py-12">
        <EventInvitation
          event={shown}
          registries={invitationRegistries}
          exchange={exchange}
          wishLists={showGuestLists ? { lists: guestLists, waitingCount: waiting } : null}
          eventSlug={event.slug}
          guestToken={guest?.token ?? null}
          calendar={google ? { google, ics: `/e/${event.slug}/calendar` } : null}
          signup={
            signupSheet
              ? { title: signupSheet.sheet.title, note: signupSheet.sheet.note, rows: signupRows, mealTrain }
              : null
          }
          addressHidden={addressHidden}
          updates={updates}
          // The reply comes before the gift sections: a guest answers before
          // browsing what to give. Group gifts follow them.
          reply={
            <>
              {giftee && exchange && (
                <SecretSantaCard
                  giftee={giftee}
                  budget={exchange.budget}
                  mailed={exchange.mailed}
                  wishlistHref={gifteeWishlistHref}
                />
              )}
              {token && !guest && (
                <p className="rounded-xl bg-sunshine-50 p-4 text-sm text-sunshine-900">
                  This RSVP link isn&apos;t on the guest list anymore. Ask the host for a new one.
                </p>
              )}
              <RsvpForm
                slug={event.slug}
                token={guest?.token ?? null}
                guest={
                  guest
                    ? {
                        name: guest.name,
                        status: guest.rsvp_status,
                        partySize: guest.party_size,
                        kidsCount: guest.kids_count,
                        note: guest.rsvp_note,
                        inExchange: guest.in_exchange,
                        wishlistUrl: guest.wishlist_url,
                        giftIdeas: guest.gift_ideas,
                        shippingAddress: guest.shipping_address,
                        answers: storedAnswers(guest.answers),
                      }
                    : null
                }
                openRsvp={event.open_rsvp && !(exchange?.drawn_at && exchange.mailed)}
                maxPartySize={event.max_party_size}
                askKids={event.ask_kids}
                exchange={
                  exchange
                    ? { kind: exchangeKind(exchange), mailed: exchange.mailed, drawn: Boolean(exchange.drawn_at) }
                    : null
                }
                wishlist={wishlist}
                passed={eventHasPassed(event, yesterday)}
                signup={signupSheet ? { title: signupSheet.sheet.title, rows: signupRows } : null}
                mealTrain={mealTrain}
                questions={storedQuestions(event.rsvp_questions)}
              />
            </>
          }
        >
          <EventGroupGifts gifts={groupGifts} />
        </EventInvitation>
      </main>

      <PoweredByFooter />
    </div>
  );
}
