// The Events tab: the website's (src/components/events-overview.tsx and
// groups-section.tsx), from the same loader (src/lib/events-page.ts).

import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { eventTypeLabel, formatShortEventDate } from "@shared/events";
import type { EventsTabCard } from "@shared/events-page-types";
import { memberCountLabel } from "@shared/groups";
import { countdownLabel } from "@shared/occasions";

import { Icon } from "@/components/icon";
import { NavRow } from "@/components/nav-row";
import { Button, Card, Divider, EmptyState, ErrorState, Field, IconButton, LoadingState, Pill, Section, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { useEventsTab, useRunEventAction } from "@/lib/events-data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { SITE_URL } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/lib/theme";

export default function EventsScreen() {
  const theme = useTheme();
  const { demo } = useSession();
  const tab = useEventsTab();
  const pull = usePullToRefresh(tab.refetch);

  if (demo) {
    return (
      <EmptyState
        icon="party"
        title="Events are for accounts"
        message="Make an account to send invitations, track RSVPs, run a gift exchange and keep groups of guests."
      />
    );
  }

  const data = tab.data;
  const none = data ? data.upcoming.length === 0 && data.past.length === 0 : false;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => <IconButton icon="add" accessibilityLabel="Start something new" onPress={() => router.push("/new")} />,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            {...pull}
            tintColor={theme.tint}
          />
        }
      >
        <Text variant="subhead" tone="secondary">
          Send invitations and track RSVPs
        </Text>

        {!data ? (
          tab.isError ? (
            <ErrorState message={errorMessage(tab.error)} onRetry={() => tab.refetch()} />
          ) : (
            <LoadingState />
          )
        ) : (
          <>
            {data.linked.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="headline">Celebrating you</Text>
                <Text variant="footnote" tone="tertiary">
                  Events other people are hosting that link your registry.
                </Text>
                <Section>
                  {data.linked.map((event, index) => (
                    <View key={event.id}>
                      {index > 0 ? <Divider inset={52} /> : null}
                      <NavRow
                        icon="heart"
                        label={event.title}
                        detail={`${event.dateText ? `${event.dateText} · ` : ""}links ${event.registryTitles.join(", ")}`}
                        external
                        onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/e/${event.slug}`)}
                      />
                    </View>
                  ))}
                </Section>
              </View>
            ) : null}

            {none ? (
              <EmptyState
                icon="party"
                title="Plan your first event"
                message="A baby shower, a birthday, a holiday party: upload your invitation, email it to guests, and see who's coming. Link your registry so guests know what to bring."
                action={<Button title="Plan an event" icon="add" onPress={() => router.push("/new")} />}
              />
            ) : (
              <View style={{ gap: spacing.md }}>
                {data.upcoming.map((event) => (
                  <EventCard key={event.id} event={event} today={data.today} />
                ))}
              </View>
            )}

            {data.past.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <Text variant="title" style={{ fontSize: 20, marginTop: spacing.md }}>
                  Past events
                </Text>
                {data.past.map((event) => (
                  <EventCard key={event.id} event={event} today={data.today} />
                ))}
              </View>
            ) : null}

            <GroupsSection groups={data.groups} />
          </>
        )}
      </ScrollView>
    </>
  );
}

/** An event's card, as the website's EventCard (src/components/event-card.tsx) shows it. */
function EventCard({ event, today }: { event: EventsTabCard; today: string }) {
  const theme = useTheme();
  const { summary } = event;
  const stats =
    summary.guests === 0
      ? "No guests yet"
      : [`${summary.attending} going`, summary.maybe > 0 ? `${summary.maybe} maybe` : null, `${summary.pending} no reply`]
          .filter(Boolean)
          .join(" · ");
  return (
    <Card onPress={() => router.push({ pathname: "/events/[eventId]", params: { eventId: event.id } })} accessibilityRole="button">
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        {event.imageUrl ? (
          <Image source={{ uri: event.imageUrl }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }]}>
            <Icon name="party" size={24} color={theme.onAccentSoft} />
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="caption" tone="tertiary" style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
            {eventTypeLabel(event.eventType)}
          </Text>
          <Text variant="headline" numberOfLines={2}>
            {event.title}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {event.eventDate && event.eventDate >= today ? (
              <Pill label={countdownLabel(event.eventDate, today, "personal")} tone="tint" icon="calendar" />
            ) : null}
            {event.coHost ? <Pill label="Co-host" icon="people" /> : null}
          </View>
        </View>
        <Icon name="chevronRight" size={14} color={theme.textTertiary} />
      </View>
      <Text variant="footnote" tone="secondary">
        {event.eventDate ? `${formatShortEventDate(event.eventDate)}${event.time ? ` · ${event.time}` : ""}` : "No date yet"}
      </Text>
      <Text variant="footnote" tone="tertiary">
        {stats}
      </Text>
    </Card>
  );
}

function GroupsSection({ groups }: { groups: { id: string; name: string; memberCount: number }[] }) {
  const { run } = useRunEventAction();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function make() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { id } = await run<{ id: string }>("groups.createGroup", name.trim(), []);
      setName("");
      setAdding(false);
      router.push({ pathname: "/events/group/[groupId]", params: { groupId: id } });
    } catch (e) {
      Alert.alert("The group wasn't made", errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="title" style={{ fontSize: 20 }}>
          Groups
        </Text>
        {!adding ? <Button title="New group" icon="add" size="small" variant="ghost" onPress={() => setAdding(true)} /> : null}
      </View>
      <Text variant="footnote" tone="tertiary">
        Guest lists you keep, like your family or book club. Invite a whole group, run its gift exchange each year, or share a
        wishlist with it.
      </Text>
      {adding ? (
        <Card>
          <Field label="Group name" value={name} onChangeText={setName} placeholder="The Chens" autoFocus maxLength={80} />
          <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
            <Button title="Cancel" size="small" variant="ghost" onPress={() => setAdding(false)} />
            <Button title="Make group" size="small" loading={busy} disabled={!name.trim()} onPress={make} />
          </View>
        </Card>
      ) : null}
      {groups.length > 0 ? (
        <Section>
          {groups.map((group, index) => (
            <View key={group.id}>
              {index > 0 ? <Divider inset={52} /> : null}
              <NavRow
                icon="people"
                label={group.name}
                detail={memberCountLabel(group.memberCount)}
                onPress={() => router.push({ pathname: "/events/group/[groupId]", params: { groupId: group.id } })}
              />
            </View>
          ))}
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 60, height: 60, borderRadius: radius.md },
});
