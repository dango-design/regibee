// "Coming up" on the home screen: the next few events as an agenda, one row
// per event with its date at the left, as on the website's My registries tab
// (src/components/upcoming-events.tsx).
//
// Events are drawn as plain rows on the page, and lists as cards with a
// colored cover (list-cover-card.tsx), so the two read as different things:
// dates to keep, and lists to look after.
//
// An event the user hosts opens its own screen. Someone else's opens its
// invitation, on the user's own guest link when they're invited, so they can
// RSVP.

import { router } from "expo-router";
import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { DashboardEvent } from "@shared/dashboard-page-types";
import { comingUpStatus, daysLeftText, eventDateParts } from "@shared/events";
import { countdownLabel, daysUntil } from "@shared/occasions";

import { HomeSection } from "@/components/home/home-section";
import { Divider, Text } from "@/components/ui";
import { fonts, spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";

function openEvent(event: DashboardEvent) {
  if (event.role === "host") {
    router.push({ pathname: "/events/[eventId]", params: { eventId: event.id } });
    return;
  }
  const guestLink = event.role === "guest" && event.guestToken ? `?g=${encodeURIComponent(event.guestToken)}` : "";
  openSite(`/e/${event.slug}${guestLink}`);
}

export function ComingUp({ events, today }: { events: DashboardEvent[]; today: string }) {
  const theme = useTheme();
  if (events.length === 0) return null;

  return (
    <HomeSection title="Coming up" more={{ title: "All events", href: "/events" }}>
      <View>
        {events.map((event, index) => {
          const { month, day, weekday } = eventDateParts(event.eventDate);
          const days = daysUntil(event.eventDate, today);
          const details = [weekday, event.time, comingUpStatus(event)].filter(Boolean).join(" · ");
          // The next event stands out.
          const next = index === 0;
          return (
            <Fragment key={event.id}>
              {index > 0 ? <Divider inset={64} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${event.title}. ${countdownLabel(event.eventDate, today, "personal")}. ${details}`}
                onPress={() => openEvent(event)}
                style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
              >
                <View style={styles.date}>
                  <Text variant="caption" style={{ color: theme.tint, fontWeight: "700", letterSpacing: 0.8, fontSize: 11 }}>
                    {month}
                  </Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 31, color: theme.text }}>{day}</Text>
                </View>
                {/* The countdown sits at the right while the title keeps at least
                    144 points beside it. On a narrower screen it wraps under the title. */}
                <View style={styles.body}>
                  <View style={styles.text}>
                    <Text variant="callout" numberOfLines={2} style={{ fontWeight: "600" }}>
                      {event.title}
                    </Text>
                    <Text variant="footnote" tone="tertiary" numberOfLines={2}>
                      {details}
                    </Text>
                  </View>
                  {next ? (
                    <View style={[styles.countdown, { backgroundColor: theme.tintSoft }]}>
                      <Text variant="caption" style={{ color: theme.tint, fontWeight: "700" }}>
                        {daysLeftText(days)}
                      </Text>
                    </View>
                  ) : (
                    <Text variant="caption" tone="secondary" style={{ fontWeight: "600" }}>
                      {daysLeftText(days)}
                    </Text>
                  )}
                </View>
              </Pressable>
            </Fragment>
          );
        })}
      </View>
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  date: { width: 44, alignItems: "center" },
  body: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.md, rowGap: 6 },
  text: { flexGrow: 1, flexShrink: 1, flexBasis: 144, minWidth: 0, gap: 2 },
  countdown: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
});
