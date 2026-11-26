import { NextResponse, type NextRequest } from "next/server";
import { eventGuestFromToken, eventIncludesRegistry, registrySlugFromLink, resolveRegistryLink } from "@/lib/events-server";
import { EVENT_GUEST_COOKIE, EVENT_GUEST_COOKIE_OPTIONS, encodeEventGuest } from "@/lib/event-guest-cookie";

// A gift link on a guest's invitation: /e/<event>/gifts?g=<rsvp token>&to=<registry slug>.
// It remembers who the guest is (see src/lib/event-guest-cookie.ts) and sends
// them on to the registry, so the gift form knows their name and the gift is
// matched to their RSVP. For a gift exchange, "to" can be the wishlist of the
// person the guest drew, and the cookie marks them as that person's Secret
// Santa. When everyone gives everyone, "to" can be any guest's wishlist, and
// the registry page shows the guest what the other guests reserved there.
//
// The registry's own address ends up in the address bar, so a guest who
// copies it and sends it on doesn't send their identity along.
//
// The phone app's list screen does the same check without a cookie: it sends
// the event and token with each request (eventGuestFromToken).

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const token = request.nextUrl.searchParams.get("g") ?? "";
  const to = registrySlugFromLink(request.nextUrl.searchParams.get("to") ?? "");
  const eventUrl = new URL(`/e/${slug}`, request.url);
  if (!to) return NextResponse.redirect(eventUrl);

  const registryUrl = new URL(`/r/${to}`, request.url);
  if (!token) return NextResponse.redirect(registryUrl);

  const registry = await resolveRegistryLink(to);
  const guest = registry ? await eventGuestFromToken(slug, token, [registry.id]) : null;
  if (!guest || !registry) return NextResponse.redirect(registryUrl);

  // Unless they're its Secret Santa, the registry must be one the event
  // links, or a guest's wishlist when everyone gives everyone.
  if (!guest.santa && !(await eventIncludesRegistry(guest.eventId, registry.id))) {
    return NextResponse.redirect(registryUrl);
  }

  const response = NextResponse.redirect(registryUrl);
  response.cookies.set(EVENT_GUEST_COOKIE, encodeEventGuest(guest), EVENT_GUEST_COOKIE_OPTIONS);
  return response;
}
