# Plan: native screens for guest and follower pages

Status: approved by Brian on 2026-11-25, with the whole invitation in the first PR. Step 1 is built, and so are the first part of step 2 (viewing someone else's list and reserving a gift) and the signed-out allowlist, so both screens work signed out. The rest is not.

## Why

The app shows other people's lists, events, profiles, group gifts and invite links as website pages in a web view (`src/app/web.tsx`). Those pages don't follow the phone's dark mode, use the website's layout, and feel like a website inside the app. The web view was a shortcut: it reused the website's guest flows (reserving, RSVPs, following) without building them twice. This plan replaces those pages with native screens, one at a time, and keeps the web view as the fallback for any page not yet native.

## The pages today

| Page | What a visitor does there | Where its data comes from | Actions it calls | Size |
| --- | --- | --- | --- | --- |
| Event invitation `/e/<slug>` (`?g=<token>` is a guest's own link) | Read the details, add to calendar, open the map, read the host's updates, RSVP (answer, party size, kids, note, the host's questions), sign up for a sheet row or a meal train day, join a gift exchange, add a wishlist when everyone gives everyone, see who they drew, follow other guests, open the linked lists and group gifts | Inline in `src/app/e/[slug]/page.tsx`, from helpers in `src/lib/events-server.ts`, `signups.ts`, `group-gifts-server.ts`, `guest-follows.ts`. All service-role reads, filtered by slug and token | `events.submitRsvp`, `events.saveEventWishlist`, `follows.requestFollow` | Large, but splits well |
| Someone else's list `/r/<slug>` | Reserve an item or mark it bought, confirm or release their gift, chip in to a gift fund, cover an item the owner bought, suggest an item, start a group gift, follow the owner | `loadPublicList` in `src/lib/public-list-page.ts` (built). The page passes in the `regibee_my_gifts` cookie, a signed buyer link and the event guest cookie; the app passes the purchase ids it keeps and the event and token | `registry.reserveItem`, `confirmGift`, `releaseGift`, `contributeToCashFund`, `coverParentPurchasedItem`, `suggestItem`, `groupGifts.startGroupGift`, `follows.requestFollow` / `cancelFollow` | Large |
| Profile `/u/<profile>` | See the person's lists, note, gift profile and shared events; follow or follow back | Inline in `src/app/u/[profile]/page.tsx`, from `list-access.ts`, `gift-profile.ts`, `viewer.ts`, `shared-events-server.ts` | `follows.requestFollow` / `cancelFollow` | Small to medium |
| Group gift `/group-gift/<token>` | Pledge, change or withdraw a pledge; the organizer marks pledges paid, marks it bought or calls it off | Mostly ready: `loadGroupGift` and `groupGiftViewFor` in `src/lib/group-gifts-server.ts` | `groupGifts.pledgeToGroupGift`, `changePledge`, `withdrawPledge`, `setPledgePaid`, `markGroupGiftBought`, `callOffGroupGift` | Medium |
| `/invite/<token>` (co-manage a list) | Accept | Inline | `registry.acceptInvite` | Small |
| `/host-invite/<token>` | Accept co-hosting | Inline | `events.acceptCoHostInvite` | Small |
| `/follow-invite/<token>` | Accept or decline, then follow back | `getFollowInvite`, `getFollowStatus` | `followInvites.acceptFollowInvite` / `declineFollowInvite`, `follows.requestFollow` | Small |
| `/list-request/<token>` | Make the list the host asked for | Inline | `events.acceptListRequest` | Small |
| `/privacy` | Read | Static | None | Stays a web page |

## How every native screen gets its data

- Each page's reads move out of its `page.tsx` into a loader in `src/lib/<page>-page.ts`, as `loadListPage` already does. The website page calls the loader and renders what it returns. `src/lib/app-loaders.ts` lists it, so the app gets the same data from `/api/app/data`. The result's types go in a `<page>-page-types.ts` file with no imports from server code, so the app can import them through `@shared/*`.
- Changes go through the website's own server actions on `/api/app/action`, as the app's other screens do. No new server logic for the app.
- The loader returns only what the page already sends to the browser. Nothing new reaches the phone.
- The rules stay where they are, inside the loaders: private lists are not found, owners who hide reservations see everything as unreserved, blocked viewers get not found, profile lists pass through `profileAudience` and `seesOnProfile`, and gift ideas never appear (no guest page reads them).
- The app keeps one door to these pages: `openSite(path)` in `mobile/src/lib/web.ts`, plus `redirectSystemPath` in `+native-intent.ts` for links from outside. `nativeRoute(path)` decides: a native screen when there is one, the web view otherwise. Native guest screens work signed out too (see "Signed out"). Links tapped inside the web view that lead to a native page open the native screen.
- Each native screen is a file at the root of `mobile/src/app`, so it sits in the root stack and back returns to the page it came from. It uses the website's path: `mobile/src/app/e/[slug].tsx` for `/e/<slug>`.

## Signed out

A signed-out app opens these pages from Android App Links and from links shared to it. Built: the invitation and the list are native signed out too.

- The website lets the app call a short allowlist of guest loaders and actions without a signed-in account: `src/lib/app-guest-calls.ts`, which the app shares through `@shared/*`. They are the ones the website's guest pages let anyone use: the `invitationPage` and `publicList` loaders, and `events.submitRsvp`, `registry.reserveItem`, `confirmGift` and `releaseGift`. Everything else still needs a signed-in account, and `src/lib/app-guest-calls.test.ts` checks every loader and action the routes know against the list.
- Who's calling: a signed-in account's token may call everything. An anonymous guest session's token may call the guest loaders and actions. No token may call the guest loaders only. `identifyAppCaller` in `src/lib/app-request.ts` tells them apart, and with no token `createClient()` returns a client with no session that still ignores cookies.
- Why the app holds its own anonymous session for guest actions, instead of calling them with no user: the website's actions give a guest with no session a new anonymous user on the server (`reserveItem` and the gift fund, suggestion and cover actions call `signInAnonymously`). Called with no user, each app gift would make a throwaway user on the server, and Supabase limits anonymous sign-ins per IP address, which on the server is shared by every guest. A session made on the phone counts against the phone's own address, is made once per phone like a browser's, and lets the actions run unchanged, exactly as they do for a website guest. Reading a page needs no user, so loaders run with no token and only a gift or an RSVP makes the session.
- The session is saved under its own key (`guestSupabase` in `mobile/src/lib/supabase.ts`), apart from the account's, so the app never treats it as signed in and signing in or out leaves it alone. `mobile/src/lib/api.ts` picks the token for each call.
- Emails: the guest actions are the website's own, so their emails count against the page's visitor allowance, by the page's owner's level, whoever calls ("Account levels" in the root CLAUDE.md).
- Gifts: a signed-out guest's purchase ids are kept on the phone under the phone's own key (`mobile/src/lib/my-gifts.ts`). When someone signs in on the phone, they move to that account, so the person can still say they bought a gift or release it. The website does the same: its `regibee_my_gifts` cookie belongs to the browser, not the account. The app and the web view still don't share gifts.
- The demo ("Look around first") has no account, so it sees these screens as a signed-out guest. A gift or an RSVP there is real, as it was in the web view.
- A Regibee wishlist on an invitation takes an account. Signed out, that step offers "Make a free wishlist" and "Log in", as the website does.
- Group gift pledges (`regibee_group_pledges`) wait for the native group gift page (step 4). Gift funds, suggestions and covering are added to the allowlist with their native sheets, if the website lets signed-out visitors use them.

## Order

1. **The whole event invitation** (first PR, built). Native for signed-in accounts: the invitation picture or the event's color, details, calendar, map, the host's updates, the RSVP (answer, party size, kids, note, the host's questions, and RSVPing from the event link with a name and email when the host allows it), sign-up sheets and meal trains, gift exchanges (Secret Santa and everyone gives everyone, with the wishlist step and following other guests), who the guest drew, and group gifts. The list rows go through the event's gift link, as the website does, so the gift is matched to the RSVP. Since step 2 that link opens the native list screen. Group gifts open in the web view, until step 4.
2. **Someone else's list and reserving a gift.** In two or three PRs.
   - **Viewing and reserving** (built, signed in only): `mobile/src/app/r/[slug].tsx`. The header and owner (with Follow), the owner's note and gift profile, the notices (hidden reservations, Secret Santa, the events the list is on, fellow guests), the reservation banner, items by category with their gift status, and the whole gift sheet: reserve, mark as bought, buy, say you bought it, release, see your gift. Purchase ids are kept on the phone per account (`mobile/src/lib/my-gifts.ts`). A gift link on an invitation opens this screen with the event and RSVP token, which go to the loader and to `reserveItem` (`eventSlug`, `guestToken`), so the gift is matched to the guest's RSVP without the website's cookie. Gift funds, covering an item the owners bought, suggesting an item and starting a group gift are buttons that open the website's page in the web view, through the gift link when there is one.
   - **Signed out** (built): the signed-out allowlist above, so a signed-out phone gets the native list and invitation.
   - **Next:** gift funds, covering, suggestions and group gifts as native sheets, each added to the allowlist when the website lets signed-out visitors use it.
3. **Profiles.** Small once lists are native, since a profile is mostly links to lists.
4. **Group gift page.** The loader is nearly there.
5. **The four invite pages.** Small, one loader each. Each needs an account, so they're signed-in only.
6. **Clean up.** The web view stays for `/privacy` and for any path that has no screen, such as a page added to the website later.

## Decided

- The whole invitation went into one PR, instead of leaving gift exchanges and sign-up sheets for a second one.
- Signed-out visitors kept the web view until the signed-out allowlist, which came in its own PR after the list screen.
- The list screen's first PR is signed in only. The signed-out allowlist is its own PR.
- A list opened from an invitation's gift link sends the event's slug and the guest's RSVP token with each request, in place of the website's signed event guest cookie. The server checks the token the same way the gift link route does (`eventGuestFromToken`).
- Signed out, the app reads guest pages with no token and makes its own anonymous session on the phone only for guest actions, instead of calling everything with no user. See "Signed out" for why.
