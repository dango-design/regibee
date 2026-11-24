"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Copy, Check, X, Users, Mail, LinkIcon, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/base/input/input";
import { SelectField } from "@/components/base/select/select-field";
import { TextArea } from "@/components/base/textarea/textarea";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import {
  updateRegistry,
  updateRegistryPhoto,
  deleteRegistry,
  updatePaymentMethods,
  updateShippingAddress,
  updateZipCode,
  inviteManagerByEmail,
  generateInviteLink,
  replaceRegistryLink,
  removeManager,
  revokeInvite,
  listManagers,
  listInvites,
} from "@/lib/actions/registry";
import { CategoryManager } from "@/components/category-manager";
import { ProfileListingField } from "@/components/profile-listing-field";
import { ListAccessField } from "@/components/list-access-field";
import {
  DEFAULT_LIST_VISIBILITY,
  listVisibility,
  parseListVisibility,
  profileAudience,
  profileAudienceColumns,
  visibilityColumns,
  type ListVisibility,
  type ProfileAudience,
} from "@/lib/list-access";
import { ShareLinkField } from "@/components/share-link-field";
import { StoreRegistriesCard } from "@/components/store-registries-card";
import { parseRetailerRegistries } from "@/lib/retailers";
import type { PaymentMethods, PersonalEventType, RegistryType } from "@/lib/types";
import { copyFor } from "@/lib/registry-copy";
import { PhotoUploadButton } from "@/components/photo-upload-button";
import { RegistryAvatar, monogramFor } from "@/components/registry-avatar";
import { uploadRegistryPhoto } from "@/lib/upload-registry-photo";
import { ReservationPrivacyCard } from "@/components/reservation-privacy-card";
import { RegistryGroupsCard } from "@/components/registry-groups-card";
import { readReservationPrivacy } from "@/lib/gifts";
import { GiftProfileForm } from "@/components/gift-profile-form";
import { saveListGiftProfile } from "@/lib/actions/gift-profile";
import { parseGiftProfile } from "@/lib/gift-profile";
import type { RegistrySettingsSection } from "@/lib/registry-settings-sections";
import {
  SECTION_NAV_GRID,
  SECTION_SCROLL_MARGIN,
  SectionNav,
  SectionTitle,
  type PageSection,
} from "@/components/section-nav";
import { cx } from "@/lib/utils/cx";

interface Manager {
  id: string;
  userId: string;
  role: string;
  name: string;
  email: string;
  createdAt: string;
}

interface Invite {
  id: string;
  email: string | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string;
  created_at: string;
}

