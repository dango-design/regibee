// The support team's view of any account and list, at /support. It lets the
// team see what someone sees when they ask for help, without being invited
// to their list. See "Support view" in CLAUDE.md and
// supabase/migrations/20261123064207_support_view.sql.
//
// Server-only. Everything here reads with the service-role client, so each
// support page calls requireSupport before anything else, and every load
// checks again. Never export these from a "use server" file.

import { cache } from "react";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getViewer } from "@/lib/viewer";
import { DAILY_EMAILS } from "@/lib/account-levels";
import { listEventsForUser } from "@/lib/events-server";
import { GIFT_IDEA_COLUMNS, toGiftIdea, type GiftIdea, type GiftIdeaRow } from "@/lib/gift-ideas";
import { loadItemsForLists } from "@/lib/list-items";
import { profilePath } from "@/lib/profile-link";
import { parseSupportSearch } from "@/lib/support-search";
import type { PersonalEventType, RegistryType } from "@/lib/types";
import type { EventType } from "@/lib/events";

/** Whether this account is on the support team: its confirmed email is in support_emails. */
export const isSupportAccount = cache(async (userId: string): Promise<boolean> => {
  const { data, error } = await supabaseAdmin.rpc("is_support", { p_user: userId });
  if (error) {
    // Before the migration runs, the function doesn't exist, and nobody is
    // on the team. Anything else is worth knowing about.
    if (error.code !== "PGRST202" && error.code !== "42883") {
      console.error("[support] Failed to check the support team:", error.message);
    }
    return false;
  }
  return data === true;
});

/** The signed-in account, when it's on the support team. */
export const getSupportViewer = cache(async () => {
  const viewer = await getViewer();
  if (!viewer) return null;
  return (await isSupportAccount(viewer.id)) ? viewer : null;
});

/**
 * The support account looking at the page. Everyone else, signed out
 * included, gets the not-found page, so the section doesn't show it exists.
 */
export async function requireSupport() {
  const viewer = await getSupportViewer();
  if (!viewer) notFound();
  return viewer;
}

export type SupportViewKind = "account" | "list" | "hidden_gifts";

/**
 * Records that someone on the support team opened an account or a list. If
 * the record can't be saved, this throws, so the page shows an error instead
 * of the data.
 */
export async function recordSupportView(opts: {
  supportUserId: string;
  what: SupportViewKind;
  accountId: string;
  registryId?: string | null;
}) {
  const { error } = await supabaseAdmin.from("support_views").insert({
    support_user_id: opts.supportUserId,
    what: opts.what,
    account_id: opts.accountId,
    registry_id: opts.registryId ?? null,
  });
  if (error) throw new Error(`Couldn't record the support view: ${error.message}`);
}

// ── Search ──────────────────────────────────────────────────────────────

export interface SupportAccountResult {
  id: string;
  email: string | null;
  name: string | null;
  confirmed: boolean;
  createdAt: string;
}

export interface SupportListResult {
  id: string;
  title: string;
  slug: string;
  ownerId: string;
  ownerName: string | null;
  isPrivate: boolean;
  isPublic: boolean;
  createdAt: string;
}

export interface SupportSearchResults {
  accounts: SupportAccountResult[];
  lists: SupportListResult[];
}

type AccountRow = { id: string; email: string | null; full_name: string | null; email_confirmed_at: string | null; created_at: string };
type ListRow = {
  id: string;
  title: string;
  slug: string;
  owner_id: string;
  owner_name: string | null;
  is_private: boolean | null;
  is_public: boolean;
  created_at: string;
};

function toAccountResult(row: AccountRow): SupportAccountResult {
  return {
    id: row.id,
    email: row.email,
    name: row.full_name,
    confirmed: Boolean(row.email_confirmed_at),
    createdAt: row.created_at,
  };
}

function toListResult(row: ListRow): SupportListResult {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    isPrivate: Boolean(row.is_private),
    isPublic: row.is_public,
    createdAt: row.created_at,
  };
}

