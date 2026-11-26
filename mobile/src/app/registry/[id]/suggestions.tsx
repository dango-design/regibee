// The Suggestions Inbox: items guests suggested, or offered to give, from the
// list's page. The website's tab (src/app/(protected)/dashboard/registry/[registryId]/suggestion-inbox.tsx)
// in the same words, with the same actions.

import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, FlatList, Linking, RefreshControl, ScrollView, View } from "react-native";

import { Button, Card, Chip, EmptyState, ErrorState, haptic, LoadingState, Pill, Text } from "@/components/ui";
import { errorMessage, useAnswerSuggestion, useRegistry, type SuggestionAction } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { spacing, useTheme } from "@/lib/theme";
import type { Suggestion } from "@/lib/types";

type Filter = "all" | Suggestion["status"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "offering", label: "Offering" },
  { value: "added", label: "Added" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

const TAG_LABELS: Record<Suggestion["status"], string> = {
  pending: "Pending",
  offering: "Offering to gift",
  added: "Added",
  accepted: "Accepted",
  declined: "Declined",
};

const TAG_TONES = {
  pending: "accent",
  offering: "tint",
  added: "success",
  accepted: "success",
  declined: "neutral",
} as const;

export default function SuggestionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const registry = useRegistry(id);
  const pull = usePullToRefresh(registry.refetch);
  const answer = useAnswerSuggestion(id);
  const [filter, setFilter] = useState<Filter>("all");
  const suggestions = registry.data?.suggestions ?? [];
  const shown = filter === "all" ? suggestions : suggestions.filter((s) => s.status === filter);
  const count = (value: Filter) => (value === "all" ? suggestions.length : suggestions.filter((s) => s.status === value).length);

  function run(suggestion: Suggestion, action: SuggestionAction) {
    haptic("success");
    answer.mutate(
      { suggestionId: suggestion.id, action },
      { onError: (e) => Alert.alert("Couldn't save that", errorMessage(e)) }
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Suggestions Inbox" }} />
      <FlatList
        data={shown}
        keyExtractor={(s) => s.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80, flexGrow: 1 }}
        refreshControl={
          <RefreshControl {...pull} tintColor={theme.tint} />
        }
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            {suggestions.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {FILTERS.map((f) => (
                  <Chip key={f.value} label={`${f.label} ${count(f.value)}`} selected={filter === f.value} onPress={() => setFilter(f.value)} />
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
        renderItem={({ item: suggestion }) => (
          <Card>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                <Text variant="headline" style={{ flex: 1 }}>
                  {suggestion.title}
                </Text>
                <Pill label={TAG_LABELS[suggestion.status]} tone={TAG_TONES[suggestion.status]} />
              </View>
              <Text variant="caption" tone="tertiary">
                {new Date(suggestion.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            </View>
            {suggestion.price ? (
              <Text variant="subhead" style={{ fontWeight: "600" }}>
                {formatPrice(suggestion.price)}
              </Text>
            ) : null}
            <Text variant="footnote" tone="secondary">
              Suggested by {suggestion.suggested_by_name}
              {suggestion.suggested_by_email ? (
                <Text
                  variant="footnote"
                  tone="tint"
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(`mailto:${suggestion.suggested_by_email}`)}
                >
                  {` · ${suggestion.suggested_by_email}`}
                </Text>
              ) : null}
            </Text>
            {suggestion.notes ? (
              <Text variant="footnote" tone="secondary" style={{ fontStyle: "italic" }}>
                “{suggestion.notes}”
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {suggestion.external_url ? (
                <Button
                  title="Shop"
                  icon="external"
                  size="small"
                  variant="secondary"
                  onPress={() => WebBrowser.openBrowserAsync(suggestion.external_url!)}
                />
              ) : null}
              <View style={{ flex: 1 }} />
              {suggestion.status === "pending" || suggestion.status === "offering" ? (
                <>
                  <Button title="Decline" size="small" variant="ghost" onPress={() => run(suggestion, "decline")} />
                  <Button
                    title={suggestion.status === "pending" ? "Add to registry" : "Accept offering"}
                    size="small"
                    onPress={() => run(suggestion, suggestion.status === "pending" ? "add" : "accept")}
                  />
                </>
              ) : null}
            </View>
          </Card>
        )}
        ListEmptyComponent={
          registry.isPending ? (
            <LoadingState />
          ) : registry.isError ? (
            <ErrorState message={errorMessage(registry.error)} onRetry={() => registry.refetch()} />
          ) : suggestions.length === 0 ? (
            <EmptyState icon="inbox" title="No suggestions yet" />
          ) : (
            <EmptyState icon="inbox" title={`No ${filter} suggestions.`} />
          )
        }
      />
    </>
  );
}
