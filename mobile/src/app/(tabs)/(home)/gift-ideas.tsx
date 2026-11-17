// The owner's gift ideas for other people, grouped by who they're for, like
// the website's Gift ideas page (src/components/gift-ideas.tsx). Only the
// owner can see them. The Registries tab shows them as one more list.

import { router, Stack } from "expo-router";
import { useMemo } from "react";
import { Alert, RefreshControl, SectionList, StyleSheet, View } from "react-native";

import { groupByRecipient, ideaCount, type GiftIdea } from "@shared/gift-ideas";

import { GiftIdeaRow, type GiftIdeaActions } from "@/components/gift-idea-row";
import { Icon } from "@/components/icon";
import { Button, Divider, EmptyState, ErrorState, IconButton, LoadingState, Text } from "@/components/ui";
import { errorMessage, useDeleteGiftIdea, useGiftIdeas, useSetGiftIdeaBought } from "@/lib/data";
import { GIFT_IDEAS } from "@/lib/last-registry";
import { fonts, radius, spacing, useTheme } from "@/lib/theme";

function addIdea(recipient?: string) {
  router.push({ pathname: "/add", params: recipient ? { registryId: GIFT_IDEAS, recipient } : { registryId: GIFT_IDEAS } });
}

export default function GiftIdeasScreen() {
  const theme = useTheme();
  const ideas = useGiftIdeas();
  const { mutate: setBought } = useSetGiftIdeaBought();
  const { mutate: removeIdea } = useDeleteGiftIdea();

  const sections = useMemo(
    () =>
      groupByRecipient(ideas.data ?? []).map((group) => ({
        key: group.key,
        name: group.name,
        summary: `${ideaCount(group.openCount)}${group.ideas.length > group.openCount ? ` · ${group.ideas.length - group.openCount} bought` : ""}`,
        data: group.ideas,
      })),
    [ideas.data]
  );

  const actions = useMemo<GiftIdeaActions>(
    () => ({
      setBought: (idea, bought) =>
        setBought({ idea, bought }, { onError: (e) => Alert.alert("That didn't save", errorMessage(e)) }),
      remove: (idea: GiftIdea) =>
        // The website's gift idea dialog asks the same (src/components/gift-idea-dialog.tsx).
        Alert.alert(`Delete “${idea.title}”? You can't undo this.`, undefined, [
          { text: "Keep it", style: "cancel" },
          {
            text: "Delete it",
            style: "destructive",
            onPress: () => removeIdea(idea, { onError: (e) => Alert.alert("Couldn't delete it", errorMessage(e)) }),
          },
        ]),
    }),
    // mutate is stable, so the rows don't all redraw while a change saves.
    [setBought, removeIdea]
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => <IconButton icon="add" accessibilityLabel="Save a gift idea" onPress={() => addIdea()} />,
        }}
      />
      <SectionList
        sections={sections}
        keyExtractor={(idea) => idea.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={ideas.isRefetching}
            onRefresh={() => {
              ideas.refetch();
            }}
            tintColor={theme.tint}
          />
        }
        ListHeaderComponent={
          sections.length > 0 ? (
            <View style={[styles.notice, { backgroundColor: theme.tintSoft }]}>
              <Icon name="lock" size={16} color={theme.tint} />
              <Text variant="footnote" tone="secondary" style={{ flex: 1 }}>
                Only you can see your gift ideas. The person they&apos;re for never does.
              </Text>
            </View>
          ) : undefined
        }
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="headline" numberOfLines={1} style={{ fontFamily: fonts.displayMedium }}>
                For {section.name}
              </Text>
              <Text variant="footnote" tone="tertiary">
                {section.summary}
              </Text>
            </View>
            <IconButton
              icon="add"
              size={18}
              accessibilityLabel={`Save a gift idea for ${section.name}`}
              onPress={() => addIdea(section.name)}
            />
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            style={[
              { marginHorizontal: spacing.lg, backgroundColor: theme.surface, borderColor: theme.border },
              styles.groupRow,
              index === 0 && styles.groupFirst,
              index === section.data.length - 1 && styles.groupLast,
            ]}
          >
            <GiftIdeaRow idea={item} actions={actions} />
            {index < section.data.length - 1 ? <Divider inset={92} /> : null}
          </View>
        )}
        ListEmptyComponent={
          ideas.isPending ? (
            <LoadingState />
          ) : ideas.isError ? (
            <ErrorState message={errorMessage(ideas.error)} onRetry={() => ideas.refetch()} />
          ) : (
            <EmptyState
              icon="lightbulb"
              title="No gift ideas yet"
              message="See something that would make a good gift for someone? Share it to Regibee from the store's app or your browser and pick Gift ideas, or paste its link here. Only you can see it."
              action={
                <View style={{ width: "100%", maxWidth: 320 }}>
                  <Button title="Save a gift idea" icon="add" onPress={() => addIdea()} />
                </View>
              }
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingLeft: spacing.lg + 4,
    paddingRight: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  groupRow: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  groupFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  groupLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