/**
 * Accounts and lists matching what was typed: part of an email, a name or a
 * list's title, or a pasted /r/ or /u/ link. Null when the account isn't on
 * the support team.
 */
export async function searchForSupport(query: string): Promise<SupportSearchResults | null> {
  if (!(await getSupportViewer())) return null;
  const search = parseSupportSearch(query);
  if (!search) return { accounts: [], lists: [] };

  if (search.kind === "list") {
    const { data, error } = await supabaseAdmin.rpc("support_find_lists", { p_query: search.slug });
    if (error) throw error;
    return { accounts: [], lists: ((data ?? []) as ListRow[]).map(toListResult) };
  }

  if (search.kind === "profile") {
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("public_id", search.publicId).maybeSingle();
    if (!profile) return { accounts: [], lists: [] };
    const account = await loadAccountSummary(profile.id as string);
    return { accounts: account ? [account] : [], lists: [] };
  }

  const [accounts, lists] = await Promise.all([
    supabaseAdmin.rpc("support_find_accounts", { p_query: search.text }),
    supabaseAdmin.rpc("support_find_lists", { p_query: search.text }),
  ]);
  if (accounts.error) throw accounts.error;
  if (lists.error) throw lists.error;
  return {
    accounts: ((accounts.data ?? []) as AccountRow[]).map(toAccountResult),
    lists: ((lists.data ?? []) as ListRow[]).map(toListResult),
  };
}

async function loadAccountSummary(userId: string): Promise<SupportAccountResult | null> {
  const [{ data: auth }, { data: profile }] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);
  const user = auth?.user;
  if (!user || user.is_anonymous) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    name: (profile?.full_name as string | null) ?? null,
    confirmed: Boolean(user.email_confirmed_at),
    createdAt: user.created_at,
  };
}

// ── An account ──────────────────────────────────────────────────────────

export interface SupportList {
  id: string;
  title: string;
  slug: string;
  isPrivate: boolean;
  isPublic: boolean;
  registryType: RegistryType;
  eventType: PersonalEventType | null;
  eventDate: string | null;
  createdAt: string;
  itemCount: number;
}

export interface SupportEvent {
  id: string;
  title: string;
  eventType: EventType;
  eventDate: string | null;
  guestCount: number;
  /** True when the account owns it, false when it co-hosts. */
  owns: boolean;
}

export interface SupportAccount {
  id: string;
  email: string | null;
  name: string | null;
  /** The account's profile page (/u/…), when it has one. */
  profilePath: string | null;
  confirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  /** How they sign in: "email", "google" and so on. */
  signInMethods: string[];
  level: "basic" | "star";
  emailsToday: { sent: number; limit: number };
  ownedLists: SupportList[];
  managedLists: SupportList[];
  events: SupportEvent[];
  giftIdeas: GiftIdea[];
}

const LIST_COLUMNS = "id, title, slug, is_private, is_public, registry_type, event_type, event_date, created_at";

async function loadLists(rows: any[]): Promise<SupportList[]> {
  if (rows.length === 0) return [];
  // Every item on each list, placed ones included (src/lib/list-items.ts).
  const items = await loadItemsForLists(
    rows.map((r) => r.id as string),
    "id, registry_id, category_id, sort_order, created_at",
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    isPrivate: Boolean(r.is_private),
    isPublic: Boolean(r.is_public),
    registryType: r.registry_type ?? "baby",
    eventType: r.event_type ?? null,
    eventDate: r.event_date ?? null,
    createdAt: r.created_at,
    itemCount: items.get(r.id)?.length ?? 0,
  }));
}

/**
 * Everything the account page on /support shows about one account. Null
 * when the account doesn't exist, is a guest's anonymous session, or the
 * signed-in account isn't on the support team.
 */
