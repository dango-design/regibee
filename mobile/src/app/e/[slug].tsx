// An event's invitation, as a guest sees it: the website's /e/<slug> page
// (src/app/e/[slug]/page.tsx), from the same loader (loadInvitationPage in
// src/lib/invitation-page.ts), as a phone screen. `g` is the guest's own
// RSVP token from their link.
//
// It sits in the root stack, at the website's own path, so back returns to
// whatever opened it. nativeRoute in src/lib/web.ts sends /e/<slug> here.
// Signed out, it hands the page to the web view itself, since the app's
// server routes need a signed-in account.

import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, Share, View } from "react-native";

import { Icon } from "@/components/icon";
import { useInvitationColors } from "@/components/invitation/colors";
import { InvitationDetails, InvitationHero } from "@/components/invitation/details";
import { RsvpForm } from "@/components/invitation/rsvp-form";
import {
  ExchangeSection,
  GiftsSection,
  GroupGiftsSection,
  SecretSantaCard,
  SignupSection,
  WishListsSection,
} from "@/components/invitation/sections";
import { Button, EmptyState, IconButton, LoadingState, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useSession } from "@/lib/auth";
import { useInvitationPage } from "@/lib/events-data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { SITE_URL } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/lib/theme";
import { openWebView, sitePath } from "@/lib/web";

export default function InvitationScreen() {
  const { slug, g } = useLocalSearchParams<{ slug: string; g?: string }>();
  const token = typeof g === "string" && g ? g : null;
  const theme = useTheme();
  const page = useInvitationPage(slug, token);
  const pull = usePullToRefresh(page.refetch);
  const data = page.data;
  const colors = useInvitationColors(data?.event.theme_color, data?.event.event_type ?? "other");
  const { session } = useSession();
  const webPath = `/e/${slug}${token ? `?g=${encodeURIComponent(token)}` : ""}`;

  // Signed out (or looking around in the demo), the app's server routes
  // won't answer, so the website's page shows instead.
  if (!session) return <Redirect href={{ pathname: "/web", params: { path: sitePath(webPath) } }} />;

  if (!data) {
    if (!page.isError) return <LoadingState />;
    return (
      <EmptyState
        icon="error"
        title="Couldn't load this"
        message={errorMessage(page.error)}
        action={
          <View style={{ gap: spacing.sm, alignItems: "center" }}>
            <Button title="Try again" icon="refresh" variant="secondary" size="medium" onPress={() => page.refetch()} />
            {/* An older website without the app's invitation loader still has the page. */}
            <Button title="Open the website's page" variant="ghost" size="medium" onPress={() => openWebView(webPath, { replace: true })} />
          </View>
        }
      />
    );
  }

  // The plain event link, never the guest's own: anyone with that could RSVP as them.
  const share = () => {
    const link = `${SITE_URL}/e/${data.slug}`;
    Share.share(Platform.OS === "ios" ? { url: link } : { message: link });
  };
  const everyone = data.exchange?.kind === "everyone";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen
        options={{
          title: data.event.title,
          headerRight: () => <IconButton icon="share" accessibilityLabel="Share the event link" onPress={share} />,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
        refreshControl={<RefreshControl {...pull} tintColor={theme.tint} />}
      >
        <InvitationHero page={data} colors={colors} />
        <InvitationDetails page={data} colors={colors} />

        {/* The reply comes before the gift sections: a guest answers before
            browsing what to give. */}
        {data.santa ? <SecretSantaCard santa={data.santa} /> : null}
        {data.staleToken ? (
          <View style={{ flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, padding: spacing.lg, backgroundColor: theme.accentSoft }}>
            <Icon name="info" size={18} color={theme.onAccentSoft} />
            <Text variant="footnote" style={{ flex: 1, color: theme.dark ? theme.text : theme.onAccentSoft }}>
              This RSVP link isn&apos;t on the guest list anymore. Ask the host for a new one.
            </Text>
          </View>
        ) : null}
        <RsvpForm
          // A new token is a different guest: start the form over.
          key={data.guestToken ?? "event-link"}
          page={data}
          onNewToken={(next) => router.setParams({ g: next })}
        />

        {everyone ? <WishListsSection page={data} colors={colors} /> : <GiftsSection page={data} colors={colors} />}
        <SignupSection page={data} />
        <ExchangeSection page={data} />
        <GroupGiftsSection gifts={data.groupGifts} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
