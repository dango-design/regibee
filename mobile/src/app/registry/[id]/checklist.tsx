// The baby checklist: recommended items, which ones are on the list, and a
// button to add each. The website's checklist page
// (src/app/(protected)/dashboard/registry/[registryId]/checklist/page.tsx),
// with the same items, matching and words.

import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, SectionList, StyleSheet, View } from "react-native";

import { DEFAULT_CHECKLIST, type ChecklistItem } from "@shared/checklist-data";
import { matchedChecklistItems } from "@shared/checklist-matching";

import { Icon } from "@/components/icon";
import { Button, Chip, Divider, ErrorState, haptic, LoadingState, Pill, ProgressBar, Text } from "@/components/ui";
import { errorMessage, useAddChecklistItem, useRegistry, useToggleChecklistDismissed } from "@/lib/data";
import { radius, spacing, useTheme } from "@/lib/theme";

type Filter = "all" | "essential" | "not-added";

const ALL_NAMES = DEFAULT_CHECKLIST.flatMap((c) => c.items.map((i) => i.name));
const TOTAL = ALL_NAMES.length;

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const registry = useRegistry(id);
  const add = useAddChecklistItem(id);
  const toggle = useToggleChecklistDismissed(id);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);

  const detail = registry.data;
  const added = useMemo(
    () => matchedChecklistItems(ALL_NAMES, (detail?.items ?? []).map((i) => i.title)),
    [detail?.items]
  );
  const dismissed = useMemo(
    () =>
      new Set(
        ((detail?.registry.settings?.checklist_dismissed as string[] | undefined) ?? []).map((n) => n.toLowerCase())
      ),
    [detail?.registry.settings]
  );

  if (!detail) {
    return registry.isError ? (
      <ErrorState message={errorMessage(registry.error)} onRetry={() => registry.refetch()} />
    ) : (
      <LoadingState />
    );
  }

  const completed = (name: string) => added.has(name.toLowerCase()) || dismissed.has(name.toLowerCase());
  const addedCount = ALL_NAMES.filter(completed).length;
  const sections = DEFAULT_CHECKLIST.map((category) => {
    const items = category.items.filter((item) =>
      filter === "essential" ? item.isEssential : filter === "not-added" ? !completed(item.name) : true
    );
    return { category, items, data: expanded.has(category.name) ? items : [] };
  }).filter((s) => filter === "all" || s.items.length > 0);

  function addItem(categoryName: string, item: ChecklistItem) {
    const category = detail!.categories.find((c) => c.name === categoryName);
    setAdding(item.name);
    add.mutate(
      {
        name: item.name,
        categoryId: category?.id ?? null,
        quantity: item.suggestedQuantity,
        essential: item.isEssential,
        description: item.description,
      },
      {
        onSuccess: () => haptic("success"),
        onError: (e) => Alert.alert("Couldn't add it", errorMessage(e)),
        onSettled: () => setAdding(null),
      }
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Registry Checklist" }} />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.name}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <View style={{ gap: 6 }}>
              <Text variant="footnote" style={{ fontWeight: "600" }}>
                {addedCount} of {TOTAL} items added
              </Text>
              <ProgressBar value={addedCount / TOTAL} color={theme.success} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
              <Chip label="Essentials" selected={filter === "essential"} onPress={() => setFilter("essential")} />
              <Chip label="Not added" selected={filter === "not-added"} onPress={() => setFilter("not-added")} />
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                title="Expand All"
                size="small"
                variant="ghost"
                onPress={() => setExpanded(new Set(DEFAULT_CHECKLIST.map((c) => c.name)))}
              />
              <Button title="Collapse All" size="small" variant="ghost" onPress={() => setExpanded(new Set())} />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const { category } = section;
          const open = expanded.has(category.name);
          const done = category.items.filter((i) => completed(i.name)).length;
          const essentials = category.items.filter((i) => i.isEssential);
          const essentialsDone = essentials.filter((i) => completed(i.name)).length;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => {
                haptic();
                setExpanded((prev) => {
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
        renderItem={({ item, index, section }) => {
          const lower = item.name.toLowerCase();
          const isAdded = added.has(lower);
          const isDismissed = dismissed.has(lower);
          const done = isAdded || isDismissed;
          const last = index === section.data.length - 1;
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
                    {item.name}
                  </Text>
                  {item.isEssential ? <Pill label="Essential" tone="accent" /> : null}
                </View>
                <Text variant="footnote" tone="tertiary">
                  {item.suggestedPrice}
                  {item.suggestedQuantity > 1 ? ` · Qty: ${item.suggestedQuantity}` : ""}
                </Text>
                {item.description ? (
                  <Text variant="footnote" tone="secondary">
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingBottom: spacing.md }}>
                {isAdded ? (
                  <Pill label="Added" tone="success" icon="check" />
                ) : isDismissed ? (
                  <>
                    <Pill label="Manually mark as registered" tone="neutral" icon="check" />
                    <Button title="Undo" size="small" variant="ghost" onPress={() => toggle.mutate({ name: item.name, dismissed: false })} />
                  </>
                ) : (
                  <>
                    <Button
                      title="Add to registry"
                      icon="add"
                      size="small"
                      loading={adding === item.name}
                      onPress={() => addItem(section.category.name, item)}
                    />
                    <Button
                      title="Manually mark as registered"
                      size="small"
                      variant="ghost"
                      onPress={() =>
                        toggle.mutate(
                          { name: item.name, dismissed: true },
                          { onError: (e) => Alert.alert("Couldn't save that", errorMessage(e)) }
                        )
                      }
                    />
                  </>
                )}
              </View>
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
});
