// The page loaders and server actions the phone app may call without a
// signed-in account (src/app/api/app/data and action). They are the ones the
// website already lets anyone use on its guest pages: the invitation and
// someone else's list.
//
// The app shares this file through `@shared/*`, so it has no imports.
//
// Three kinds of caller reach those routes:
// - "account": a signed-in account's access token. It may call everything.
// - "guest": an anonymous Supabase session's token. The website gives a guest
//   one when they reserve a gift, and a signed-out app holds its own. It may
//   call the guest loaders and the guest actions.
// - "nobody": no token. It may call the guest loaders only. A guest action
//   needs a session, so the action doesn't make a new anonymous user on the
//   server for each call.
//
// Before adding a name here, check that the website's guest page calls it
// for signed-out visitors, and that it reads nothing an account owns. Anything
// left off still needs a signed-in account.

/** Page loaders (src/lib/app-loaders.ts) anyone may call. */
export const GUEST_LOADERS: readonly string[] = ["invitationPage", "publicList"];

/** Server actions ("<module>.<name>" in src/app/api/app/action/route.ts) a guest session may call. */
export const GUEST_ACTIONS: readonly string[] = [
  "events.submitRsvp",
  "registry.reserveItem",
  "registry.confirmGift",
  "registry.releaseGift",
];

export type AppCaller = "account" | "guest" | "nobody";

export type AppCall = { loader: string } | { action: string };

/**
 * Why the routes refuse this call from this caller, or null when it may run.
 * The words and status codes are the ones the routes used before guests could
 * call them, so older app builds read them the same way.
 */
export function appCallRefusal(caller: AppCaller, call: AppCall): { error: string; status: number } | null {
  if (caller === "account") return null;
  if ("loader" in call && GUEST_LOADERS.includes(call.loader)) return null;
  if ("action" in call && caller === "guest" && GUEST_ACTIONS.includes(call.action)) return null;
  return caller === "guest"
    ? { error: "Guests don't have an account.", status: 403 }
    : { error: "Sign in first.", status: 401 };
}

/** The app may call this loader without signing in. */
export function isGuestLoader(loader: string): boolean {
  return GUEST_LOADERS.includes(loader);
}

/** The app may run this action with its guest session. */
export function isGuestAction(action: string): boolean {
  return GUEST_ACTIONS.includes(action);
}
