// Store perks: what the owner's store registries may give them, and how far
// along each perk is. The website's Store perks tab (src/components/store-perks-card.tsx),
// worked out by the same rules (src/lib/store-perks.ts).

import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import type { PerkTone, StorePerksRow } from "@shared/store-perks";

import { Notice } from "@/components/notice";
import { Button, Card, ErrorState, LoadingState, Pill, Section, SwitchRow, Text } from "@/components/ui";
import { errorMessage, useRegistry, useUpdateStorePerks } from "@/lib/data";
import { spacing, useTheme } from "@/lib/theme";

const PILL_TONE: Record<PerkTone, "success" | "neutral" | "tint"> = {
  ready: "success",
  waiting: "neutral",
  upcoming: "tint",
  done: "neutral",
};

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function giftCountText(row: StorePerksRow) {
  const items = `${row.itemCount} ${row.itemCount === 1 ? "item" : "items"}`;
  const gifts = row.giftCount === 0 ? "no gifts yet" : `${row.giftCount} ${row.giftCount === 1 ? "gift" : "gifts"} reserved`;
  return `${items} · ${gifts}`;
}

export default function PerksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const registry = useRegistry(id);
  const save = useUpdateStorePerks(id);
  const detail = registry.data;

  if (!detail) {
    return registry.isError ? (
      <ErrorState message={errorMessage(registry.error)} onRetry={() => registry.refetch()} />
    ) : (
      <LoadingState />
    );
  }

  const done = (store: string, isDone: boolean) =>
    save.mutate(
      { welcomeBoxDone: { store, done: isDone } },
      { onError: (e) => Alert.alert("Couldn't save that", errorMessage(e)) }
    );
  const status = (row: StorePerksRow) => row.welcomeBox?.status ?? null;
  const giftUnlocked = detail.perkRows.filter((r) => r.welcomeBox?.afterGift && status(r) === "ready");
  const openSettings = () => router.push({ pathname: "/registry/[id]/settings", params: { id } });

  return (
    <>
      <Stack.Screen options={{ title: "Store perks" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 80 }}
      >
        <Text variant="subhead" tone="secondary">
          Rules differ by store, so check each store&apos;s terms.
        </Text>

        {giftUnlocked.map((row) => (
          <Notice
            key={row.storeId}
            icon="gift"
            tone="success"
            title={
              row.giftCount === 1
                ? `Your first ${row.name} gift was reserved.`
                : `Guests have reserved gifts from your ${row.name} registry.`
            }
            message={`You may be able to request your ${row.name} ${row.welcomeBox!.name} now.`}
            action={{
              title: `Request at ${row.name}`,
              icon: "external",
              onPress: () => WebBrowser.openBrowserAsync(row.registryUrl ?? `https://www.${row.domain}`),
            }}
            secondary={{ title: "Done, hide this", onPress: () => done(row.storeId, true) }}
          />
        ))}

        {detail.perkRows.map((row) => {
          const box = status(row);
          return (
            <Card key={row.storeId}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={[styles.mark, { backgroundColor: theme.tintSoft }]}>
                  <Text variant="headline" tone="tint">
                    {row.name.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="headline">{row.name}</Text>
                  <Text variant="footnote" tone="tertiary">
                    {giftCountText(row)}
                  </Text>
                </View>
                {row.registryUrl ? (
                  <Button title="Open registry" size="small" variant="ghost" onPress={() => WebBrowser.openBrowserAsync(row.registryUrl!)} />
                ) : (
                  <Button title="Link registry" size="small" variant="ghost" onPress={openSettings} />
                )}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {row.welcomeBox && box ? (
                  <Pill
                    tone={box === "done" ? "neutral" : box === "waiting" ? "neutral" : "success"}
                    icon={box === "done" ? "check" : undefined}
                    label={`${capitalize(row.welcomeBox.name)} · ${
                      box === "done" ? "Requested" : box === "waiting" ? "After first gift" : "Ready to request"
                    }`}
                  />
                ) : null}
                {row.perks.map((p) => (
                  <Pill key={p.label} tone={PILL_TONE[p.tone]} icon={p.tone === "done" ? "check" : undefined} label={`${p.label} · ${p.status}`} />
                ))}
              </View>
              {box === "ready" && !row.welcomeBox?.afterGift ? (
                <Button title="I requested it" size="small" variant="secondary" onPress={() => done(row.storeId, true)} />
              ) : null}
              {box === "done" ? <Button title="Undo" size="small" variant="ghost" onPress={() => done(row.storeId, false)} /> : null}
            </Card>
          );
        })}

        {!detail.registry.event_date ? (
          <Text variant="footnote" tone="tertiary">
            <Text variant="footnote" tone="tint" accessibilityRole="link" onPress={openSettings}>
              Add your due date
            </Text>{" "}
            to see when completion discounts open.
          </Text>
        ) : null}

        <Section footer="Only gifts reserved on Regibee count here.">
          <SwitchRow
            icon="mail"
            label="Email me when a perk may be ready"
            value={detail.perkEmails}
            onValueChange={(on) =>
              save.mutate({ emails: on }, { onError: (e) => Alert.alert("Couldn't save that", errorMessage(e)) })
            }
          />
        </Section>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  mark: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
