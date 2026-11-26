import { NextResponse } from "next/server";
import * as categories from "@/lib/actions/categories";
import * as eventMessages from "@/lib/actions/event-messages";
import * as events from "@/lib/actions/events";
import * as followInvites from "@/lib/actions/follow-invites";
import * as follows from "@/lib/actions/follows";
import * as giftIdeas from "@/lib/actions/gift-ideas";
import * as giftProfile from "@/lib/actions/gift-profile";
import * as groupGifts from "@/lib/actions/group-gifts";
import * as groups from "@/lib/actions/groups";
import * as itemDetails from "@/lib/actions/item-details";
import * as profile from "@/lib/actions/profile";
import * as registry from "@/lib/actions/registry";
import * as saved from "@/lib/actions/saved";
import * as signups from "@/lib/actions/signups";
import * as tax from "@/lib/actions/tax";
import { appError, authenticateApp, navigationFromError, runAsAppUser } from "@/lib/app-request";

export const dynamic = "force-dynamic";

// POST { action: "<module>.<name>", args: [...] } → runs one of the website's
// server actions as the app's user, and returns what it returned:
// { result }, or { redirect } / { notFound } where the website would have
// gone to another page.
//
// Every export of a "use server" file is already a public endpoint the
// website's pages call, and each one checks who's asking. This route reaches
// the same functions with the app's access token instead of the website's
// cookies, so it lets nobody do anything they couldn't do on the website.
//
// An argument written { "$form": { name: value } } arrives as FormData, for
// the actions that read forms.
const MODULES: Record<string, Record<string, unknown>> = {
  categories,
  eventMessages,
  events,
  followInvites,
  follows,
  giftIdeas,
  giftProfile,
  groupGifts,
  groups,
  itemDetails,
  profile,
  registry,
  saved,
  signups,
  tax,
};

function toArgument(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value) && "$form" in value) {
    const fields = (value as { $form: unknown }).$form;
    const form = new FormData();
    if (fields && typeof fields === "object") {
      for (const [name, field] of Object.entries(fields)) {
        for (const one of Array.isArray(field) ? field : [field]) {
          if (one !== null && one !== undefined) form.append(name, String(one));
        }
      }
    }
    return form;
  }
  return value;
}

export async function POST(request: Request) {
  const auth = await authenticateApp(request);
  if (auth.response) return auth.response;

  let body: { action?: unknown; args?: unknown };
  try {
    body = await request.json();
  } catch {
    return appError("Invalid request", 400);
  }
  const [moduleName, actionName] = typeof body.action === "string" ? body.action.split(".") : [];
  const action =
    moduleName && actionName && Object.hasOwn(MODULES, moduleName) && Object.hasOwn(MODULES[moduleName], actionName)
      ? MODULES[moduleName][actionName]
      : undefined;
  if (typeof action !== "function") return appError("Unknown action", 404);
  const args = Array.isArray(body.args) ? body.args.map(toArgument) : [];

  try {
    const result = await runAsAppUser(auth.accessToken, auth.user, () =>
      (action as (...args: unknown[]) => Promise<unknown>)(...args),
    );
    return NextResponse.json({ result: result ?? null });
  } catch (error) {
    try {
      return NextResponse.json(navigationFromError(error));
    } catch {
      console.error(`[app] ${moduleName}.${actionName} failed:`, error);
      return appError("Something went wrong. Try again.", 500);
    }
  }
}
