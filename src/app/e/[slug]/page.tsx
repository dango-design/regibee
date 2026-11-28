import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { EventInvitation } from "@/components/event-invitation";
import { RsvpForm } from "@/components/rsvp-form";
import { PoweredByFooter } from "@/components/site-footer";
import { SecretSantaCard } from "@/components/secret-santa-card";
import { EventGroupGifts } from "@/components/event-group-gifts";
import { getEventBySlug, loadInvitationPage } from "@/lib/invitation-page";
import { formatEventDate, invitationReplyCta } from "@/lib/events";
import { dateIn } from "@/lib/event-updates";

// What the invitation shows, and to whom, is in loadInvitationPage
// (src/lib/invitation-page.ts). The phone app's invitation screen shows the
// same data.

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
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
  const page = await loadInvitationPage(slug, token ?? null);
  if (!page) notFound();
  const { rsvp, santa, guestToken } = page;

  return (
    <div className="min-h-screen bg-primary">
      {/* The site's top bar. Logging in or signing up from it comes back to
          this invitation, on the guest's own link when they have one. */}
      <Nav returnTo={`/e/${page.slug}${guestToken ? `?g=${encodeURIComponent(guestToken)}` : ""}`} />

      <main id="main-content" className="container mx-auto px-4 py-8 sm:py-12">
        <EventInvitation
          event={page.event}
          registries={page.registries}
          exchange={page.exchange}
          wishLists={page.wishLists}
          eventSlug={page.slug}
          guestToken={guestToken}
          calendar={page.calendar}
          signup={page.signup}
          addressHidden={page.addressHidden}
          updates={page.updates}
          replyCta={invitationReplyCta(rsvp)}
          today={dateIn(page.event.time_zone)}
          // The reply comes before the gift sections: a guest answers before
          // browsing what to give. Group gifts follow them.
          reply={
            <>
              {santa && (
                <SecretSantaCard
                  giftee={santa.giftee}
                  budget={santa.budget}
                  mailed={santa.mailed}
                  wishlistHref={santa.wishlistHref}
                />
              )}
              {page.staleToken && (
                <p className="rounded-xl bg-sunshine-50 dark:bg-sunshine-400/10 p-4 text-sm text-sunshine-900 dark:text-sunshine-200">
                  This RSVP link no longer works. Ask the host for a new one.
                </p>
              )}
              <RsvpForm
                slug={page.slug}
                token={guestToken}
                guest={rsvp.guest}
                openRsvp={rsvp.openRsvp}
                maxPartySize={rsvp.maxPartySize}
                askKids={rsvp.askKids}
                exchange={rsvp.exchange}
                wishlist={rsvp.wishlist}
                passed={rsvp.passed}
                signup={rsvp.signup}
                mealTrain={rsvp.mealTrain}
                questions={rsvp.questions}
              />
            </>
          }
        >
          <EventGroupGifts gifts={page.groupGifts} />
        </EventInvitation>
      </main>

      <PoweredByFooter />
    </div>
  );
}
