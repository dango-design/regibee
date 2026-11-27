// Chooses what counts for what on the baby checklist, both ways:
// - `thing` (and `kind`): which entry an item or gift fund counts for, from
//   the checklist's "Count for something else" and the item editor;
// - `entry`: which item or gift fund on the list counts for this entry, from
//   the checklist's "Choose from your list".
// The website does the same in src/components/checklist-entry-picker.tsx and
// the checklist page.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { DEFAULT_CHECKLIST } from "@shared/checklist-data";
import { CHECKLIST_NONE, checklistEntry, countedEntry, entryTakes } from "@shared/checklist-matching";

import { Icon } from "@/components/icon";
import { EmptyState, ErrorState, Field, haptic, LoadingState, Text } from "@/components/ui";
import { errorMessage, useRegistry, useSetChecklistEntry } from "@/lib/data";
import { radius, spacing, useTheme } from "@/lib/theme";

export default function ChecklistEntryScreen() {
  const params = useLocalSearchParams<{ id: string; thing?: string; kind?: string; entry?: string }>();
  const theme = useTheme();
  const registry = useRegistry(params.id);
  const setEntry = useSetChecklistEntry(params.id);
  const [query, setQuery] = useState("");

  const detail = registry.data;
  if (!detail) {
    return registry.isError ? (
      <ErrorState message={errorMessage(registry.error)} onRetry={() => registry.refetch()} />
    ) : (
      <LoadingState />
    );
  }

  const things = [
    ...detail.items.map((i) => ({ id: i.id, kind: "item" as const, title: i.title, checklist_entry: i.checklist_entry })),
    ...detail.funds.map((f) => ({ id: f.id, kind: "fund" as const, title: f.title, checklist_entry: f.checklist_entry })),
  ];

  function save(kind: "item" | "fund", id: string, entry: string) {
    haptic();
    setEntry.mutate(
      { kind, id, entry },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert("Couldn't save that", errorMessage(e)),
      }
    );
  }

  const row = (key: string, label: string, chosen: boolean, onPress: () => void, icon?: "gift" | "fund") => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected: chosen, disabled: setEntry.isPending }}
      disabled={setEntry.isPending}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed || chosen ? theme.surfaceAlt : "transparent" }]}
    >
      {icon ? <Icon name={icon} size={16} color={theme.textTertiary} /> : null}
      <Text variant="callout" style={{ flex: 1, fontWeight: chosen ? "600" : "400" }}>
        {label}
      </Text>
      {chosen ? <Icon name="check" size={16} color={theme.tint} /> : null}
    </Pressable>
  );

  // Something on the list that counts for this entry.
  if (params.entry) {
    const info = checklistEntry(params.entry);
    if (!info) return <EmptyState icon="error" title="That isn't on the checklist" />;
    const choices = things.filter((t) => entryTakes(info.entry, t.kind) && countedEntry(t).key !== info.entry.key);
    return (
      <>
        <Stack.Screen options={{ title: `Count for ${info.entry.name}` }} />
        <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ padding: spacing.lg }}>
          {choices.length === 0 ? (
            <Text tone="secondary">Nothing else on your list can count for it.</Text>
          ) : (
            choices.map((t) => row(t.id, t.title, false, () => save(t.kind, t.id, info.entry.key), t.kind === "fund" ? "fund" : "gift"))
          )}
        </ScrollView>
      </>
    );
  }

  // Which entry this item or fund counts for.
  const thing = things.find((t) => t.id === params.thing && t.kind === (params.kind === "fund" ? "fund" : "item"));
  if (!thing) return <EmptyState icon="error" title="This item is gone" message="It may have been deleted on another device." />;
  const current = countedEntry(thing).key;
  const typed = query.trim().toLowerCase();
  const groups = DEFAULT_CHECKLIST.map((category) => ({
    name: category.name,
    entries: category.items.filter(
      (e) => entryTakes(e, thing.kind) && (!typed || e.name.toLowerCase().includes(typed) || category.name.toLowerCase().includes(typed))
    ),
  })).filter((g) => g.entries.length > 0);

  return (
    <>
      <Stack.Screen options={{ title: "Checklist" }} />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="footnote" tone="secondary">
          Count “{thing.title}” for
        </Text>
        <Field
          placeholder="Search the checklist"
          accessibilityLabel="Search the checklist"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        <View>
          {!typed && row(CHECKLIST_NONE, "Not counted", current === null, () => save(thing.kind, thing.id, CHECKLIST_NONE))}
          {groups.map((group) => (
            <View key={group.name}>
              <Text variant="caption" tone="tertiary" style={styles.group}>
                {group.name}
              </Text>
              {group.entries.map((e) => row(e.key, e.name, current === e.key, () => save(thing.kind, thing.id, e.key)))}
            </View>
          ))}
          {groups.length === 0 ? <Text tone="secondary">Nothing on the checklist matches.</Text> : null}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  group: { fontWeight: "600", paddingTop: spacing.md, paddingBottom: 4, paddingHorizontal: spacing.md },
});
