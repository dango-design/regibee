import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { FollowButton } from "@/components/follow-button";
import { PublicProfile } from "@/components/public-profile";
import { PoweredByFooter } from "@/components/site-footer";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getViewer, getViewerRelation, seesBirthday, seesGiftDetails } from "@/lib/viewer";
import { cleanPublicNote, parseGiftProfile, visibleGiftProfile } from "@/lib/gift-profile";
import { sharedRegistrySlugsFrom } from "@/lib/groups-server";
import { listSharedEvents } from "@/lib/shared-events-server";
import { profileAudience, profileViewer, seesOnProfile } from "@/lib/list-access";
import {
  LISTED_REGISTRY_COLUMNS,
  PROFILE_AUDIENCE_COLUMNS,
  type ListedRegistry,
  type ProfileAudienceRow,
} from "@/lib/registry-listing";
import { displayName, profilePath, publicIdFromPath } from "@/lib/profile-link";
import { profilePhotoUrl } from "@/lib/profile-photos";

type Profile = { id: string; public_id: string; full_name: string | null; avatar_url: string | null };
/** The profile, and its account's email once confirmed. The email is for matching guest rows and stays on the server. */
type FoundProfile = Profile & { confirmedEmail: string | null };

// Old links used usernames, which had this format (see 011_public_profiles.sql).
const OLD_USERNAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// `profiles` is only readable by its owner, so this reads with the service-role
// client, always filtered by the id in the URL. The id is random, so a profile
// is only reachable by people who were given its link or found it in search.
// Links from before usernames were removed are looked up by username, and the
// page redirects them to the current link.
const getProfile = cache(async (segment: string): Promise<FoundProfile | null> => {
  const value = segment.toLowerCase();
  const columns = "id, public_id, full_name, avatar_url";

  let profile: Profile | null = null;
  const publicId = publicIdFromPath(value);
  if (publicId) {
    const { data } = await supabaseAdmin.from("profiles").select(columns).eq("public_id", publicId).maybeSingle();
    profile = data as Profile | null;
  }
  if (!profile && OLD_USERNAME_PATTERN.test(value)) {
    const { data } = await supabaseAdmin.from("profiles").select(columns).eq("username", value).maybeSingle();
    profile = data as Profile | null;
  }
  if (!profile) return null;

  // Guests have profile rows too, from the anonymous sessions created when
  // someone reserves a gift. They don't get a profile page.
  const { data: account } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  if (!account?.user || account.user.is_anonymous) return null;

  return { ...profile, confirmedEmail: account.user.email_confirmed_at ? (account.user.email ?? null) : null };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ profile: string }>;
}): Promise<Metadata> {
  const { profile: segment } = await params;
  const profile = await getProfile(segment);

  if (!profile) return { title: "Profile Not Found" };
  if ((await getViewerRelation(profile.id)).hidden) return { title: "Profile Not Found" };

  const name = displayName(profile);
  return {
    title: `${name} | Regibee`,
    description: `See ${name}'s registries on Regibee`,
    // Profiles are for sharing by link. Searching someone's name shouldn't
    // bring up their registries.
    robots: { index: false, follow: false },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ profile: string }>;
}) {
  const { profile: segment } = await params;
  const profile = await getProfile(segment);

  if (!profile) {
    notFound();
  }

  // Old username links, and links made before a name change.
  const canonicalPath = profilePath(profile);
  if (`/u/${segment}` !== canonicalPath) {
    redirect(canonicalPath);
  }

  // Someone this person blocked doesn't see their profile while signed in.
  const relation = await getViewerRelation(profile.id);
  const { state: followState, isOwner: isOwnProfile, hidden } = relation;
  if (hidden) {
    notFound();
  }

  // The owner chooses who sees each list here: friends, followers or everyone
  // (profileAudience). A list also shows to people in a group the owner
  // shared it with (by a confirmed email), whatever that choice is. Someone
  // who blocked the owner doesn't get the group's lists.
  const viewerKind = profileViewer({
    isOwner: isOwnProfile,
    follows: followState === "approved",
    followedBack: relation.followsYou,
  });
  // The signed-in viewer, for the group's lists and the events they share
  // with this person. Neither is for the owner or for someone who blocked them.
  const viewer = isOwnProfile || followState === "blocked" ? null : await getViewer();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: listed }, sharedSlugs, giftRow, noteRow, sharedEvents] = await Promise.all([
    supabaseAdmin
      .from("registries")
      .select(`${LISTED_REGISTRY_COLUMNS}, ${PROFILE_AUDIENCE_COLUMNS}`)
      .eq("owner_id", profile.id)
      .eq("listed_on_profile", true),
    viewer
      ? sharedRegistrySlugsFrom(profile.id, { id: viewer.id, email: viewer.email_confirmed_at ? viewer.email : null })
      : Promise.resolve(new Set<string>()),
    // Separate from getProfile, so the page still works before
    // 20261112062844_gift_profiles_and_birthday_reminders.sql has run.
    supabaseAdmin.from("profiles").select("gift_profile").eq("id", profile.id).maybeSingle(),
    // Separate too. It errors until 20261124084611_profile_public_note.sql
    // has run, which counts as no note.
    supabaseAdmin.from("profiles").select("public_note").eq("id", profile.id).maybeSingle(),
    viewer
      ? listSharedEvents(
          { id: viewer.id, email: viewer.email_confirmed_at ? (viewer.email ?? null) : null },
          { id: profile.id, email: profile.confirmedEmail },
          today,
        )
      : Promise.resolve([]),
  ]);
  // Sizes, likes and the rest are for the person and the people they follow
  // who follow them back. The birthday is for every follower they approved.
  // Neither leaves the server for anyone else.
  const showBirthday = seesBirthday(relation);
  const giftProfile = visibleGiftProfile(parseGiftProfile(giftRow.error ? null : giftRow.data?.gift_profile), {
    details: seesGiftDetails(relation),
    birthday: showBirthday,
  });
  // The public note is for everyone who opens the profile.
  const publicNote = cleanPublicNote(noteRow.error ? null : noteRow.data?.public_note);
  // The audience columns are only for choosing; they aren't sent on.
  const registries: ListedRegistry[] = ((listed || []) as unknown as (ListedRegistry & ProfileAudienceRow)[])
    .filter((registry) => seesOnProfile(profileAudience(registry), viewerKind) || sharedSlugs.has(registry.slug))
    .map(({ is_private: _private, listed_on_profile: _listed, profile_audience: _audience, ...registry }) => registry);

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main id="main-content" className="flex-1">
        <PublicProfile
          fullName={profile.full_name}
          photoUrl={profilePhotoUrl(profile)}
          registries={registries}
          sharedEvents={sharedEvents}
          today={today}
          isOwnProfile={isOwnProfile}
          publicNote={publicNote}
          giftProfile={giftProfile}
          showBirthday={showBirthday}
          followAction={
            <FollowButton
              publicId={profile.public_id}
              name={displayName(profile)}
              state={followState}
              followsYou={relation.followsYou}
              returnTo={canonicalPath}
            />
          }
        />
      </main>
      <PoweredByFooter />
    </div>
  );
}
