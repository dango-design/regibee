// "Messages to guests" on an event's page: the website's GuestMessages
// (src/components/guest-messages.tsx). A message goes by email with each
// guest's own RSVP link, and also shows on the invitation.

import { useState } from "react";
import { View } from "react-native";

import type { EventPageData } from "@shared/events-page-types";
import {
  MAX_MESSAGE_BODY_LENGTH,
  MAX_MESSAGE_SUBJECT_LENGTH,
  MESSAGE_AUDIENCES,
  type MessageAudience,
} from "@shared/event-updates";

import { Button, Card, Chip, Divider, Field, haptic, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useRunEventAction } from "@/lib/events-data";
import { spacing } from "@/lib/theme";

const KIND_LABELS = { message: "Message", change: "New details", reminder: "Day-before reminder" } as const;

function formatSent(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MessagesPanel({ data, onChangeReminder }: { data: EventPageData; onChangeReminder: () => void }) {
  const { run } = useRunEventAction();
  const { event, audienceCounts: counts, messages } = data;
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState<MessageAudience>("going");
  const [subject, setSubject] = useState(`About ${event.title}`.slice(0, MAX_MESSAGE_SUBJECT_LENGTH));
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const remindDayBefore = event.remind_day_before ?? true;

  async function send() {
    if (!body.trim()) {
      setNotice({ text: "Write your message.", error: true });
      return;
    }
    setSending(true);
    setNotice(null);
    try {
      const result = await run<{ sent: number }>("eventMessages.sendEventMessage", event.id, { audience, subject, body });
      haptic("success");
      setNotice({
        text:
          result.sent > 0
            ? `Sent to ${result.sent === 1 ? "1 guest" : `${result.sent} guests`}, and posted on the invitation`
            : "Posted on the invitation",
        error: false,
      });
      setOpen(false);
      setBody("");
    } catch (e) {
      setNotice({ text: errorMessage(e), error: true });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <Text variant="headline">Messages to guests</Text>
      <Text variant="footnote" tone="secondary">
        {remindDayBefore ? "Everyone going gets a reminder the day before. " : "The day-before reminder is off. "}
        <Text variant="footnote" tone="tint" accessibilityRole="link" onPress={onChangeReminder}>
          Change
        </Text>
      </Text>
      {open ? (
        <View style={{ gap: spacing.md }}>
          <Text variant="footnote" tone="secondary">
            It&apos;s emailed to guests, and anyone with the invitation&apos;s link can see it there.
          </Text>
          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
              Send to
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {(Object.keys(MESSAGE_AUDIENCES) as MessageAudience[]).map((value) => (
                <Chip
                  key={value}
                  label={`${MESSAGE_AUDIENCES[value].label} (${counts[value]})`}
                  selected={audience === value}
                  onPress={() => setAudience(value)}
                />
              ))}
            </View>
          </View>
          <Field label="Subject" value={subject} onChangeText={setSubject} maxLength={MAX_MESSAGE_SUBJECT_LENGTH} />
          <Field
            label="Message"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={MAX_MESSAGE_BODY_LENGTH}
            placeholder="Parking is behind the building. See you Saturday!"
          />
          <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button title="Cancel" size="small" variant="ghost" onPress={() => setOpen(false)} />
            <Button
              title={
                counts[audience] === 0
                  ? "Post on the invitation"
                  : `Send to ${counts[audience] === 1 ? "1 guest" : `${counts[audience]} guests`}`
              }
              size="small"
              icon="send"
              loading={sending}
              onPress={send}
            />
          </View>
        </View>
      ) : (
        <Button title="Message everyone going" icon="chat" size="medium" variant="secondary" onPress={() => setOpen(true)} />
      )}
      {notice ? (
        <Text variant="footnote" tone={notice.error ? "danger" : "success"} accessibilityLiveRegion="polite">
          {notice.text}
        </Text>
      ) : null}
      {messages.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          {messages.map((message, index) => (
            <View key={message.id} style={{ gap: 2 }}>
              {index > 0 ? <Divider /> : null}
              <Text variant="subhead" style={{ fontWeight: "600", marginTop: index > 0 ? spacing.sm : 0 }}>
                {message.subject}
              </Text>
              <Text variant="caption" tone="tertiary">
                {KIND_LABELS[message.kind]} · {formatSent(message.created_at)} ·{" "}
                {message.recipients === 0 && message.kind !== "reminder"
                  ? "Invitation only"
                  : message.recipients === 1
                    ? "1 guest"
                    : `${message.recipients} guests`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
