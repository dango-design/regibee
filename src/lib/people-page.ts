// What the Following tab and the Account page show
// (src/app/(protected)/dashboard/(tabs)/following/page.tsx and
// src/app/(protected)/dashboard/account/page.tsx). The website's pages and
// the phone app (src/app/api/app/data) both load them here.

import { listFollowingFeed, listFollows } from "@/lib/follows";
import { parseGiftEmails } from "./gift-emails";
import { listUpcomingBirthdays } from "@/lib/birthdays-server";
import { listRegistriesSharedWithViewer } from "@/lib/groups-server";
import { cleanPublicNote, parseGiftProfile } from "@/lib/gift-profile";
import { profilePhotoUrl } from "@/lib/profile-photos";
import { getViewer } from "@/lib/viewer";
import { createClient } from "@/utils/supabase/server";
import type { AccountPageData, AccountRegistry, FollowingTabData } from "@/lib/people-page-types";

export type * from "@/lib/people-page-types";

/** The Following tab. Null for guests and people who aren't signed in. */
export async function loadFollowingTab(): Promise<FollowingTabData | null> {
  // Only real accounts can follow people.
  const user = await getViewer();
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const [feed, shared, birthdays] = await Promise.all([
    listFollowingFeed(user.id),
    // An email counts for group membership only once it's confirmed.
    listRegistriesSharedWithViewer({ id: user.id, email: user.email_confirmed_at ? user.email : null }),
    listUpcomingBirthdays(user.id, today),
  ]);
  return { people: feed.people, registries: feed.registries, shared, birthdays, today };
}

/** The Account page. Null for guests and people who aren't signed in. */
export async function loadAccountPage(): Promise<AccountPageData | null> {
  // Only real accounts have a profile.
  const [supabase, user] = await Promise.all([createClient(), getViewer()]);
  if (!user) return null;

  const [{ data: profile }, { data: registries }, follows, giftRow, noteRow] = await Promise.all([
    supabase
      .from("profiles")
      .select("public_id, full_name, avatar_url, discoverable, findable_by_email, email_follow_requests")
      .eq("id", user.id)
      .single(),
    supabase
      .from("registries")
      .select("id, title, is_public, is_private, listed_on_profile, profile_audience, registry_type, event_type, settings")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    listFollows(user.id),
    // Separate, so the page still works before
    // 20261112062844_gift_profiles_and_birthday_reminders.sql has run. Until
    // then this errors, which counts as an empty profile with emails on.
    supabase.from("profiles").select("gift_profile, email_birthday_reminders").eq("id", user.id).maybeSingle(),
    // Separate too. It errors until 20261124084611_profile_public_note.sql
    // has run, which counts as no note.
    supabase.from("profiles").select("public_note").eq("id", user.id).maybeSingle(),
  ]);
  // Separate too: it errors until 20261127205241_email_settings_and_new_emails.sql
  // has run, which counts as one email per gift.
  const { data: giftEmailsRow } = await supabase.from("profiles").select("gift_emails").eq("id", user.id).maybeSingle();
  const gift = giftRow.error ? null : giftRow.data;

  const accountRegistries: AccountRegistry[] = (registries || []).map(({ settings, ...registry }) => ({
    ...registry,
    has_shipping_address: Boolean(settings?.shipping_address),
  }));

  return {
    profile: {
      public_id: profile?.public_id ?? "",
      full_name: profile?.full_name ?? null,
      avatar_url: profile ? profilePhotoUrl(profile) : null,
      discoverable: profile?.discoverable ?? false,
      findable_by_email: profile?.findable_by_email ?? false,
      email_follow_requests: profile?.email_follow_requests ?? true,
      public_note: cleanPublicNote(noteRow.error ? null : noteRow.data?.public_note),
    },
    registries: accountRegistries,
    follows,
    giftProfile: parseGiftProfile(gift?.gift_profile),
    birthdayEmails: gift?.email_birthday_reminders ?? true,
    giftEmails: parseGiftEmails(giftEmailsRow?.gift_emails),
  };
}
