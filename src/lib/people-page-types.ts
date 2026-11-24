// What the Following tab and the Account page show, as src/lib/people-page.ts
// loads them for the website and the phone app. Only types, and only relative
// type imports of shareable files, so the app can share it through @shared/*.

import type { GiftProfile, UpcomingBirthday } from "./gift-profile";
import type { ListedRegistry } from "./registry-listing";
import type { PersonalEventType, RegistryType } from "./types";

export interface PersonSummary {
  public_id: string;
  full_name: string | null;
}

export interface FollowPerson extends PersonSummary {
  status: "pending" | "approved";
  /** They follow the account back, and both follows are approved. */
  mutual?: boolean;
}

export interface FollowingTabData {
  /** Everyone the user follows, approved or waiting. */
  people: FollowPerson[];
  /** Lists from the people who approved the user's follow. */
  registries: (ListedRegistry & { owner: PersonSummary })[];
  /** Lists shared with groups the user is in. */
  shared: (ListedRegistry & { owner: PersonSummary; groupNames: string[] })[];
  birthdays: UpcomingBirthday[];
  /** YYYY-MM-DD in UTC. */
  today: string;
}

export interface AccountRegistry {
  id: string;
  title: string;
  is_public: boolean;
  is_private?: boolean;
  listed_on_profile: boolean;
  /** The owner's choice of who sees it on their profile. Read it with profileAudience. */
  profile_audience?: string | null;
  has_shipping_address: boolean;
  registry_type: RegistryType;
  event_type: PersonalEventType | null;
}

export interface AccountPageData {
  profile: {
    public_id: string;
    full_name: string | null;
    /** The profile photo's URL, or null. Checked with profilePhotoUrl (src/lib/profile-photos.ts). */
    avatar_url: string | null;
    discoverable: boolean;
    findable_by_email: boolean;
    email_follow_requests: boolean;
  };
  registries: AccountRegistry[];
  follows: {
    requests: FollowPerson[];
    followers: FollowPerson[];
    following: FollowPerson[];
    blocked: PersonSummary[];
  };
  giftProfile: GiftProfile;
  birthdayEmails: boolean;
}