export default function RegistrySettingsPage() {
  const router = useRouter();
  const params = useParams();
  const registryId = params.registryId as string;

  const [registry, setRegistry] = useState<{
    title: string;
    parent_names: string | null;
    honoree_names: string | null;
    event_date: string | null;
    description: string | null;
    photo_url: string | null;
    is_public: boolean;
    is_private: boolean;
    listed_on_profile: boolean;
    profile_audience: string | null;
    slug: string;
    owner_id: string;
    registry_type: RegistryType;
    event_type: PersonalEventType | null;
    settings: {
      payment_methods?: PaymentMethods;
      shipping_address?: string;
      zip_code?: string;
      tax_enabled?: boolean;
      for_child?: boolean;
      gift_profile?: unknown;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingZip, setSavingZip] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [zipError, setZipError] = useState("");
  const [zipSuccess, setZipSuccess] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressSuccess, setAddressSuccess] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; sort_order: number }[]>([]);
  // Guests (anonymous sessions) have no profile page to list a registry on.
  const [hasProfile, setHasProfile] = useState(false);
  const [visibilityChoice, setVisibilityChoice] = useState<ListVisibility>(DEFAULT_LIST_VISIBILITY);
  const [audienceChoice, setAudienceChoice] = useState<ProfileAudience>("hidden");

  // Manager state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitingEmail, setInvitingEmail] = useState(false);
  const [inviteEmailError, setInviteEmailError] = useState("");
  const [inviteEmailSuccess, setInviteEmailSuccess] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [maxUses, setMaxUses] = useState<string>("1");

  const isOwner = currentUserId !== null && registry?.owner_id === currentUserId;

  const fetchManagerData = useCallback(async () => {
    const [managersResult, invitesResult] = await Promise.all([
      listManagers(registryId),
      listInvites(registryId),
    ]);
    setManagers(managersResult.managers);
    setInvites(invitesResult.invites);
  }, [registryId]);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [{ data }, { data: cats }, { data: { user } }] = await Promise.all([
        supabase
          .from("registries")
          .select("title, parent_names, honoree_names, event_date, description, photo_url, is_public, is_private, listed_on_profile, profile_audience, slug, owner_id, registry_type, event_type, settings")
          .eq("id", registryId)
          .single(),
        supabase
          .from("categories")
          .select("id, name, sort_order")
          .eq("registry_id", registryId)
          .order("sort_order"),
        supabase.auth.getUser(),
      ]);
      setRegistry(data);
      setVisibilityChoice(data ? listVisibility(data) : DEFAULT_LIST_VISIBILITY);
      setAudienceChoice(data ? profileAudience(data) : "hidden");
      setCategories(cats || []);
      setCurrentUserId(user?.id || null);
      setHasProfile(Boolean(user && !user.is_anonymous));
      setLoading(false);
    };
    fetchData();
    fetchManagerData();
  }, [registryId, fetchManagerData]);

  const handleSave = async (formData: FormData) => {
    setSaving(true);
    setError("");
    setSuccess(false);
    const result = await updateRegistry(registryId, formData);
    if (result?.error) {
      setError(result.error);
    } else if (registry) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      const honoreeNames =
        (formData.get("honoreeNames") as string) ||
        (formData.get("parentNames") as string) ||
        "";
      const savedVisibility = parseListVisibility(formData.get("visibility")) ?? listVisibility(registry);
      setRegistry({
        ...registry,
        title: formData.get("title") as string,
        parent_names: honoreeNames || null,
        honoree_names: honoreeNames || null,
        event_date: (formData.get("eventDate") as string) || null,
        description: (formData.get("description") as string) || null,
        ...visibilityColumns(savedVisibility),
        // Making a list private takes it off its owner's profile. Only the
        // owner chooses who sees it there.
        ...(savedVisibility === "private"
          ? { listed_on_profile: false }
          : isOwner
            ? profileAudienceColumns(audienceChoice, savedVisibility)
            : {}),
      });
    }
    setSaving(false);
  };

  // The photo saves as soon as it's uploaded or removed, apart from the form
  // below, so there's no second step to forget.
  const savePhoto = async (photoUrl: string | null) => {
    const result = await updateRegistryPhoto(registryId, photoUrl);
    if (result.error) {
      setPhotoError(result.error);
      return;
    }
    setPhotoError(null);
    setRegistry((current) => (current ? { ...current, photo_url: photoUrl } : current));
  };

  const handleSavePayment = async (formData: FormData) => {
    setSavingPayment(true);
    setPaymentError("");
    setPaymentSuccess(false);
    const result = await updatePaymentMethods(registryId, formData);
    if (result?.error) {
      setPaymentError(result.error);
    } else if (registry) {
      setPaymentSuccess(true);
      setTimeout(() => setPaymentSuccess(false), 2000);
      setRegistry({
        ...registry,
        settings: {
          ...registry.settings,
          payment_methods: {
            venmo: (formData.get("venmo") as string)?.trim() || undefined,
            paypal: (formData.get("paypal") as string)?.trim() || undefined,
            zelle: (formData.get("zelle") as string)?.trim() || undefined,
          },
        },
      });
    }
    setSavingPayment(false);
  };

  const handleSaveZip = async (formData: FormData) => {
    setSavingZip(true);
    setZipError("");
    setZipSuccess(false);
    const result = await updateZipCode(registryId, formData);
    if (result?.error) {
      setZipError(result.error);
    } else if (registry) {
      setZipSuccess(true);
      setTimeout(() => setZipSuccess(false), 2000);
      setRegistry({
        ...registry,
        settings: {
          ...registry.settings,
          zip_code: (formData.get("zipCode") as string)?.trim() || undefined,
          tax_enabled: formData.get("taxEnabled") === "true",
        },
      });
    }
    setSavingZip(false);
  };

  const handleSaveAddress = async (formData: FormData) => {
    setSavingAddress(true);
    setAddressError("");
    setAddressSuccess(false);
    const address = formData.get("shippingAddress") as string;
    const result = await updateShippingAddress(registryId, address);
    if (result?.error) {
      setAddressError(result.error);
    } else if (registry) {
      setAddressSuccess(true);
      setTimeout(() => setAddressSuccess(false), 2000);
      setRegistry({
        ...registry,
        settings: {
          ...registry.settings,
          shipping_address: address.trim() || undefined,
        },
      });
    }
    setSavingAddress(false);
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this registry? This action cannot be undone."
      )
    )
      return;
    await deleteRegistry(registryId);
  };

  const handleInviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInvitingEmail(true);
    setInviteEmailError("");
    setInviteEmailSuccess(false);
    const result = await inviteManagerByEmail(registryId, inviteEmail.trim());
    if (result.error) {
      setInviteEmailError(result.error);
    } else {
      setInviteEmailSuccess(true);
      setInviteEmail("");
      setTimeout(() => setInviteEmailSuccess(false), 3000);
      fetchManagerData();
    }
    setInvitingEmail(false);
  };

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    setGeneratedLink("");
    const uses = maxUses === "unlimited" ? null : parseInt(maxUses);
    const result = await generateInviteLink(registryId, uses);
    if (result.error) {
      setInviteEmailError(result.error);
    } else if (result.token) {
      const url = `${window.location.origin}/invite/${result.token}`;
      setGeneratedLink(url);
      fetchManagerData();
    }
    setGeneratingLink(false);
  };

  const handleRemoveManager = async (managerId: string) => {
    if (!confirm("Remove this manager? They will lose access to the registry.")) return;
    const result = await removeManager(registryId, managerId);
    if (result.error) {
      alert(result.error);
    } else {
      fetchManagerData();
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Revoke this invite? The link will stop working.")) return;
    const result = await revokeInvite(inviteId, registryId);
    if (result.error) {
      alert(result.error);
    } else {
      fetchManagerData();
    }
  };

  if (loading || !registry) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl">
        <p className="text-tertiary">Loading...</p>
      </div>
    );
  }

  const pm = registry.settings?.payment_methods;

  // Cards that show only for some lists and people.
  const signedIn = currentUserId !== null;
  // A list kept for a child has its own gift profile. Other lists show their
  // owner's, from the Account page.
  const showGiftProfile =
    signedIn && hasProfile && registry.registry_type === "personal" && registry.settings?.for_child === true;
  const childName = registry.honoree_names?.trim() || "your child";
  // Private lists can't be shared with groups.
  const showGroups = signedIn && isOwner && hasProfile && !registry.is_private;

  // The page's sections, in order, for its navigation. Their ids are on the
  // cards below, and other pages link to them (src/lib/registry-settings-sections.ts).
  const sections: (PageSection & { id: RegistrySettingsSection })[] = [
    { id: "general", label: "General" },
    { id: "sharing", label: "Sharing" },
    ...(signedIn ? [{ id: "reservations" as const, label: "What's been reserved" }] : []),
    ...(showGiftProfile ? [{ id: "gift-profile" as const, label: `About ${childName}` }] : []),
    ...(showGroups ? [{ id: "groups" as const, label: "Share with a group" }] : []),
    { id: "categories", label: "Categories" },
    { id: "location", label: "Location" },
    { id: "payment-methods", label: "Payment methods" },
    { id: "shipping-address", label: "Shipping address" },
    ...(registry.registry_type === "baby" ? [{ id: "store-registries" as const, label: "Your store registries" }] : []),
    { id: "managers", label: "Managers" },
    ...(isOwner ? [{ id: "delete-registry" as const, label: "Delete registry" }] : []),
  ];

  // Laid out like the Account page: the sections in a column on the left from
  // lg, and a row of links under the top bar below that.
  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/registry/${registryId}`} aria-label="Back to registry">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Registry Settings</h1>
      </div>

      <div className={SECTION_NAV_GRID}>
        <SectionNav sections={sections} label="Registry settings sections" />
        <div className="space-y-6">
          <Card id="general" className={SECTION_SCROLL_MARGIN}>
            <CardHeader>
              <SectionTitle sectionId="general">General</SectionTitle>
              <CardDescription>Update your registry details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex items-center gap-4">
                {registry.photo_url || monogramFor(registry.honoree_names || registry.parent_names) ? (
                  <RegistryAvatar
                    photoUrl={registry.photo_url}
                    names={registry.honoree_names || registry.parent_names}
                    className="size-20 text-2xl ring-0 shadow-none"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-20 shrink-0 items-center justify-center rounded-full border border-dashed border-primary text-tertiary"
                  >
                    <ImageIcon className="h-6 w-6" />
                  </span>
                )}
                <div className="min-w-0 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-secondary">Registry photo</p>
                    <p className="text-xs text-tertiary">
                      Shown at the top of your registry page. Without one, guests see your initials.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PhotoUploadButton
                      label={registry.photo_url ? "Change photo" : "Upload photo"}
                      upload={(file) => uploadRegistryPhoto(registryId, file)}
                      onUploaded={savePhoto}
                      onError={setPhotoError}
                    />
                    {registry.photo_url && (
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
                  would put the listing checkbox back to its old value and unlist the
                  registry on the next save. */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <Input
                  label="Title"
                  name="title"
                  defaultValue={registry.title}
                  isRequired
                />

                <Input
                  label={copyFor({ registryType: registry.registry_type, eventType: registry.event_type }).honoreeLabel}
                  name="honoreeNames"
                  placeholder={copyFor({ registryType: registry.registry_type, eventType: registry.event_type }).honoreePlaceholder}
                  defaultValue={registry.honoree_names || registry.parent_names || ""}
                  hint="The name shown to gift givers and in email notifications."
                />

                <Input
                  label={copyFor({ registryType: registry.registry_type, eventType: registry.event_type }).eventDateLabel}
                  name="eventDate"
                  type="date"
                  defaultValue={registry.event_date || ""}
                />

                <TextArea
                  label="Welcome Message"
                  name="description"
                  defaultValue={registry.description || ""}
                  rows={3}
                />

                <div id="sharing" className={cx("space-y-4 border-t border-secondary pt-4", SECTION_SCROLL_MARGIN)}>
                  <SectionTitle sectionId="sharing" className="font-sans text-md font-semibold tracking-normal text-primary">
                    Sharing
                  </SectionTitle>

                  <ListAccessField visibility={visibilityChoice} onChange={setVisibilityChoice} />

                  {visibilityChoice === "private" && listVisibility(registry) !== "private" && (
                    <p role="status" className="rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-800">
                      When you save, people you&apos;ve sent the link to won&apos;t be able to open it, and it&apos;ll
                      come off any event or group you&apos;ve shared it with.
                    </p>
                  )}

                  {isOwner && hasProfile && (
                    <ProfileListingField
                      visibility={visibilityChoice}
                      audience={audienceChoice}
                      onChange={setAudienceChoice}
                      hasShippingAddress={Boolean(registry.settings?.shipping_address)}
                    />
                  )}

                  {visibilityChoice !== "private" && (
                    <ShareLinkField
                      path={`/r/${registry.slug}`}
                      onReplace={async () => {
                        const result = await replaceRegistryLink(registryId);
                        if ("error" in result) return result;
                        setRegistry((current) => (current ? { ...current, slug: result.slug } : current));
                        return { path: `/r/${result.slug}` };
                      }}
                    />
                  )}
                </div>

                {error && <p className="text-sm text-error-primary">{error}</p>}

                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : success ? "Saved!" : "Save changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {signedIn && (
            <>
              <ReservationPrivacyCard
                registryId={registryId}
                isOwner={isOwner}
                isPersonal={registry.registry_type === "personal"}
                privacy={readReservationPrivacy(registry.settings)}
                onSaved={({ forChild }) =>
                  setRegistry((current) =>
                    current ? { ...current, settings: { ...current.settings, for_child: forChild } } : current,
                  )
                }
              />
              {showGiftProfile && (
                <Card id="gift-profile" className={SECTION_SCROLL_MARGIN}>
                  <CardHeader>
                    <SectionTitle sectionId="gift-profile">About {childName}</SectionTitle>
                    <CardDescription>
                      Help people pick gifts. Sizes, likes and the rest show on this list, so anyone with its
                      link sees them.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GiftProfileForm
                      initial={parseGiftProfile(registry.settings.gift_profile)}
                      onSave={(profile) => saveListGiftProfile(registryId, profile)}
                      child={{ name: registry.honoree_names }}
                    />
                  </CardContent>
                </Card>
              )}
              {showGroups && <RegistryGroupsCard registryId={registryId} />}
            </>
          )}

          <Card id="categories" className={SECTION_SCROLL_MARGIN}>
            <CardHeader>
              <SectionTitle sectionId="categories">Categories</SectionTitle>
              <CardDescription>Organize your registry items into categories</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryManager registryId={registryId} categories={categories} inline />
            </CardContent>
          </Card>

          <Card id="location" className={SECTION_SCROLL_MARGIN}>
            <CardHeader>
              <SectionTitle sectionId="location">Location</SectionTitle>
              <CardDescription>
                Used to estimate sales tax on item prices when auto-filling from product URLs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={handleSaveZip} className="space-y-4">
                <Input
                  label="Zip Code"
                  name="zipCode"
                  placeholder="e.g., 90210"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  defaultValue={registry.settings?.zip_code || ""}
                />

                <Checkbox
                  name="taxEnabled"
                  value="true"
                  defaultSelected={registry.settings?.tax_enabled !== false}
                  label="Auto-add estimated sales tax to prices"
                />

                {zipError && (
                  <p className="text-sm text-error-primary">{zipError}</p>
                )}

                <Button type="submit" disabled={savingZip}>
                  {savingZip
                    ? "Saving..."
                    : zipSuccess
                      ? "Saved!"
                      : "Save location"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card id="payment-methods" className={SECTION_SCROLL_MARGIN}>
            <CardHeader>
              <SectionTitle sectionId="payment-methods">Payment methods</SectionTitle>
              <CardDescription>
                Add your payment info so gift givers can send you money for cash
                funds and items you&apos;ve already purchased.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={handleSavePayment} className="space-y-4">
                <Input
                  label="Venmo"
                  name="venmo"
                  placeholder="@your-venmo"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  defaultValue={pm?.venmo || ""}
                />

                <Input
                  label="PayPal"
                  name="paypal"
                  placeholder="you@email.com or PayPal.me link"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  defaultValue={pm?.paypal || ""}
                />

                <Input
                  label="Zelle"
                  name="zelle"
                  placeholder="you@email.com or phone number"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  defaultValue={pm?.zelle || ""}
                />

                {paymentError && (
                  <p className="text-sm text-error-primary">{paymentError}</p>
                )}

                <Button type="submit" disabled={savingPayment}>
                  {savingPayment
                    ? "Saving..."
                    : paymentSuccess
                      ? "Saved!"
                      : "Save payment methods"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card id="shipping-address" className={SECTION_SCROLL_MARGIN}>
            <CardHeader>
              <SectionTitle sectionId="shipping-address">Shipping address</SectionTitle>
              <CardDescription>
                Share your shipping address with gift givers so they know where to send gifts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={handleSaveAddress} className="space-y-4">
                <TextArea
                  label="Address"
                  name="shippingAddress"
                  placeholder={"Remi & Max Porter\n123 Main Street, Apt 4B\nNew York, NY 10001"}
                  defaultValue={registry.settings?.shipping_address || ""}
                  rows={3}
                />

                {addressError && (
                  <p className="text-sm text-error-primary">{addressError}</p>
                )}

                <Button type="submit" disabled={savingAddress}>
                  {savingAddress
                    ? "Saving..."
                    : addressSuccess
                      ? "Saved!"
                      : "Save address"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* The add-item dialog links to it when a pasted link is from a store
              the owner hasn't linked yet. */}
          {registry.registry_type === "baby" && (
            <StoreRegistriesCard registryId={registryId} initialRegistries={parseRetailerRegistries(registry.settings)} />
          )}

          <Card id="managers" className={SECTION_SCROLL_MARGIN}>
            <CardHeader>
              <SectionTitle
                sectionId="managers"
                className="flex items-center gap-2 font-sans leading-none font-semibold tracking-normal"
              >
                <Users className="h-5 w-5" />
                Managers
              </SectionTitle>
              <CardDescription>
                Invite others to help manage this registry. Managers can add/edit items, view gift activity, and manage categories.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current managers list */}
              <div className="space-y-2">
                {/* h3s, under the card's h2. */}
                <h3 className="text-sm font-medium text-secondary">Current managers</h3>
                <div className="space-y-2">
                  {managers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          <p className="text-xs text-tertiary truncate">{m.email}</p>
                        </div>
                        <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                          {m.role === "owner" ? "Owner" : "Manager"}
                        </Badge>
                      </div>
                      {isOwner && m.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveManager(m.id)}
                          aria-label={`Remove ${m.name}`}
                          className="text-error-primary hover:text-error-primary shrink-0 max-sm:min-w-11"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Invite by email */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-secondary">
                  <Mail className="h-4 w-4" />
                  Invite by email
                </h3>
                <form onSubmit={handleInviteByEmail} className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="coparent@example.com"
                      value={inviteEmail}
                      onChange={(val) => setInviteEmail(val)}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={invitingEmail || !inviteEmail.trim()}
                    className="shrink-0"
                  >
                    {invitingEmail ? "Sending..." : inviteEmailSuccess ? "Sent!" : "Send Invite"}
                  </Button>
                </form>
                {inviteEmailError && (
                  <p className="text-sm text-error-primary">{inviteEmailError}</p>
                )}
              </div>

              <Separator />

              {/* Generate invite link */}
              <div className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-secondary">
                  <LinkIcon className="h-4 w-4" />
                  Generate invite link
                </h3>
                <div className="flex gap-2 items-end">
                  <SelectField
                    label="Max uses"
                    value={maxUses}
                    onChange={setMaxUses}
                    options={[
                      { value: "1", label: "1 use" },
                      { value: "5", label: "5 uses" },
                      { value: "10", label: "10 uses" },
                      { value: "unlimited", label: "Unlimited" },
                    ]}
                    className="w-36"
                  />
                  <Button
                    onClick={handleGenerateLink}
                    disabled={generatingLink}
                    variant="outline"
                    className="shrink-0"
                  >
                    {generatingLink ? "Generating..." : "Generate"}
                  </Button>
                </div>
                {generatedLink && (
                  <div className="flex items-center gap-2 mt-2 rounded-md border px-3 py-2 bg-muted/50">
                    <code className="text-xs break-all flex-1">{generatedLink}</code>
                    <button
                      type="button"
                      aria-label="Copy invite link"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLink);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="text-tertiary hover:text-secondary transition-colors shrink-0 max-sm:-my-3 max-sm:inline-flex max-sm:min-h-11 max-sm:min-w-11 max-sm:items-center max-sm:justify-center"
                    >
                      {linkCopied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Active invites */}
              {invites.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-secondary">Active invites</h3>
                    <div className="space-y-2">
                      {invites.map((inv) => {
                        const expired = new Date(inv.expires_at) < new Date();
                        const fullyUsed = inv.max_uses !== null && inv.use_count >= inv.max_uses;
                        return (
                          <div
                            key={inv.id}
                            className={`flex items-center justify-between rounded-md border px-3 py-2 ${expired || fullyUsed ? "opacity-50" : ""}`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm truncate">
                                {inv.email ? inv.email : "Link invite"}
                              </p>
                              <p className="text-xs text-tertiary">
                                {inv.use_count}{inv.max_uses !== null ? `/${inv.max_uses}` : ""} uses
                                {expired && " · Expired"}
                                {fullyUsed && !expired && " · Fully used"}
                                {!expired && !fullyUsed && ` · Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                              </p>
                            </div>
                            {isOwner && !expired && !fullyUsed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeInvite(inv.id)}
                                className="text-error-primary hover:text-error-primary shrink-0"
                              >
                                Revoke
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Only owners can delete a registry. */}
          {isOwner && (
            <Card id="delete-registry" className={cx("border-error-primary/50", SECTION_SCROLL_MARGIN)}>
              <CardHeader>
                <SectionTitle
                  sectionId="delete-registry"
                  className="font-sans leading-none font-semibold tracking-normal text-error-primary"
                >
                  Delete registry
                </SectionTitle>
                <CardDescription>
                  Permanently delete this registry and all its items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={handleDelete}>
                  Delete registry
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
