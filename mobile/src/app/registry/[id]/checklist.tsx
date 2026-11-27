// The baby checklist: what most new parents need, what on the list counts for
// each entry, and a button to add each. The website's checklist page
// (src/components/checklist-manager.tsx), with the same entries, matching
// (src/lib/checklist-matching.ts) and words.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, SectionList, StyleSheet, View } from "react-native";

import * as WebBrowser from "expo-web-browser";

import {
  DEFAULT_CHECKLIST,
  checklistPrice,
  checklistQuantity,
  type ChecklistCategory,
  type ChecklistItem,
} from "@shared/checklist-data";
import { CHECKLIST_NONE, checklistStatus, entryTakes, specificQuestion } from "@shared/checklist-matching";

import { HeaderMenu } from "@/components/header-menu";
import { Icon } from "@/components/icon";
import { Button, Chip, Divider, ErrorState, haptic, LoadingState, Pill, ProgressBar, Text } from "@/components/ui";
import {
  errorMessage,
  useAddChecklistItem,
  useRegistry,
  useSetChecklistEntry,
  useToggleChecklistDismissed,
} from "@/lib/data";
import { radius, spacing, useTheme } from "@/lib/theme";

type Filter = "essential" | "all" | "not-added";

/** Essentials first, then the rest, each in the checklist's order. */
function essentialsFirst(items: ChecklistItem[]): ChecklistItem[] {
  return [...items.filter((i) => i.isEssential), ...items.filter((i) => !i.isEssential)];
}

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const registry = useRegistry(id);
  const add = useAddChecklistItem(id);
  const toggle = useToggleChecklistDismissed(id);
  const setEntry = useSetChecklistEntry(id);
  const [filter, setFilter] = useState<Filter>("essential");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);

  const detail = registry.data;
  const things = useMemo(
    () => [
      ...(detail?.items ?? []).map((i) => ({ id: i.id, kind: "item" as const, title: i.title, checklist_entry: i.checklist_entry })),
      ...(detail?.funds ?? []).map((f) => ({ id: f.id, kind: "fund" as const, title: f.title, checklist_entry: f.checklist_entry })),
    ],
    [detail?.items, detail?.funds]
  );
  const status = useMemo(
    () => checklistStatus(things, detail?.registry.settings?.checklist_dismissed),
    [things, detail?.registry.settings]
  );

  if (!detail) {
    return registry.isError ? (
      <ErrorState message={errorMessage(registry.error)} onRetry={() => registry.refetch()} />
    ) : (
      <LoadingState />
    );
  }

  const dismissed = new Set(status.dismissed);
  const counted = (entry: ChecklistItem) => status.byEntry[entry.key] ?? [];
  const isDone = (entry: ChecklistItem) => counted(entry).length > 0 || dismissed.has(entry.key);
  const sections = DEFAULT_CHECKLIST.map((category) => {
    const shown = category.items.filter((item) =>
      filter === "essential" ? item.isEssential : filter === "not-added" ? !isDone(item) : true
    );
    const items = essentialsFirst(shown);
    return { category, items, data: collapsed.has(category.name) ? [] : items };
  }).filter((s) => filter === "all" || s.items.length > 0);
  const allCollapsed = collapsed.size === DEFAULT_CHECKLIST.length;

  const categoryIdFor = (category: ChecklistCategory) =>
    detail.categories.find((c) => c.name.toLowerCase() === category.name.toLowerCase())?.id ?? null;

  function addPlaceholder(entry: ChecklistItem, category: ChecklistCategory) {
    setAdding(entry.key);
    add.mutate(
      {
        name: entry.name,
        key: entry.key,
        categoryId: categoryIdFor(category),
        quantity: entry.suggestedQuantity,
        description: entry.description,
      },
      {
        onSuccess: () => haptic("success"),
        onError: (e) => Alert.alert("Couldn't add it", errorMessage(e)),
        onSettled: () => setAdding(null),
      }
    );
  }

  function startAdding(entry: ChecklistItem, category: ChecklistCategory) {
    // A fund entry opens the create gift fund screen, filled in, as on the website.
    if (entry.fund) {
      router.push({
        pathname: "/fund",
        params: { registryId: id, title: entry.name, description: entry.description ?? "", checklistEntry: entry.key },
      });
      return;
    }
    // Yes adds a product from its link. No adds the entry as it is, and guests pick one.
    Alert.alert(specificQuestion(entry), "If not, guests can choose one.", [
      { text: "Cancel", style: "cancel" },
      { text: "No, guests can choose", onPress: () => addPlaceholder(entry, category) },
      {
        text: "Yes, add its link",
        onPress: () =>
          router.push({
            pathname: "/add",
            params: {
              registryId: id,
              categoryId: categoryIdFor(category) ?? "",
              quantity: String(entry.suggestedQuantity),
              notes: entry.description ?? "",
              checklistEntry: entry.key,
            },
          }),
      },
    ]);
  }

  const failed = (e: unknown) => Alert.alert("Couldn't save that", errorMessage(e));

  return (
    <>
      <Stack.Screen options={{ title: "Checklist" }} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <View style={{ gap: 6 }}>
              <Text variant="footnote" style={{ fontWeight: "600" }}>
                {status.essentialsDone} of {status.essentialsTotal} essentials
                <Text variant="footnote" tone="tertiary">
                  {` · ${status.done} of ${status.total} in all`}
                </Text>
              </Text>
              <ProgressBar
                value={status.essentialsTotal > 0 ? status.essentialsDone / status.essentialsTotal : 0}
                color={theme.success}
              />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Chip label="Essentials" selected={filter === "essential"} onPress={() => setFilter("essential")} />
              <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
              <Chip label="Not added" selected={filter === "not-added"} onPress={() => setFilter("not-added")} />
            </View>
            <View style={{ flexDirection: "row" }}>
              <Button
                title={allCollapsed ? "Expand all" : "Collapse all"}
                size="small"
                variant="ghost"
                onPress={() => setCollapsed(allCollapsed ? new Set() : new Set(DEFAULT_CHECKLIST.map((c) => c.name)))}
              />
            </View>
          </View>
        }
        ListFooterComponent={
          status.uncounted.length > 0 ? (
            <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text variant="headline">Not on the checklist</Text>
              {status.uncounted.map((thing, index) => (
                <View key={thing.id}>
                  {index > 0 ? <Divider /> : null}
                  <View style={styles.thingRow}>
                    <Icon name={thing.kind === "fund" ? "fund" : "gift"} size={16} color={theme.textTertiary} />
                    <Text variant="subhead" style={{ flex: 1 }}>
                      {thing.title}
                    </Text>
                    <Button
                      title="Count it"
                      size="small"
                      variant="secondary"
                      onPress={() =>
                        router.push({
                          pathname: "/registry/[id]/checklist-entry",
                          params: { id, thing: thing.id, kind: thing.kind },
                        })
                      }
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : undefined
        }
        renderSectionHeader={({ section }) => {
          const { category } = section;
          const open = !collapsed.has(category.name);
          const done = category.items.filter(isDone).length;
          const essentials = category.items.filter((i) => i.isEssential);
          const essentialsDone = essentials.filter(isDone).length;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => {
                haptic();
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(category.name)) next.delete(category.name);
                  else next.add(category.name);
                  return next;
                });
              }}
              style={[
                styles.category,
                { backgroundColor: theme.surface, borderColor: theme.border },
                open && section.data.length > 0 ? styles.categoryOpen : null,
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Icon name={open ? "arrowDown" : "chevronRight"} size={14} color={theme.textTertiary} />
                <Text variant="headline" style={{ flex: 1 }}>
                  {category.name}
                </Text>
                <Text variant="footnote" tone="secondary">
                  {done}/{category.items.length}
                </Text>
              </View>
              {essentials.length > 0 ? (
                <Text variant="caption" tone="tertiary" style={{ marginLeft: 22 }}>
                  {essentialsDone}/{essentials.length} essentials
                </Text>
              ) : null}
              <View style={{ marginLeft: 22 }}>
                <ProgressBar value={category.items.length > 0 ? done / category.items.length : 0} color={theme.success} />
              </View>
            </Pressable>
          );
        }}
        renderSectionFooter={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item: entry, index, section }) => {
          const here = counted(entry);
          const isAdded = here.length > 0;
          const isDismissed = dismissed.has(entry.key);
          const done = isAdded || isDismissed;
          const last = index === section.data.length - 1;
          const canChoose = things.some((t) => entryTakes(entry, t.kind) && !here.some((h) => h.id === t.id));
          return (
            <View
              style={[
                styles.item,
                { backgroundColor: theme.surface, borderColor: theme.border },
                last ? styles.itemLast : null,
              ]}
            >
              {index > 0 ? <Divider /> : null}
              <View style={{ paddingVertical: spacing.md, gap: 4, opacity: done ? 0.55 : 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                  <Text variant="subhead" style={{ fontWeight: "600", textDecorationLine: done ? "line-through" : "none" }}>
                    {entry.name}
                  </Text>
                  {entry.isEssential ? <Pill label="Essential" tone="accent" /> : null}
                </View>
                <Text variant="footnote" tone="tertiary">
                  {checklistPrice(entry)}
                  {entry.unit || entry.suggestedQuantity > 1 ? ` · Qty: ${checklistQuantity(entry)}` : ""}
                </Text>
                {entry.description ? (
                  <Text variant="footnote" tone="secondary">
                    {entry.description}
                  </Text>
                ) : null}
                {entry.sources?.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                    {entry.sources.map((source) => (
                      <Pressable
                        key={source.url}
                        accessibilityRole="link"
                        accessibilityLabel={`${source.name}: ${source.title}`}
                        onPress={() => {
                          haptic();
                          void WebBrowser.openBrowserAsync(source.url);
                        }}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.source,
                          { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceAlt : "transparent" },
                        ]}
                      >
                        <Text variant="caption" tone="secondary" style={{ fontWeight: "600" }}>
                          {source.name}
                        </Text>
                        <Icon name="external" size={10} color={theme.textTertiary} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, paddingBottom: spacing.md }}>
                {isAdded ? (
                  <Pill label="Added" tone="success" icon="check" />
                ) : isDismissed ? (
                  <>
                    <Pill label="Marked as registered" tone="neutral" icon="check" />
                    <Button
                      title="Undo"
                      size="small"
                      variant="ghost"
                      onPress={() => toggle.mutate({ name: entry.name, dismissed: false }, { onError: failed })}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      title="Add to registry"
                      icon="add"
                      size="small"
                      loading={adding === entry.key}
                      onPress={() => startAdding(entry, section.category)}
                    />
                    {/* Few rows need these, so they're in a "…" menu, as on the website. */}
                    <HeaderMenu
                      size="small"
                      accessibilityLabel={`More actions for ${entry.name}`}
                      title={entry.name}
                      choices={[
                        ...(canChoose
                          ? [
                              {
                                label: "Choose from your list",
                                icon: "list" as const,
                                onPress: () =>
                                  router.push({ pathname: "/registry/[id]/checklist-entry", params: { id, entry: entry.key } }),
                              },
                            ]
                          : []),
                        {
                          label: "Mark as registered",
                          icon: "check",
                          onPress: () => toggle.mutate({ name: entry.name, dismissed: true }, { onError: failed }),
                        },
                      ]}
                    />
                  </>
                )}
              </View>
              {isAdded ? (
                <View style={{ gap: 4, paddingBottom: spacing.md }}>
                  {here.map((thing) => (
                    <View key={thing.id} style={[styles.counted, { backgroundColor: theme.surfaceAlt }]}>
                      <Icon name={thing.kind === "fund" ? "fund" : "gift"} size={16} color={theme.textTertiary} />
                      <Text variant="footnote" style={{ flex: 1 }}>
                        {thing.title}
                      </Text>
                      <HeaderMenu
                        size="small"
                        accessibilityLabel={`Change what ${thing.title} counts for`}
                        title={thing.title}
                        choices={[
                          {
                            label: "Count for something else",
                            icon: "list",
                            onPress: () =>
                              router.push({
                                pathname: "/registry/[id]/checklist-entry",
                                params: { id, thing: thing.id, kind: thing.kind },
                              }),
                          },
                          {
                            label: "Don't count it",
                            icon: "close",
                            onPress: () =>
                              setEntry.mutate({ kind: thing.kind, id: thing.id, entry: CHECKLIST_NONE }, { onError: failed }),
                          },
                        ]}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  category: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 6,
  },
  categoryOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  item: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  itemLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  counted: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingLeft: spacing.sm,
  },
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  source: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  thingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
});
