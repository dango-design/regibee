// "Coming up" on the home screen: the next few events, with how many days are
// left until each, as on the website's My registries tab
// (src/components/upcoming-events.tsx). An event the user hosts opens its
// screen on the Events tab. Someone else's opens its invitation in the
// browser: on the user's own guest link when they're invited, so they can RSVP.

import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import type { DashboardEvent } from "@shared/dashboard-page-types";
import { formatShortEventDate, MY_RSVP_LABELS, rsvpStatsText } from "@shared/events";
import { countdownLabel, daysUntil } from "@shared/occasions";

import { Icon } from "@/components/icon";
import { Text } from "@/components/ui";
import { fonts, radius, spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";

function openEvent(event: DashboardEvent) {
  if (event.role === "host") {
    router.push({ pathname: "/events/[eventId]", params: { eventId: event.id } });
    return;
  }
  const guestLink = event.role === "guest" && event.guestToken ? `?g=${encodeURIComponent(event.guestToken)}` : "";
  openSite(`/e/${event.slug}${guestLink}`);
}

export function UpcomingEvents({ events, today }: { events: DashboardEvent[]; today: string }) {
  const theme = useTheme();
  if (events.length === 0) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text variant="headline" accessibilityRole="header">
          Coming up
        </Text>
        <Pressable
          accessibilityRole="link"
          hitSlop={10}
          onPress={() => router.navigate("/events")}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, opacity: pressed ? 0.6 : 1 })}
        >
          <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }}>
            All events
          </Text>
          <Icon name="chevronRight" size={11} color={theme.tint} />
        </Pressable>
      </View>
      {events.map((event) => {
        const days = daysUntil(event.eventDate, today);
        // Today's and tomorrow's stand out, as on the website.
        const soon = days <= 1;
        const when = `${formatShortEventDate(event.eventDate)}${event.time ? ` · ${event.time}` : ""}`;
        const status = event.summary
          ? rsvpStatsText(event.summary)
          : event.role === "guest" && event.rsvp
            ? MY_RSVP_LABELS[event.rsvp]
            : "Celebrating you";
        return (
          <Pressable
            key={event.id}
            accessibilityRole="button"
            accessibilityLabel={`${event.title}. ${countdownLabel(event.eventDate, today, "personal")}. ${when}. ${status}`}
            onPress={() => openEvent(event)}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.tile, { backgroundColor: soon ? theme.tint : theme.tintSoft }]}>
              {days === 0 ? (
                <Text variant="footnote" style={{ fontFamily: fonts.displayMedium, color: theme.onTint }}>
                  Today
                </Text>
              ) : (
                <>
                  <Text style={{ fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 22, color: soon ? theme.onTint : theme.tint }}>
                    {days}
                  </Text>
                  <Text style={{ fontSize: 10, lineHeight: 12, fontWeight: "600", color: soon ? theme.onTint : theme.tint }}>
                    {days === 1 ? "DAY" : "DAYS"}
                  </Text>
                </>
              )}
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="subhead" numberOfLines={2} style={{ fontWeight: "600" }}>
                {event.title}
              </Text>
              <Text variant="footnote" tone="tertiary" numberOfLines={1}>
                {when}
              </Text>
              <Text variant="footnote" tone="secondary" numberOfLines={1}>
                {status}
              </Text>
            </View>
            <Icon name={event.role === "host" ? "chevronRight" : "external"} size={14} color={theme.textTertiary} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tile: { width: 56, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
});
