"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import {
  SECTION_NAV_GRID,
  SECTION_SCROLL_MARGIN,
  SectionNav,
  SectionTitle,
  type PageSection,
} from "@/components/section-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/base/input/input";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DeleteAccountCard } from "@/components/delete-account-card";
import { FollowLists } from "@/components/follow-lists";
import { GiftProfileForm, type SaveGiftProfile } from "@/components/gift-profile-form";
import { BirthdayEmailsSetting } from "@/components/birthday-emails-setting";
import { PhotoUploadButton } from "@/components/photo-upload-button";
import { profileAudienceHint } from "@/components/profile-listing-field";
import { SelectField } from "@/components/base/select/select-field";
import { ProfileAvatar } from "@/components/profile-avatar";
import { saveProfile, setProfilePhoto, setRegistryProfileAudience } from "@/lib/actions/profile";
import { saveGiftProfile } from "@/lib/actions/gift-profile";
import { MAX_PUBLIC_NOTE_LENGTH, type GiftProfile } from "@/lib/gift-profile";
import { TextArea } from "@/components/base/textarea/textarea";
import { occasionLabel } from "@/lib/registry-copy";
import {
  LIST_ACCESS,
  PROFILE_AUDIENCE,
  listVisibility,
  profileAudience,
  profileAudienceChoices,
  type ProfileAudience,
} from "@/lib/list-access";
import { displayName, profilePath } from "@/lib/profile-link";
import { uploadProfilePhoto } from "@/lib/upload-profile-photo";
import type { PhotoUploadResult } from "@/lib/upload-registry-photo";
import { cx } from "@/lib/utils/cx";
import type { FollowPerson, PersonSummary } from "@/lib/follows";
import type { PersonalEventType, RegistryType } from "@/lib/types";

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

