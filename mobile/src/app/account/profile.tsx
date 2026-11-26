// "Your profile" and "Registries on your profile": the website's Account page
// (src/components/account-settings.tsx), with the same server actions.

import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, View } from "react-native";

import { MAX_PUBLIC_NOTE_LENGTH } from "@shared/gift-profile";
import { LIST_ACCESS, listVisibility, profileAudience, type ProfileAudience } from "@shared/list-access";
import type { AccountRegistry } from "@shared/people-page-types";
import { displayName, profilePath } from "@shared/profile-link";
import { occasionLabel } from "@shared/registry-copy";

import { Icon } from "@/components/icon";
import { ProfileAudienceChips } from "@/components/profile-audience-chips";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Button, Card, ErrorState, Field, haptic, LoadingState, SwitchRow, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { profileForm, useAccountPage, useRunPeopleAction } from "@/lib/people-data";
import { pickPhoto, uploadProfilePhoto } from "@/lib/photos";
import { SITE_URL } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";

export default function ProfileScreen() {
  const theme = useTheme();
  const page = useAccountPage();
  const data = page.data;
  if (!data) {
    return page.isError ? <ErrorState message={errorMessage(page.error)} onRetry={() => page.refetch()} /> : <LoadingState />;
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: "Your profile" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
      >
        <ProfileCard profile={data.profile} />
        <Card>
          <Text variant="title" style={{ fontSize: 20 }}>
            Registries on your profile
          </Text>
          <Text variant="footnote" tone="secondary">
            Choose who sees each one on your profile: nobody, your friends, your followers or everyone. Friends are people
            you follow who follow you back. Registries you help manage for someone else aren&apos;t included.
          </Text>
          {data.registries.length === 0 ? (
            <Text variant="footnote" tone="tertiary">
              You don&apos;t own any registries yet.
            </Text>
          ) : (
            <View style={{ marginHorizontal: -spacing.lg }}>
              {data.registries.map((registry) => (
                <ListingRow key={registry.id} registry={registry} />
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ProfileCard({
  profile,
}: {
  profile: {
    public_id: string;
    full_name: string | null;
    // Missing from a website that doesn't send the photo yet.
    avatar_url?: string | null;
    discoverable: boolean;
    findable_by_email: boolean;
    email_follow_requests: boolean;
    // Missing from a website that doesn't have the public note yet.
    public_note?: string | null;
  };
}) {
  const theme = useTheme();
  const { run } = useRunPeopleAction();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(profile.full_name ?? "");
  // The photo saves as soon as it's uploaded or removed, apart from the form
  // below, as on the website.
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [photoBusy, setPhotoBusy] = useState<"uploading" | "removing" | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [note, setNote] = useState(profile.public_note ?? "");
  const [discoverable, setDiscoverable] = useState(profile.discoverable);
  const [findable, setFindable] = useState(profile.findable_by_email);
  const [emails, setEmails] = useState(profile.email_follow_requests);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = `${SITE_URL}${profilePath({ public_id: profile.public_id, full_name: profile.full_name })}`;

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  async function save() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await run(
        "profile.saveProfile",
        profileForm({ fullName: name, publicNote: note, discoverable, findableByEmail: findable, emailFollowRequests: emails })
      );
      haptic("success");
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function changePhoto() {
    setPhotoError(null);
    let asset;
    try {
      asset = await pickPhoto();
    } catch (e) {
      setPhotoError(errorMessage(e));
      return;
    }
    if (!asset) return;
    setPhotoBusy("uploading");
    try {
      const url = await uploadProfilePhoto(profile.public_id, asset);
      // The server checks the photo is in this account's folder, saves it and
      // deletes the photo it replaces.
      await run("profile.setProfilePhoto", url);
      setPhotoUrl(url);
      haptic("success");
    } catch (e) {
      setPhotoError(errorMessage(e));
    } finally {
      setPhotoBusy(null);
    }
  }

  async function removePhoto() {
    setPhotoError(null);
    setPhotoBusy("removing");
    try {
      await run("profile.setProfilePhoto", null);
      setPhotoUrl(null);
    } catch (e) {
      setPhotoError(errorMessage(e));
    } finally {
      setPhotoBusy(null);
    }
  }

  return (
    <Card>
      <Text variant="title" style={{ fontSize: 20 }}>
        Your profile
      </Text>
      <Text variant="footnote" tone="secondary">
        One link to all the registries you choose below. Anyone with the link can see your name, your public note and those registries.
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.lg, alignItems: "center" }}>
        <ProfileAvatar name={displayName({ full_name: profile.full_name })} photoUrl={photoUrl} size={80} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={{ gap: 2 }}>
            <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
              Profile photo
            </Text>
            <Text variant="caption" tone="tertiary">
              Shown on your profile. Without one, people see your initials.
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            <Button
              title={photoUrl ? "Change photo" : "Upload photo"}
              icon="camera"
              size="small"
              variant="secondary"
              loading={photoBusy === "uploading"}
              disabled={photoBusy !== null}
              onPress={changePhoto}
            />
            {photoUrl ? (
              <Button
                title={photoBusy === "removing" ? "Removing..." : "Remove"}
                size="small"
                variant="ghost"
                disabled={photoBusy !== null}
                onPress={removePhoto}
              />
            ) : null}
          </View>
          {photoError ? (
            <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {photoError}
            </Text>
          ) : null}
        </View>
      </View>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        hint="Shown on your profile, and to people you ask to follow"
        autoCapitalize="words"
        textContentType="name"
      />
      <Field
        label="Public note"
        value={note}
        onChangeText={setNote}
        hint="Optional. Anyone who opens your profile sees this, under your name."
        placeholder="Anything you'd like everyone to know"
        maxLength={MAX_PUBLIC_NOTE_LENGTH}
        multiline
      />
      <View style={{ marginHorizontal: -spacing.lg }}>
        <SwitchRow
          label="Show me in people search"
          description="People signed in to Regibee can find you by name."
          value={discoverable}
          onValueChange={setDiscoverable}
        />
        <SwitchRow
          label="Let people find me by my email address"
          description="Only someone who types your whole email address finds you this way. Your email is never shown."
          value={findable}
          onValueChange={setFindable}
        />
        <SwitchRow
          label="Email me when someone asks to follow me"
          description="Includes invites sent to your email address. At most one email per person per day."
          value={emails}
          onValueChange={setEmails}
        />
      </View>
      {error ? (
        <Text variant="footnote" tone="danger">
          {error}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        <Button title="Save" size="medium" loading={saving} onPress={save} style={{ minWidth: 120 }} />
        {saved ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            <Icon name="check" size={14} color={theme.textTertiary} />
            <Text variant="footnote" tone="tertiary">
              Saved
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
        <Button title="Share link" icon="share" size="small" variant="secondary" onPress={() => Share.share({ message: link })} />
        <Button title="View profile" icon="external" size="small" variant="ghost" onPress={() => openSite(link)} />
      </View>
    </Card>
  );
}

function ListingRow({ registry }: { registry: AccountRegistry }) {
  const { run } = useRunPeopleAction();
  const [audience, setAudience] = useState<ProfileAudience>(profileAudience(registry));
  const [saving, setSaving] = useState(false);
  const visibility = listVisibility(registry);

  if (visibility === "private") {
    return (
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 }}>
        <Text variant="callout">{registry.title}</Text>
        <Text variant="footnote" tone="tertiary">
          Private, so it can&apos;t show on your profile
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }}>
      <View style={{ gap: 2 }}>
        <Text variant="callout">{registry.title}</Text>
        <Text variant="footnote" tone="tertiary">
          {occasionLabel(registry.registry_type, registry.event_type)} · {LIST_ACCESS[visibility].short}
        </Text>
      </View>
      <ProfileAudienceChips
        label={null}
        visibility={visibility}
        value={audience}
        disabled={saving}
        hasShippingAddress={registry.has_shipping_address}
        onValueChange={async (next) => {
          if (next === audience) return;
          const before = audience;
          setAudience(next);
          setSaving(true);
          try {
            await run("profile.setRegistryProfileAudience", registry.id, next);
          } catch (e) {
            setAudience(before);
            Alert.alert("That didn't save", errorMessage(e));
          } finally {
            setSaving(false);
          }
        }}
      />
    </View>
  );
}
