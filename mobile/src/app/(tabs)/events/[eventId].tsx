// An event's page for its hosts: the website's manage page
// (src/app/(protected)/dashboard/events/[eventId]/page.tsx), from the same
// loader (src/lib/events-page.ts), section by section.

import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from "react-native";

import { deletePhrase } from "@shared/delete-confirmation";
import { formatEventDate } from "@shared/events";

import { ConfirmDelete } from "@/components/confirm-delete";
import { ExchangePanel } from "@/components/event/exchange-panel";
import { GuestsPanel } from "@/components/event/guests-panel";
import { HostsPanel } from "@/components/event/hosts-panel";
import { MessagesPanel } from "@/components/event/messages-panel";
import { SignupPanel, SignupStarter } from "@/components/event/signup-panel";
import { Icon } from "@/components/icon";
import { Button, Card, ErrorState, haptic, IconButton, LoadingState, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useEventPage, useRunEventAction } from "@/lib/events-data";
import { pickPhoto, uploadEventImage } from "@/lib/photos";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { SITE_URL } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";

export default function EventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const theme = useTheme();
  const page = useEventPage(eventId);
  const pull = usePullToRefresh(page.refetch);
  const { run } = useRunEventAction();
  const [uploading, setUploading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const data = page.data;

  if (!data) {
    return page.isError ? <ErrorState message={errorMessage(page.error)} onRetry={() => page.refetch()} /> : <LoadingState />;
  }

  const { event } = data;
  const publicUrl = `${SITE_URL}/e/${event.slug}`;
  const edit = () => router.push({ pathname: "/event-form", params: { eventId: event.id } });

  function share() {
    Share.share(Platform.OS === "ios" ? { url: publicUrl, message: event.title } : { message: `${event.title}\n${publicUrl}` });
  }

  function moreActions() {
    Alert.alert(event.title, undefined, [
      {
        text: "Copy link",
        onPress: async () => {
          await Clipboard.setStringAsync(publicUrl);
          haptic("success");
        },
      },
      { text: "Preview", onPress: () => WebBrowser.openBrowserAsync(publicUrl) },
      {
        text: "Plan it again",
        onPress: () =>
          Alert.alert(
            "Plan this event again?",
            "This makes a new event a year later, with the same guests, co-hosts and gift settings. Guests' replies start over, and no one is emailed. A gift exchange avoids this year's pairs.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Plan it again",
                onPress: async () => {
                  try {
                    const { id } = await run<{ id: string }>("events.planEventAgain", event.id);
                    router.push({ pathname: "/events/[eventId]", params: { eventId: id } });
                  } catch (e) {
                    Alert.alert("It wasn't copied", errorMessage(e));
                  }
                },
              },
            ]
          ),
      },
      ...(data!.isOwner
        ? [
            {
              text: "Delete event",
              style: "destructive" as const,
              onPress: () => {
                setDeleteError(null);
                setConfirmingDelete(true);
              },
            },
          ]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  async function deleteEvent() {
    setDeleting(true);
    setDeleteError(null);
    try {
      // The website goes back to the Events tab afterwards.
      await run("events.deleteEvent", event.id);
      setConfirmingDelete(false);
      router.back();
    } catch (e) {
      setDeleteError(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  async function changePicture() {
    const asset = await pickPhoto();
    if (!asset) return;
    setUploading(true);
    try {
      const url = await uploadEventImage(event.id, asset);
      await run("events.setEventImage", event.id, url);
      haptic("success");
    } catch (e) {
      Alert.alert("The picture didn't upload", errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: event.title,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 4 }}>
              <IconButton icon="share" accessibilityLabel="Share the event link" onPress={share} />
              <IconButton icon="edit" accessibilityLabel="Edit" onPress={edit} />
              <IconButton icon="more" accessibilityLabel="More actions" onPress={moreActions} />
            </View>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            {...pull}
            tintColor={theme.tint}
          />
        }
      >
        <View style={{ gap: spacing.xs }}>
          <Text variant="footnote" tone="tint" style={{ fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
            {data.typeLabel}
          </Text>
          <Text variant="display">{event.title}</Text>
          <View style={styles.meta}>
            <Icon name="calendar" size={15} color={theme.textSecondary} />
            <Text variant="subhead" tone="secondary">
              {event.event_date ? `${formatEventDate(event.event_date)}${data.time ? ` · ${data.time}` : ""}` : "No date yet"}
            </Text>
          </View>
          {event.location_name ? (
            <View style={styles.meta}>
              <Icon name="location" size={15} color={theme.textSecondary} />
              <Text variant="subhead" tone="secondary">
                {event.location_name}
              </Text>
            </View>
          ) : null}
        </View>

        <Card style={{ padding: 0, gap: 0, overflow: "hidden" }}>
          {event.image_url ? (
            <Image
              source={{ uri: event.image_url }}
              style={{ width: "100%", aspectRatio: 4 / 5 }}
              contentFit="contain"
              accessibilityLabel={`${event.title} invitation`}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={changePicture}
              style={[styles.addPicture, { backgroundColor: theme.accentSoft }]}
            >
              <Icon name="image" size={30} color={theme.onAccentSoft} />
              <Text variant="headline">Add your invitation</Text>
              <Text variant="footnote" tone="secondary">
                Upload a picture guests see first
              </Text>
            </Pressable>
          )}
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            <Text variant="footnote" tone="tertiary">
              Guests see this, the details and an RSVP form at the event link.
              {event.open_rsvp ? " Anyone with the link can RSVP." : " Only invited guests can RSVP."}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              <Button
                title={event.image_url ? "Change picture" : "Upload picture"}
                icon="camera"
                size="small"
                variant="secondary"
                loading={uploading}
                onPress={changePicture}
              />
              <Button title="Preview" icon="external" size="small" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(publicUrl)} />
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
            <View style={[styles.giftIcon, { backgroundColor: theme.tintSoft }]}>
              <Icon name="gift" size={18} color={theme.tint} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="headline">Gifts</Text>
              {data.registries.length > 0 ? (
                data.registries.map((registry) => (
                  <Text key={registry.id} variant="footnote">
                    <Text
                      variant="footnote"
                      tone="tint"
                      accessibilityRole="link"
                      onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/r/${registry.slug}`)}
                    >
                      {registry.title}
                    </Text>
                    {registry.honoree ? <Text variant="footnote" tone="tertiary">{` · ${registry.honoree}`}</Text> : null}
                  </Text>
                ))
              ) : data.listRequests.length === 0 ? (
                <Text variant="footnote" tone="tertiary">
                  No registry linked.
                </Text>
              ) : null}
              {data.listRequests.map((request) => (
                <Text key={request.email} variant="footnote" tone="tertiary">
                  Waiting for {request.name} to make their list. We emailed {request.email}.
                </Text>
              ))}
              {event.gift_note ? (
                <Text variant="footnote" tone="secondary">
                  {event.gift_note}
                </Text>
              ) : null}
              <Text variant="footnote" tone="tint" accessibilityRole="link" onPress={edit} style={{ fontWeight: "600" }}>
                {data.registries.length > 0 || event.gift_note ? "Change gifts" : "Link a registry or add a gift note"}
              </Text>
            </View>
          </View>
        </Card>

        {data.exchange && data.exchangeStatus ? <ExchangePanel data={data} onEditSettings={edit} /> : null}
        {data.signupSheet ? <SignupPanel data={data} /> : <SignupStarter eventId={event.id} />}

        <GuestsPanel data={data} />
        <MessagesPanel data={data} onChangeReminder={edit} />
        <HostsPanel data={data} onLeft={() => router.back()} />
      </ScrollView>
      <ConfirmDelete
        visible={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        title="Delete this event?"
        message={
          data.guests.length > 0
            ? `The event page stops working and the guest list of ${data.guests.length} is deleted. This can't be undone.`
            : "The event page stops working. This can't be undone."
        }
        // An event with guests asks the owner to type a sentence first.
        phrase={data.guests.length > 0 ? deletePhrase("event") : null}
        confirmLabel="Delete event"
        cancelLabel="Keep it"
        working={deleting}
        error={deleteError}
        onConfirm={deleteEvent}
      />
    </>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", alignItems: "center", gap: 6 },
  addPicture: { alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.xxl },
  giftIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});

