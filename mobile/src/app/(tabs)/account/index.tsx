import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import * as Application from "expo-application";
import * as WebBrowser from "expo-web-browser";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { BIRTHDAY_REMINDER_DAYS } from "@shared/gift-profile";

import { ConfirmDelete } from "@/components/confirm-delete";
import { NavRow } from "@/components/nav-row";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Divider, Section, SwitchRow, Text } from "@/components/ui";
import { VersionSection } from "@/components/version-section";
import { useDeleteAccount } from "@/lib/account";
import { errorMessage } from "@/lib/data";
import { useAccountPage, useRunPeopleAction } from "@/lib/people-data";
import { signOut, useSession } from "@/lib/auth";
import { clearCache } from "@/lib/query";
import { SITE_URL, supabase } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";

export default function AccountScreen() {
  const theme = useTheme();
  const { session, demo, endDemo } = useSession();
  const userId = session?.user.id;
  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId) && !demo,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", userId!).single();
      return { fullName: (data?.full_name as string | null)?.trim() || null };
    },
  });
  const name = demo ? "Remi & Max" : (profile.data?.fullName ?? session?.user.email ?? "You");
  // The profile photo, from what the website's Account page loads. Not loaded in the demo.
  const account = useAccountPage();
  const open = (path: string) => WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);
  const deletion = useDeleteAccount();
  const deleteRow = (
    <Row
      icon="trash"
      label={
        deletion.status === "checking"
          ? "Checking your account…"
          : deletion.status === "deleting"
            ? "Deleting account…"
            : "Delete account"
      }
      destructive
      onPress={deletion.start}
    />
  );

  function confirmSignOut() {
    const run = async () => {
      await clearCache();
      await signOut();
    };
    if (Platform.OS === "web") {
      run();
      return;
    }
    Alert.alert("Sign out?", "Your registries stay on Regibee. Sign in again to see them here.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: run },
    ]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
    >
      <View style={styles.profile}>
        <ProfileAvatar name={name} photoUrl={demo ? null : account.data?.profile.avatar_url} size={60} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline" numberOfLines={1}>
            {name}
          </Text>
          {session?.user.email && session.user.email !== name ? (
            <Text variant="subhead" tone="secondary" numberOfLines={1}>
              {session.user.email}
            </Text>
          ) : null}
        </View>
      </View>

      {demo ? null : (
        <AccountSections />
      )}

      <Section title="On regibee.com" footer="These open the website. Sign in there with the same account if it asks.">
        <Row icon="lock" label="Privacy policy" onPress={() => open("/privacy")} />
      </Section>

      {demo ? (
        <Section footer="This is a sample registry. Changes you make here aren't saved.">
          <Row icon="signOut" label="Leave the demo" destructive onPress={endDemo} />
          <Divider inset={52} />
          {deleteRow}
        </Section>
      ) : (
        <Section footer="Delete account deletes your account, your registries and events, and your profile. Registries other people help manage stay with them. This can't be undone.">
          <Row icon="signOut" label="Sign out" destructive onPress={confirmSignOut} />
          <Divider inset={52} />
          {deleteRow}
        </Section>
      )}

      <VersionSection />
      <ConfirmDelete {...deletion.dialog} />

      <Text variant="caption" tone="tertiary" style={{ textAlign: "center" }}>
        Regibee {Application.nativeApplicationVersion ?? ""}
        {Application.nativeBuildVersion ? ` (${Application.nativeBuildVersion})` : ""}
      </Text>
    </ScrollView>
  );
}

/**
 * The website's Account page (src/components/account-settings.tsx), as
 * screens: your profile, gift profile, follows and birthday emails.
 */
function AccountSections() {
  const page = useAccountPage();
  const { run } = useRunPeopleAction();
  const data = page.data;
  const requests = data?.follows.requests.length ?? 0;
  const [birthdayEmails, setBirthdayEmails] = useState<boolean | null>(null);
  const emailsOn = birthdayEmails ?? data?.birthdayEmails ?? true;
  return (
    <>
      <Section>
        <NavRow icon="person1" label="Your profile" detail="Name, search, profile link" onPress={() => router.push("/account/profile")} />
        <Divider inset={52} />
        <NavRow icon="cake" label="Gift profile" detail="Birthday, sizes, likes" onPress={() => router.push("/account/gift-profile")} />
        <Divider inset={52} />
        <NavRow
          icon="people"
          label="Follows"
          detail={requests > 0 ? undefined : "Requests, followers, blocked"}
          badge={requests}
          onPress={() => router.push("/account/follows")}
        />
      </Section>
      <Section
        title="Birthday emails"
        footer={`${BIRTHDAY_REMINDER_DAYS} days before the birthday of someone you follow, if they approved you and added their birthday.`}
      >
        <SwitchRow
          icon="bell"
          label="Email me before birthdays"
          value={emailsOn}
          onValueChange={async (on) => {
            setBirthdayEmails(on);
            try {
              await run("giftProfile.setBirthdayEmails", on);
            } catch (e) {
              setBirthdayEmails(!on);
              Alert.alert("That didn't save", errorMessage(e));
            }
          }}
        />
      </Section>
    </>
  );
}

function Row({ icon, label, onPress, destructive }: { icon: IconName; label: string; onPress: () => void; destructive?: boolean }) {
  const theme = useTheme();
  const color = destructive ? theme.danger : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceAlt : "transparent" }]}
    >
      <Icon name={icon} size={20} color={destructive ? theme.danger : theme.tint} />
      <Text variant="callout" style={{ flex: 1, color }}>
        {label}
      </Text>
      {!destructive ? <Icon name="external" size={15} color={theme.textTertiary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
});