export async function loadAccountForSupport(userId: string): Promise<SupportAccount | null> {
  if (!(await getSupportViewer())) return null;

  const { data: auth, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
  const user = auth?.user;
  if (authError || !user || user.is_anonymous) return null;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: profile }, { data: level }, { data: sends }, { data: owned }, { data: managed }, events, { data: ideas }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, public_id").eq("id", userId).maybeSingle(),
      supabaseAdmin.rpc("account_level", { p_user: userId }),
      supabaseAdmin.from("email_sends").select("emails").eq("user_id", userId).gte("sent_at", dayAgo),
      supabaseAdmin.from("registries").select(LIST_COLUMNS).eq("owner_id", userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("registry_managers").select("registry_id").eq("user_id", userId).eq("role", "manager"),
      listEventsForUser(userId),
      supabaseAdmin
        .from("gift_ideas")
        .select(GIFT_IDEA_COLUMNS)
        .eq("owner_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  const managedIds = (managed ?? []).map((m) => m.registry_id as string);
  const { data: managedRows } = managedIds.length
    ? await supabaseAdmin.from("registries").select(LIST_COLUMNS).in("id", managedIds).neq("owner_id", userId).order("created_at", { ascending: false })
    : { data: [] as any[] };

  const [ownedLists, managedLists] = await Promise.all([loadLists(owned ?? []), loadLists(managedRows ?? [])]);
  const accountLevel = level === "star" ? "star" : "basic";

  return {
    id: user.id,
    email: user.email ?? null,
    name: (profile?.full_name as string | null) ?? null,
    profilePath: profile?.public_id
      ? profilePath({ public_id: profile.public_id as string, full_name: (profile.full_name as string | null) ?? null })
      : null,
    confirmed: Boolean(user.email_confirmed_at),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    signInMethods: ((user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider]).filter(
      (p): p is string => typeof p === "string",
    ),
    level: accountLevel,
    emailsToday: {
      sent: (sends ?? []).reduce((sum, row) => sum + ((row.emails as number) || 0), 0),
      limit: DAILY_EMAILS[accountLevel],
    },
    ownedLists,
    managedLists,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      eventType: event.event_type,
      eventDate: event.event_date ?? null,
      guestCount: event.event_guests?.length ?? 0,
      owns: event.owner_id === userId,
    })),
    giftIdeas: ((ideas ?? []) as GiftIdeaRow[]).map(toGiftIdea),
  };
}

// ── A list's extra facts ────────────────────────────────────────────────

export interface SupportListFacts {
  owner: { id: string; name: string | null; email: string | null };
  managers: { id: string; name: string | null; email: string | null }[];
  /** Co-manager invites that haven't been used up and haven't expired. */
  pendingInvites: { email: string | null; expiresAt: string }[];
  oldLinkCount: number;
}

async function emailsFor(ids: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      result.set(id, data?.user?.email ?? null);
    }),
  );
  return result;
}

/**
 * What the list page on /support shows besides the owner's own view: who
 * owns and manages it, pending co-manager invites, and how many old links it
 * has. Null when the signed-in account isn't on the support team.
 */
export async function loadListFactsForSupport(registryId: string, ownerId: string): Promise<SupportListFacts | null> {
  if (!(await getSupportViewer())) return null;

  const [{ data: managerRows }, { data: invites }, { count: oldLinkCount }] = await Promise.all([
    supabaseAdmin.from("registry_managers").select("user_id, role").eq("registry_id", registryId),
    supabaseAdmin
      .from("registry_invites")
      .select("email, expires_at, max_uses, use_count")
      .eq("registry_id", registryId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("registry_old_links").select("slug", { count: "exact", head: true }).eq("registry_id", registryId),
  ]);

  const managerIds = (managerRows ?? []).filter((m) => m.user_id !== ownerId).map((m) => m.user_id as string);
  const ids = [ownerId, ...managerIds];
  const [{ data: profiles }, emails] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
    emailsFor(ids),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]));
  const person = (id: string) => ({ id, name: names.get(id) ?? null, email: emails.get(id) ?? null });

  return {
    owner: person(ownerId),
    managers: managerIds.map(person),
    pendingInvites: (invites ?? [])
      .filter((i) => i.max_uses == null || (i.use_count as number) < (i.max_uses as number))
      .map((i) => ({ email: (i.email as string | null) ?? null, expiresAt: i.expires_at as string })),
    oldLinkCount: oldLinkCount ?? 0,
  };
}
