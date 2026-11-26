// "Hosts" on an event's page: the owner and co-hosts, inviting another, and
// taking back invitations. The website's EventCoHosts
// (src/components/event-co-hosts.tsx), with the same actions.

import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Alert, Share, View } from "react-native";

import type { EventPageData } from "@shared/events-page-types";
import { isEmail } from "@shared/events";

import { Button, Card, Field, haptic, IconButton, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { useRunEventAction } from "@/lib/events-data";
import { SITE_URL } from "@/lib/supabase";
import { spacing, useTheme } from "@/lib/theme";

export function HostsPanel({ data, onLeft }: { data: EventPageData; onLeft: () => void }) {
  const theme = useTheme();
  const { run } = useRunEventAction();
  const { event, hosts, invites, viewerId, isOwner } = data;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  async function attempt(work: () => Promise<unknown>, success?: string) {
    setBusy(true);
    setNotice(null);
    try {
      await work();
      haptic("success");
      if (success) setNotice({ text: success, error: false });
      return true;
    } catch (e) {
      setNotice({ text: errorMessage(e), error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    const address = email.trim();
    if (!isEmail(address)) {
      setNotice({ text: "That email address doesn't look right.", error: true });
      return;
    }
    if (await attempt(() => run("events.inviteCoHost", event.id, address), `Invited ${address} to co-host`)) setEmail("");
  }

  async function copyLink() {
    setBusy(true);
    setNotice(null);
    try {
      const { token } = await run<{ token: string }>("events.createCoHostLink", event.id);
      const url = `${SITE_URL}/host-invite/${token}`;
      await Clipboard.setStringAsync(url);
      haptic("success");
      Alert.alert("Co-host link copied. It works for 14 days.", url, [
        { text: "OK" },
        { text: "Share", onPress: () => Share.share({ message: url }) },
      ]);
    } catch (e) {
      setNotice({ text: errorMessage(e) || "The link wasn't made. Try again.", error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text variant="headline">Hosts</Text>
      <Text variant="footnote" tone="secondary">
        Co-hosts can edit the event and manage guests.
      </Text>
      <View style={{ gap: spacing.sm }}>
        {hosts.map((host) => (
          <View key={host.userId} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 36 }}>
            <Text variant="subhead" style={{ flex: 1 }}>
              {host.name}
              {host.userId === viewerId ? " (you)" : ""}
              {host.isOwner ? (
                <Text variant="subhead" tone="tertiary">
                  {" · made the event"}
                </Text>
              ) : null}
            </Text>
            {!host.isOwner && (isOwner || host.userId === viewerId) ? (
              <Button
                title={host.userId === viewerId ? "Leave" : "Remove"}
                size="small"
                variant="ghost"
                disabled={busy}
                onPress={() =>
                  Alert.alert(host.userId === viewerId ? "Leave this event?" : `Remove ${host.name}?`, undefined, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: host.userId === viewerId ? "Leave" : "Remove",
                      style: "destructive",
                      onPress: async () => {
                        const done = await attempt(() => run("events.removeCoHost", event.id, host.userId));
                        if (done && host.userId === viewerId) onLeft();
                      },
                    },
                  ])
                }
              />
            ) : null}
          </View>
        ))}
        {invites.map((pending) => (
          <View key={pending.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 36 }}>
            <Text variant="subhead" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
              {pending.email ?? "Shared link"} · invited
            </Text>
            <IconButton
              icon="close"
              color={theme.textTertiary}
              accessibilityLabel={`Take back the invitation${pending.email ? ` to ${pending.email}` : ""}`}
              onPress={() => attempt(() => run("events.revokeCoHostInvite", event.id, pending.id))}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Invite a co-host"
            value={email}
            onChangeText={setEmail}
            placeholder="their@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={invite}
          />
        </View>
        <IconButton icon="send" accessibilityLabel="Send co-host invitation" onPress={invite} />
      </View>
      <Button title="Copy co-host link" icon="link" size="small" variant="ghost" disabled={busy} onPress={copyLink} />
      {notice ? (
        <Text variant="footnote" tone={notice.error ? "danger" : "success"} accessibilityLiveRegion="polite">
          {notice.text}
        </Text>
      ) : null}
    </Card>
  );
}
