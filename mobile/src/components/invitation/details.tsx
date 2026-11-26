// The top of an invitation: the picture or the event's color, the title, the
// date, the place, the host's message and their updates. The website's
// EventInvitation (src/components/event-invitation.tsx), as a phone screen.

import { Image } from "expo-image";
import { Linking, Platform, StyleSheet, View } from "react-native";

import { eventLocationText, eventTypeLabel, formatEventDate, formatEventTime, mapsUrl } from "@shared/events";
import type { InvitationPageData } from "@shared/invitation-page-types";

import { Icon, type IconName } from "@/components/icon";
import { Button, Text } from "@/components/ui";
import { SITE_URL } from "@/lib/supabase";
import { radius, spacing, useTheme } from "@/lib/theme";

import type { PanelColors } from "./colors";

/** An icon in a circle, then the row's text. */
function DetailRow({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      <View style={[styles.circle, { backgroundColor: theme.surfaceAlt }]}>
        <Icon name={icon} size={17} color={theme.tint} />
      </View>
      <View style={{ flex: 1, gap: 2, paddingTop: 6 }}>{children}</View>
    </View>
  );
}

/** "Mar 5", the day it was posted where the event is. */
function formatPosted(iso: string, timeZone: string | null) {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  try {
    return new Date(iso).toLocaleDateString("en-US", { ...options, timeZone: timeZone || "UTC" });
  } catch {
    return new Date(iso).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
  }
}

/** The picture, or a band in the event's color with its kind. */
export function InvitationHero({ page, colors }: { page: InvitationPageData; colors: PanelColors }) {
  const theme = useTheme();
  const { event } = page;
  if (event.image_url) {
    return (
      <Image
        source={{ uri: event.image_url }}
        style={{ width: "100%", aspectRatio: 4 / 5, borderRadius: radius.lg }}
        contentFit="contain"
        accessibilityLabel={`${event.title} invitation`}
      />
    );
  }
  return (
    <View style={[styles.band, { backgroundColor: colors.fill }]}>
      <View style={[styles.bandIcon, { backgroundColor: theme.surface }]}>
        {/* A meal train is help after a birth, an illness or a loss, not a party. */}
        <Icon name={event.event_type === "meal_train" ? "heart" : "party"} size={28} color={colors.ink} />
      </View>
      <Text variant="footnote" style={[styles.kind, { color: colors.ink }]}>
        {eventTypeLabel(event.event_type)}
      </Text>
    </View>
  );
}

/** The title, who's hosting, and the date, place and reply-by rows. */
export function InvitationDetails({ page, colors }: { page: InvitationPageData; colors: PanelColors }) {
  const { event } = page;
  const time = formatEventTime(event);
  // The address in the phone's maps app: Apple Maps on iPhone, and whichever
  // app handles Google Maps links on Android. Like the host's event screen.
  const address = event.location_address?.trim() ? eventLocationText(event) : null;
  const directions = address
    ? Platform.OS === "ios"
      ? `https://maps.apple.com/?q=${encodeURIComponent(address)}`
      : mapsUrl(event)
    : null;
  // iPhone's Calendar opens the .ics file. Android has no app for it, so it
  // gets the website's Google Calendar link instead.
  const calendarLink = page.calendar ? (Platform.OS === "ios" ? `${SITE_URL}${page.calendar.ics}` : page.calendar.google) : null;

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.xs }}>
        {event.image_url ? (
          <Text variant="footnote" style={[styles.kind, { color: colors.ink }]}>
            {eventTypeLabel(event.event_type)}
          </Text>
        ) : null}
        <Text variant="display" accessibilityRole="header">
          {event.title}
        </Text>
        {event.hosted_by ? (
          <Text variant="body" tone="secondary">
            Hosted by {event.hosted_by}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.lg }}>
        {event.event_date ? (
          <DetailRow icon="calendar">
            <Text variant="callout" style={{ fontWeight: "600" }}>
              {formatEventDate(event.event_date)}
            </Text>
            {time ? (
              <Text variant="callout" tone="secondary">
                {time}
              </Text>
            ) : null}
            {calendarLink ? (
              <Button
                title="Add to my calendar"
                icon="calendar"
                size="small"
                variant="secondary"
                style={{ alignSelf: "flex-start", marginTop: spacing.sm }}
                onPress={() => Linking.openURL(calendarLink)}
              />
            ) : null}
          </DetailRow>
        ) : null}
        {event.location_name || event.location_address ? (
          <DetailRow icon="location">
            {event.location_name ? (
              <Text variant="callout" style={{ fontWeight: "600" }}>
                {event.location_name}
              </Text>
            ) : null}
            {event.location_address ? (
              <Text variant="callout" tone="secondary">
                {event.location_address}
              </Text>
            ) : null}
            {directions ? (
              <Button
                title="Directions"
                icon="location"
                size="small"
                variant="secondary"
                style={{ alignSelf: "flex-start", marginTop: spacing.sm }}
                onPress={() => Linking.openURL(directions)}
              />
            ) : null}
          </DetailRow>
        ) : null}
        {page.addressHidden ? (
          <DetailRow icon="location">
            <Text variant="callout" tone="secondary">
              The drop-off address shows here once you sign up for a day.
            </Text>
          </DetailRow>
        ) : null}
        {event.rsvp_by ? (
          <DetailRow icon="clock">
            <Text variant="callout" tone="secondary">
              Please reply by {formatEventDate(event.rsvp_by)}
            </Text>
          </DetailRow>
        ) : null}
      </View>

      {event.message ? (
        <Text variant="body" tone="secondary" style={{ lineHeight: 26 }}>
          {event.message}
        </Text>
      ) : null}

      {page.updates.length > 0 ? <HostUpdates page={page} /> : null}
    </View>
  );
}

/**
 * What the host told guests after the invitation went out: their messages,
 * and a line for each new date, time or place.
 */
function HostUpdates({ page }: { page: InvitationPageData }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: theme.surfaceAlt }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={[styles.circle, { backgroundColor: theme.surface }]}>
          <Icon name="bell" size={17} color={theme.tint} />
        </View>
        <Text variant="headline" accessibilityRole="header">
          Updates from the host
        </Text>
      </View>
      <View style={{ backgroundColor: theme.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
        {page.updates.map((update, index) => (
          <View
            key={update.id}
            style={{
              gap: 4,
              paddingVertical: spacing.md,
              borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: theme.border,
            }}
          >
            {update.kind === "message" ? (
              <>
                <Text variant="callout" style={{ fontWeight: "600" }}>
                  {update.subject}
                </Text>
                <Text variant="callout" tone="secondary">
                  {update.body}
                </Text>
              </>
            ) : (
              <Text variant="callout" style={{ fontWeight: "600" }}>
                {update.body}
              </Text>
            )}
            <Text variant="footnote" tone="tertiary">
              {formatPosted(update.created_at, page.event.time_zone)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  band: { alignItems: "center", gap: spacing.md, borderRadius: radius.lg, paddingVertical: 40, paddingHorizontal: spacing.xl },
  bandIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  kind: { fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  panel: { gap: spacing.md, borderRadius: radius.lg, padding: spacing.lg },
});
