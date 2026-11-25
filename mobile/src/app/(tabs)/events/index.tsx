// The Events tab: the website's (src/components/events-overview.tsx and
// groups-section.tsx), from the same loader (src/lib/events-page.ts).

import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { eventTypeLabel, formatShortEventDate, MY_RSVP_LABELS, rsvpStatsText, type RsvpStatus } from "@shared/events";
import type { EventsTabCard, EventsTabInvite } from "@shared/events-page-types";
import { memberCountLabel } from "@shared/groups";
import { countdownLabel } from "@shared/occasions";

import { Icon, type IconName } from "@/components/icon";
import { NavRow } from "@/components/nav-row";
import { Button, Card, Divider, EmptyState, ErrorState, Field, IconButton, LoadingState, Pill, Section, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { useEventsTab, useRunEventAction } from "@/lib/events-data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { radius, spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";

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
  // A server from before invitations were listed sends none.
  const invited = data?.invited ?? [];
  const pastEvents = data ? mergePast(data.past, data.invitedPast ?? []) : [];
  const none = data ? data.upcoming.length === 0 && invited.length === 0 && pastEvents.length === 0 : false;

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
                        onPress={() => openSite(`/e/${event.slug}`)}
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
                action={<Button title="New" icon="add" onPress={() => router.push("/new")} />}
              />
            ) : null}

            {data.upcoming.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <Text variant="title" style={{ fontSize: 20 }}>
                  Hosting
                </Text>
                {data.upcoming.map((event) => (
                  <EventCard key={event.id} event={event} today={data.today} />
                ))}
              </View>
            ) : null}

            {invited.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <Text variant="title" style={{ fontSize: 20, marginTop: spacing.md }}>
                  Invited
                </Text>
                {invited.map((event) => (
                  <InviteCard key={event.id} event={event} today={data.today} />
                ))}
              </View>
            ) : null}

            {pastEvents.length > 0 ? (
              <View style={{ gap: spacing.md }}>
                <Text variant="title" style={{ fontSize: 20, marginTop: spacing.md }}>
                  Past events
                </Text>
                {pastEvents.map((entry) =>
                  entry.kind === "host" ? (
                    <EventCard key={entry.event.id} event={entry.event} today={data.today} />
                  ) : (
                    <InviteCard key={entry.event.id} event={entry.event} today={data.today} showInvited />
                  ),
                )}
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
  const open = () => router.push({ pathname: "/events/[eventId]", params: { eventId: event.id } });
  return (
    <Card onPress={open} accessibilityRole="button">
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
            {/* The days left, or the date once it's past, as on the website. */}
            {event.eventDate ? <Pill label={countdownLabel(event.eventDate, today, "personal")} tone="tint" icon="calendar" /> : null}
            {event.coHost ? <Pill label="Co-host" icon="people" /> : null}
          </View>
        </View>
        <Icon name="chevronRight" size={14} color={theme.textTertiary} />
      </View>
      <Text variant="footnote" tone="secondary">
        {event.eventDate ? `${formatShortEventDate(event.eventDate)}${event.time ? ` · ${event.time}` : ""}` : "No date yet"}
      </Text>
      <Text variant="footnote" tone="tertiary">
        {rsvpStatsText(event.summary)}
      </Text>
      {/* A tap anywhere on the card opens the event's page. View opens the invitation, as guests see it. */}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button title="Guests & RSVPs" size="small" onPress={open} style={{ flex: 1 }} />
        <Button
          title="View"
          icon="external"
          size="small"
          variant="secondary"
          accessibilityLabel={`View ${event.title} invitation`}
          onPress={() => openSite(`/e/${event.slug}`)}
        />
      </View>
    </Card>
  );
}

/**
 * Past events the viewer hosted and ones they were invited to, most recent
 * first, as the website's Events tab (src/components/events-overview.tsx)
 * lists them. Past events always have a date.
 */
function mergePast(past: EventsTabCard[], invitedPast: EventsTabInvite[]) {
  return [
    ...past.map((event) => ({ kind: "host" as const, event })),
    ...invitedPast.map((event) => ({ kind: "guest" as const, event })),
  ].sort((a, b) => (b.event.eventDate ?? "").localeCompare(a.event.eventDate ?? ""));
}

const REPLY_PILLS: Record<RsvpStatus, { tone: "neutral" | "tint" | "success"; icon: IconName }> = {
  yes: { tone: "success", icon: "checkCircle" },
  maybe: { tone: "neutral", icon: "info" },
  no: { tone: "neutral", icon: "close" },
  pending: { tone: "tint", icon: "mail" },
};

/**
 * Someone else's event the viewer is invited to, as the website's
 * InvitedEventCard (src/components/event-card.tsx) shows it: their own reply,
 * not the host's counts. It opens the invitation on their guest link, where
 * they can RSVP.
 */
function InviteCard({ event, today, showInvited = false }: { event: EventsTabInvite; today: string; showInvited?: boolean }) {
  const theme = useTheme();
  const reply = REPLY_PILLS[event.rsvp];
  // Asking for a reply makes sense only before the event.
  const needsReply = event.rsvp === "pending" && (!event.eventDate || event.eventDate >= today);
  const open = () => openSite(`/e/${event.slug}?g=${encodeURIComponent(event.guestToken)}`);
  return (
    <Card onPress={open} accessibilityRole="link">
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
            {event.eventDate ? <Pill label={countdownLabel(event.eventDate, today, "personal")} tone="tint" icon="calendar" /> : null}
            {showInvited ? <Pill label="Invited" icon="mail" /> : null}
          </View>
        </View>
        <Icon name="external" size={14} color={theme.textTertiary} />
      </View>
      <Text variant="footnote" tone="secondary">
        {event.eventDate ? `${formatShortEventDate(event.eventDate)}${event.time ? ` · ${event.time}` : ""}` : "No date yet"}
        {event.hostedBy ? ` · Hosted by ${event.hostedBy}` : ""}
      </Text>
      <View style={{ flexDirection: "row" }}>
        <Pill label={MY_RSVP_LABELS[event.rsvp]} tone={reply.tone} icon={reply.icon} />
      </View>
      <Button
        title={needsReply ? "RSVP" : "See invitation"}
        size="small"
        variant={needsReply ? "primary" : "secondary"}
        onPress={open}
      />
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
      ) : !adding ? (
        <Text variant="footnote" tone="tertiary">
          No groups yet. Make one here, or save an event's guest list as a group from the event's page.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 60, height: 60, borderRadius: radius.md },
});
