// "Your profile" and "Registries on your profile": the website's Account page
// (src/components/account-settings.tsx), with the same server actions.

import { Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, View } from "react-native";

import { LIST_ACCESS, listVisibility } from "@shared/list-access";
import type { AccountRegistry } from "@shared/people-page-types";
import { profilePath } from "@shared/profile-link";
import { occasionLabel } from "@shared/registry-copy";

import { Button, Card, ErrorState, Field, haptic, LoadingState, SwitchRow, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { profileForm, useAccountPage, useRunPeopleAction } from "@/lib/people-data";
import { SITE_URL } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";

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
            Only the ones you check appear. Anyone with your link sees the public ones; private ones only show to followers
            you approve. Registries you help manage for someone else aren&apos;t included.
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
  profile: { public_id: string; full_name: string | null; discoverable: boolean; findable_by_email: boolean; email_follow_requests: boolean };
}) {
  const { run, isPending } = useRunPeopleAction();
  const [name, setName] = useState(profile.full_name ?? "");
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
    try {
      await run(
        "profile.saveProfile",
        profileForm({ fullName: name, discoverable, findableByEmail: findable, emailFollowRequests: emails })
      );
      haptic("success");
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Card>
      <Text variant="title" style={{ fontSize: 20 }}>
        Your profile
      </Text>
      <Text variant="footnote" tone="secondary">
        One link to all the registries you choose below. Anyone with the link can see your name and those registries.
      </Text>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        hint="Shown on your profile, and to people you ask to follow"
        autoCapitalize="words"
        textContentType="name"
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
      <Button title={saved ? "Saved!" : "Save"} size="medium" loading={isPending} onPress={save} />
      <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
        <Button title="Share link" icon="share" size="small" variant="secondary" onPress={() => Share.share({ message: link })} />
        <Button title="View profile" icon="external" size="small" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(link)} />
      </View>
    </Card>
  );
}

function ListingRow({ registry }: { registry: AccountRegistry }) {
  const { run } = useRunPeopleAction();
  const [listed, setListed] = useState(registry.listed_on_profile);
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

  let hint =
    visibility === "public"
      ? `${occasionLabel(registry.registry_type, registry.event_type)} · ${LIST_ACCESS.public.short}: anyone who opens your profile sees it`
      : `${LIST_ACCESS.link.short}: only followers you approve see it`;
  if (listed && registry.has_shipping_address) hint += ". Anyone who reserves a gift can see your shipping address.";

  return (
    <SwitchRow
      label={registry.title}
      description={hint}
      value={listed}
      onValueChange={async (next) => {
        setListed(next);
        try {
          await run("profile.setRegistryListed", registry.id, next);
        } catch (e) {
          setListed(!next);
          Alert.alert("That didn't save", errorMessage(e));
        }
      }}
    />
  );
}