function RegistryListingRow({
  registry,
  action,
}: {
  registry: AccountRegistry;
  action: typeof setRegistryProfileAudience;
}) {
  const [audience, setAudience] = useState<ProfileAudience>(profileAudience(registry));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hint = profileAudienceHint(audience, registry.has_shipping_address);

  const handleChange = async (next: ProfileAudience) => {
    const before = audience;
    setAudience(next);
    setSaving(true);
    setError("");
    const result = await action(registry.id, next);
    if (result?.error) {
      setAudience(before);
      setError(result.error);
    }
    setSaving(false);
  };

  const visibility = listVisibility(registry);
  if (visibility === "private") {
    return (
      <div className="text-sm">
        <p className="font-medium text-secondary">{registry.title}</p>
        <p className="text-tertiary">Private, so it can&apos;t show on your profile</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-secondary">{registry.title}</p>
          <p className="text-tertiary">
            {occasionLabel(registry.registry_type, registry.event_type)} · {LIST_ACCESS[visibility].short}
          </p>
        </div>
        <SelectField
          aria-label={`Who sees ${registry.title} on your profile`}
          className="w-40 shrink-0"
          value={audience}
          disabled={saving}
          onChange={(value) => handleChange(value as ProfileAudience)}
          options={profileAudienceChoices(visibility).map((value) => ({
            value,
            label: PROFILE_AUDIENCE[value].label,
          }))}
        />
      </div>
      {hint && <p className="mt-1 text-sm text-tertiary">{hint}</p>}
      {error && <p className="mt-1 text-sm text-error-primary">{error}</p>}
    </div>
  );
}

/** Old section ids that links still use. Follow request emails already sent link to #follows. */
const RENAMED_SECTIONS: Record<string, string> = { follows: "follow-requests" };

export function AccountSettings({
  profile,
  registries,
  saveAction = saveProfile,
  listAction = setRegistryProfileAudience,
  uploadPhoto,
  photoAction = setProfilePhoto,
  follows,
  followActions,
  giftProfile,
  giftProfileAction = saveGiftProfile,
  birthdayEmails,
  birthdayEmailsAction,
  deleteAccountActions,
  basePath = "",
}: {
  profile: {
    public_id: string;
    full_name: string | null;
    /** The profile photo's URL. */
    avatar_url?: string | null;
    discoverable?: boolean;
    findable_by_email?: boolean;
    email_follow_requests?: boolean;
    /** What they wrote for everyone who opens their profile. */
    public_note?: string | null;
  };
  registries: AccountRegistry[];
  follows?: {
    requests: FollowPerson[];
    followers: FollowPerson[];
    following: FollowPerson[];
    blocked?: PersonSummary[];
  };
  saveAction?: typeof saveProfile;
  listAction?: typeof setRegistryProfileAudience;
  /** Uploads a profile photo. The site uploads to the account's folder; the demo makes a local URL. */
  uploadPhoto?: (file: File) => Promise<PhotoUploadResult>;
  /** Saves or removes the profile photo. */
  photoAction?: (photoUrl: string | null) => Promise<{ error?: string | null; success?: boolean }>;
  /** Stand-ins for the follow lists' server actions. The demo passes them. */
  followActions?: Pick<
    React.ComponentProps<typeof FollowLists>,
    "approveAction" | "removeAction" | "cancelAction" | "blockAction" | "unblockAction" | "followAction"
  >;
  /** The account's gift profile. Without it, the Gift profile card is left out. */
  giftProfile?: GiftProfile;
  giftProfileAction?: SaveGiftProfile;
  /** Whether birthday reminder emails are on. Without it, the switch is left out. */
  birthdayEmails?: boolean;
  birthdayEmailsAction?: React.ComponentProps<typeof BirthdayEmailsSetting>["action"];
  /** Stand-ins for the account API in the Delete account card. The demo passes them. */
  deleteAccountActions?: React.ComponentProps<typeof DeleteAccountCard>;
  /** Put in front of every link. The demo passes "/demo". */
  basePath?: string;
}) {
  const router = useRouter();
  const [savedName, setSavedName] = useState(profile.full_name);
  const [photoUrl, setPhotoUrl] = useState(profile.avatar_url ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [discoverable, setDiscoverable] = useState(Boolean(profile.discoverable));
  const [findableByEmail, setFindableByEmail] = useState(Boolean(profile.findable_by_email));
  const [emailRequests, setEmailRequests] = useState(profile.email_follow_requests ?? true);
  // Follow requests waiting and people blocked, as they change on the page.
  const [followCounts, setFollowCounts] = useState({
    requests: follows?.requests.length ?? 0,
    blocked: follows?.blocked?.length ?? 0,
  });
  const onFollowCountsChange = useCallback((counts: { requests: number; blocked: number }) => {
    setFollowCounts((old) => (old.requests === counts.requests && old.blocked === counts.blocked ? old : counts));
  }, []);

  // The link has the name in it, so it follows the saved name.
  const link = `${basePath}${profilePath({ public_id: profile.public_id, full_name: savedName })}`;

  // The photo saves as soon as it's uploaded or removed, apart from the form
  // below, so there's no second step to forget.
  const savePhoto = async (url: string | null) => {
    const result = await photoAction(url);
    if (result?.error) {
      setPhotoError(result.error);
      return;
    }
    setPhotoError(null);
    setPhotoUrl(url);
    // The menu at the top of the page shows it too.
    router.refresh();
  };

  const handleSave = async (formData: FormData) => {
    setSaving(true);
    setError("");
    setSaved(false);
    const result = await saveAction(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setSavedName(((formData.get("fullName") as string) || "").trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  // The page's sections, in order. Their ids are on the cards below, and
  // links from elsewhere use them, like /dashboard/account#follow-requests.
  const sections: PageSection[] = [
    { id: "profile", label: "Your profile" },
    ...(giftProfile ? [{ id: "gift-profile", label: "Gift profile" }] : []),
    ...(follows
      ? [
          { id: "follow-requests", label: "Follow requests", waiting: followCounts.requests },
          { id: "followers", label: "Followers" },
          { id: "following", label: "Following" },
          ...(followCounts.blocked > 0 ? [{ id: "blocked", label: "Blocked" }] : []),
        ]
      : []),
    ...(birthdayEmails !== undefined ? [{ id: "birthday-emails", label: "Birthday emails" }] : []),
    { id: "profile-registries", label: "Registries on your profile" },
    { id: "delete-account", label: "Delete account" },
  ];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${basePath}/dashboard`} aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Account</h1>
      </div>

      <div className={SECTION_NAV_GRID}>
        <SectionNav sections={sections} label="Account sections" aliases={RENAMED_SECTIONS} />

        <div className="space-y-6">
          <Card id="profile" className={SECTION_SCROLL_MARGIN}>
            <CardHeader>
              <SectionTitle sectionId="profile">Your profile</SectionTitle>
              <CardDescription>
                Anyone with your profile link sees your name and public note.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex items-center gap-4">
                <ProfileAvatar
                  name={displayName({ full_name: savedName })}
                  photoUrl={photoUrl}
                  className="size-20"
                  fallbackClassName="text-2xl"
                />
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium text-secondary">Profile photo</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <PhotoUploadButton
                      label={photoUrl ? "Change photo" : "Upload photo"}
                      upload={uploadPhoto ?? ((file) => uploadProfilePhoto(profile.public_id, file))}
                      onUploaded={savePhoto}
                      onError={setPhotoError}
                    />
                    {photoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10"
                        disabled={removingPhoto}
                        onClick={async () => {
                          setRemovingPhoto(true);
                          await savePhoto(null);
                          setRemovingPhoto(false);
                        }}
                      >
                        {removingPhoto ? "Removing..." : "Remove"}
                      </Button>
                    )}
                  </div>
                  {photoError && <p className="text-xs text-error-primary">{photoError}</p>}
                </div>
              </div>

              {/* onSubmit, not action: React resets a form after its action runs, which
                  would put the checkboxes back. */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <Input
                  label="Name"
                  name="fullName"
                  autoComplete="name"
                  defaultValue={profile.full_name ?? ""}
                  isRequired
                />
                <TextArea
                  label="Public note"
                  name="publicNote"
                  defaultValue={profile.public_note ?? ""}
                  hint="Anyone who opens your profile sees this."
                  placeholder="Anything you'd like everyone to know"
                  maxLength={MAX_PUBLIC_NOTE_LENGTH}
                  rows={3}
                />
                <input type="hidden" name="discoverable" value={discoverable ? "true" : "false"} />
                <Checkbox
                  isSelected={discoverable}
                  onChange={setDiscoverable}
                  label="Show me in people search"
                />
                <input type="hidden" name="findableByEmail" value={findableByEmail ? "true" : "false"} />
                <Checkbox
                  isSelected={findableByEmail}
                  onChange={setFindableByEmail}
                  label="Let people find me by my email address"
                  hint="Only by your whole address. Your email is never shown."
                />
                <input type="hidden" name="emailFollowRequests" value={emailRequests ? "true" : "false"} />
                <Checkbox
                  isSelected={emailRequests}
                  onChange={setEmailRequests}
                  label="Email me when someone asks to follow me"
                />
                {error && <p className="text-sm text-error-primary">{error}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  {saved && (
                    <span className="inline-flex items-center gap-1 text-sm text-tertiary">
                      <Check className="h-4 w-4" />
                      Saved
                    </span>
                  )}
                </div>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-secondary pt-4">
                <CopyLinkButton path={link} />
                <Button variant="outline" asChild>
                  <Link href={link}>View profile</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {giftProfile && (
            <Card id="gift-profile" className={SECTION_SCROLL_MARGIN}>
              <CardHeader>
                <SectionTitle sectionId="gift-profile">Gift profile</SectionTitle>
                <CardDescription>Only you and your friends see this.</CardDescription>
              </CardHeader>
              <CardContent>
                <GiftProfileForm initial={giftProfile} onSave={giftProfileAction} />
              </CardContent>
            </Card>
          )}

          {/* Follow requests, followers, following and blocked, each its own
              section. #follows is what links used before the sections had
              their own ids, and emails already sent still use it. */}
          {follows && (
            <div id="follows" className={cx("space-y-6", SECTION_SCROLL_MARGIN)}>
              <FollowLists
                requests={follows.requests}
                followers={follows.followers}
                following={follows.following}
                blocked={follows.blocked}
                basePath={basePath}
                onCountsChange={onFollowCountsChange}
                {...followActions}
              />
            </div>
          )}

          {birthdayEmails !== undefined && (
            <Card id="birthday-emails" className={SECTION_SCROLL_MARGIN}>
              <CardHeader>
                <SectionTitle sectionId="birthday-emails">Birthday emails</SectionTitle>
              </CardHeader>
              <CardContent>
                <BirthdayEmailsSetting initial={birthdayEmails} action={birthdayEmailsAction} />
              </CardContent>
            </Card>
          )}

          <Card id="profile-registries" className={SECTION_SCROLL_MARGIN}>
            <CardHeader>
              <SectionTitle sectionId="profile-registries">Registries on your profile</SectionTitle>
              <CardDescription>
                Choose who sees each one on your profile. Friends are people you follow who follow you back.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {registries.length === 0 ? (
                <p className="text-sm text-tertiary">You don&apos;t own any registries yet.</p>
              ) : (
                <div className="space-y-4">
                  {registries.map((registry) => (
                    <RegistryListingRow key={registry.id} registry={registry} action={listAction} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <DeleteAccountCard {...deleteAccountActions} />
        </div>
      </div>
    </div>
  );
}
