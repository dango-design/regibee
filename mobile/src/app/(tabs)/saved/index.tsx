// The Saved tab, in the website's two views (src/components/saved-views.tsx):
// "For me", every item on every list you own, once each, with the lists it's
// on (src/components/saved-items.tsx); and "Gift ideas", gifts you might give
// other people, which only you can see (src/components/gift-ideas.tsx).

import { router, Stack } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { groupByRecipient, groupHeading, groupName, ideaCount, type GiftIdea } from "@shared/gift-ideas";
import type { SavedItem, SavedList } from "@shared/saved-items-types";

import { Icon } from "@/components/icon";
import { ItemImage } from "@/components/item-image";
import { Button, Chip, EmptyState, ErrorState, Field, haptic, IconButton, LoadingState, Pill, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { useSession } from "@/lib/auth";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import {
  setSavedNotice,
  storeDomain,
  useGiftIdeas,
  useSavedItems,
  useSavedNotice,
  useSetIdeaBought,
  useStartWishlist,
} from "@/lib/saved-data";
import { radius, spacing, useTheme } from "@/lib/theme";

type View_ = "items" | "ideas";

export default function SavedScreen() {
  const { demo } = useSession();
  const [view, setView] = useState<View_>("items");
  // The key of the person whose gift ideas are shown, or null for everyone's.
  // Ideas saved without a person have the key "". It's kept here so the +
  // button can start a new idea for that person, as the website does.
  const [person, setPerson] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);

  if (demo) {
    return (
      <EmptyState
        icon="bookmark"
        title="Saved is for accounts"
        message="Make an account to see everything on your lists in one place, and to keep private gift ideas for other people."
      />
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="add"
              accessibilityLabel={view === "items" ? "Save an item" : "Save a gift idea"}
              onPress={() =>
                view === "items"
                  ? router.push("/add")
                  : router.push(personName ? { pathname: "/idea", params: { recipient: personName } } : "/idea")
              }
            />
          ),
        }}
      />
      {view === "items" ? (
        <SavedItems view={view} onView={setView} />
      ) : (
        <GiftIdeas
          view={view}
          onView={setView}
          person={person}
          onPerson={(key, name) => {
            setPerson(key);
            setPersonName(name);
          }}
        />
      )}
    </>
  );
}

function ViewSwitch({ view, onView }: { view: View_; onView: (view: View_) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.segments, { backgroundColor: theme.surfaceAlt }]}>
      {(["items", "ideas"] as const).map((v) => {
        const selected = view === v;
        return (
          <Pressable
            key={v}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              haptic();
              onView(v);
            }}
            style={[styles.segment, selected && { backgroundColor: theme.surface }]}
          >
            <Text variant="subhead" style={{ fontWeight: selected ? "600" : "500", color: selected ? theme.text : theme.textSecondary }}>
              {v === "items" ? "For me" : "Gift ideas"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** What the last change did, read out by screen readers when it changes. */
function NoticeLine({ text }: { text: string }) {
  if (!text) return null;
  return (
    <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// For me
// ---------------------------------------------------------------------------

type Status = "wanted" | "gifted" | "all";

/** "Gifted" also holds the items you marked as having, as on the website. */
function matchesStatus(item: SavedItem, status: Status) {
  if (status === "all") return true;
  if (status === "wanted") return item.status === "wanted";
  return item.status !== "wanted";
}

function SavedItems({ view, onView }: { view: View_; onView: (view: View_) => void }) {
  const theme = useTheme();
  const saved = useSavedItems();
  const pull = usePullToRefresh(saved.refetch);
  const start = useStartWishlist();
  const notice = useSavedNotice("items");
  const [status, setStatus] = useState<Status>("wanted");
  const [search, setSearch] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startError, setStartError] = useState("");

  const data = saved.data;
  const listsById = useMemo(() => new Map((data?.lists ?? []).map((l) => [l.id, l])), [data?.lists]);
  const query = search.trim().toLowerCase();
  // The counts follow the search, as on the website.
  const matching = (data?.items ?? []).filter((i) => !query || i.title.toLowerCase().includes(query));
  const counts = {
    wanted: matching.filter((i) => matchesStatus(i, "wanted")).length,
    gifted: matching.filter((i) => matchesStatus(i, "gifted")).length,
    all: matching.length,
  };
  const shown = matching.filter((i) => matchesStatus(i, status));
  const hasOwnWishlist = (data?.lists ?? []).some((l) => l.isOwnWishlist);
  const hidesSome = (data?.lists ?? []).some((l) => l.hidesReservations);

  // The new wishlist shows here once the lists reload, as on the website.
  function startWishlist() {
    setStartError("");
    start.mutate(undefined, {
      onError: (e) => setStartError(errorMessage(e) || "Your wishlist wasn't made. Try again in a moment."),
    });
  }

  function bulk(mode: "add" | "remove") {
    if (selected.size === 0) return;
    setSavedNotice("items", "");
    router.push({ pathname: "/place-items", params: { mode, items: [...selected].join(",") } });
    setSelecting(false);
    setSelected(new Set());
  }

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
      <ViewSwitch view={view} onView={onView} />
      <Text variant="subhead" tone="secondary">
        Everything on your lists, in one place.
      </Text>
      {data && !hasOwnWishlist ? (
        <View style={[styles.callout, { backgroundColor: theme.tintSoft }]}>
          <Text variant="headline">Start your wishlist</Text>
          <Text variant="footnote" tone="secondary">
            One list for birthdays, Christmas and any other day.{" "}
            {data.lists.length > 0
              ? "Save things to it as you find them, and put them on your other lists too."
              : "Save things to it as you find them, and family and friends always know what you'd love."}
          </Text>
          {startError ? (
            <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
              {startError}
            </Text>
          ) : null}
          <Button title="Start my wishlist" size="medium" loading={start.isPending} onPress={startWishlist} />
        </View>
      ) : null}
      {data && data.items.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <Chip label={`Still wanted ${counts.wanted}`} selected={status === "wanted"} onPress={() => setStatus("wanted")} />
            <Chip label={`Gifted ${counts.gifted}`} selected={status === "gifted"} onPress={() => setStatus("gifted")} />
            <Chip label={`All ${counts.all}`} selected={status === "all"} onPress={() => setStatus("all")} />
          </ScrollView>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Field
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name"
                leading={<Icon name="search" size={16} color={theme.textTertiary} />}
                returnKeyType="search"
                accessibilityLabel="Search your saved items"
              />
            </View>
            <Button
              title={selecting ? "Done" : "Select"}
              size="small"
              variant="ghost"
              onPress={() => {
                setSelecting(!selecting);
                setSelected(new Set());
              }}
            />
          </View>
          {hidesSome ? (
            <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
              <Icon name="eyeSlash" size={15} color={theme.textTertiary} />
              <Text variant="footnote" tone="tertiary" style={{ flex: 1 }}>
                On lists where you hide what&apos;s been reserved, items show as still wanted.
              </Text>
            </View>
          ) : null}
          {selecting ? (
            <Button
              title={shown.every((i) => selected.has(i.id)) && shown.length > 0 ? "Select none" : "Select all shown"}
              size="small"
              variant="ghost"
              onPress={() =>
                setSelected(shown.every((i) => selected.has(i.id)) ? new Set() : new Set(shown.map((i) => i.id)))
              }
            />
          ) : null}
          <NoticeLine text={notice} />
        </>
      ) : (
        <NoticeLine text={notice} />
      )}
    </View>
  );

  let noMatches = "";
  if (query) noMatches = `Nothing matches “${search.trim()}”.`;
  else if (status === "wanted") noMatches = "Nothing still wanted. Everything is gifted or you have it.";
  else if (status === "gifted") noMatches = "No gifts yet.";

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: selecting ? 160 : 120, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            {...pull}
            tintColor={theme.tint}
          />
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <SavedItemRow
            item={item}
            lists={item.listIds.map((id) => listsById.get(id)).filter((l): l is SavedList => Boolean(l))}
            selecting={selecting}
            selected={selected.has(item.id)}
            onPress={() => {
              if (selecting) {
                const next = new Set(selected);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                setSelected(next);
              } else {
                setSavedNotice("items", "");
                router.push({ pathname: "/saved-item", params: { id: item.id } });
              }
            }}
          />
        )}
        ListEmptyComponent={
          saved.isPending ? (
            <LoadingState />
          ) : saved.isError ? (
            <ErrorState message={errorMessage(saved.error)} onRetry={() => saved.refetch()} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon="bookmark"
              title="Nothing saved yet"
              message={
                (data?.lists.length ?? 0) > 0
                  ? "Found something you'd love? Share it to Regibee from any store's app, or tap + to save it."
                  : "Start your wishlist, then save things to it as you find them."
              }
            />
          ) : (
            <EmptyState
              icon="search"
              title={noMatches}
              action={
                <Button
                  title="Show everything"
                  variant="secondary"
                  size="medium"
                  onPress={() => {
                    setStatus("all");
                    setSearch("");
                  }}
                />
              }
            />
          )
        }
      />
      {selecting ? (
        <View style={[styles.toolbar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <Text variant="footnote" tone="secondary">
            {selected.size} selected
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button title="Add to list…" size="small" disabled={selected.size === 0} onPress={() => bulk("add")} />
            <Button title="Remove from list…" size="small" variant="secondary" disabled={selected.size === 0} onPress={() => bulk("remove")} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SavedItemRow({
  item,
  lists,
  selecting,
  selected,
  onPress,
}: {
  item: SavedItem;
  lists: SavedList[];
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const meta = [item.price != null ? formatPrice(item.price) : null, storeDomain(item.externalUrl)].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole={selecting ? "checkbox" : "button"}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityHint={selecting ? undefined : "Opens the lists it's on"}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.surfaceAlt : theme.surface, borderColor: selected ? theme.tint : theme.border },
      ]}
    >
      {selecting ? <Icon name={selected ? "checkbox" : "checkboxEmpty"} size={22} color={selected ? theme.tint : theme.textTertiary} /> : null}
      <ItemImage uri={item.imageUrl} size={56} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="subhead" numberOfLines={2} style={{ fontWeight: "500" }}>
          {item.title}
        </Text>
        {meta ? (
          <Text variant="footnote" tone="tertiary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {item.status !== "wanted" ? (
          <View style={{ flexDirection: "row" }}>
            {item.status === "gifted" ? <Pill label="Gifted" tone="success" /> : <Pill label="You have it" tone="neutral" />}
          </View>
        ) : null}
        {/* Each list's name opens that list, as on the website. While
            choosing items a tap anywhere picks the item instead. */}
        <View accessibilityLabel="On these lists" style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {lists.map((list) =>
            selecting ? (
              <View key={list.id} style={[styles.listChip, { backgroundColor: theme.surfaceAlt }]}>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {list.title}
                </Text>
              </View>
            ) : (
              <Pressable
                key={list.id}
                accessibilityRole="link"
                accessibilityLabel={`Open ${list.title}`}
                hitSlop={4}
                onPress={() => {
                  haptic();
                  router.push({ pathname: "/registry/[id]", params: { id: list.id } });
                }}
                style={({ pressed }) => [styles.listChip, { backgroundColor: theme.surfaceAlt, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {list.title}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>
      {!selecting ? <Icon name="chevronRight" size={14} color={theme.textTertiary} /> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Gift ideas
// ---------------------------------------------------------------------------

function GiftIdeas({
  view,
  onView,
  person,
  onPerson,
}: {
  view: View_;
  onView: (view: View_) => void;
  /** The key of the person whose ideas are shown, or null for everyone's. */
  person: string | null;
  /** Hears the person's key and their name as typed. Both null for everyone. */
  onPerson: (key: string | null, name: string | null) => void;
}) {
  const theme = useTheme();
  const ideas = useGiftIdeas();
  const pull = usePullToRefresh(ideas.refetch);
  const bought = useSetIdeaBought();
  const notice = useSavedNotice("ideas");
  const groups = useMemo(() => groupByRecipient(ideas.data ?? []), [ideas.data]);
  // A person whose last idea was deleted drops back to everyone.
  const chosen = person === null ? null : (groups.find((g) => g.key === person) ?? null);
  const shownGroups = chosen ? [chosen] : groups;

  return (
    <FlatList
      data={shownGroups}
      keyExtractor={(g) => `person:${g.key}`}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120, flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          {...pull}
          tintColor={theme.tint}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: spacing.md }}>
          <ViewSwitch view={view} onView={onView} />
          <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
            <Icon name="lock" size={15} color={theme.textSecondary} />
            <Text variant="subhead" tone="secondary" style={{ flex: 1 }}>
              Gifts you might give other people. Only you can see these.
            </Text>
          </View>
          {groups.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              <Chip
                label={`Everyone ${(ideas.data ?? []).filter((i) => !i.boughtAt).length}`}
                selected={!chosen}
                onPress={() => onPerson(null, null)}
              />
              {groups.map((g) => (
                <Chip
                  key={g.key}
                  label={`${groupName(g)} ${g.openCount}`}
                  selected={chosen?.key === g.key}
                  onPress={() => onPerson(g.key, g.name || null)}
                />
              ))}
            </ScrollView>
          ) : null}
          <NoticeLine text={notice} />
        </View>
      }
      renderItem={({ item: group }) => {
        const boughtCount = group.ideas.length - group.openCount;
        return (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="headline" numberOfLines={1}>
                  {groupHeading(group)}
                </Text>
                <Text variant="footnote" tone="tertiary">
                  {ideaCount(group.openCount)}
                  {boughtCount > 0 ? ` · ${boughtCount} bought` : ""}
                </Text>
              </View>
              <Button
                title="Add an idea"
                icon="add"
                size="small"
                variant="ghost"
                accessibilityLabel={group.key ? `Add an idea for ${group.name}` : "Add an idea"}
                onPress={() => {
                  setSavedNotice("ideas", "");
                  router.push({ pathname: "/idea", params: { recipient: group.name } });
                }}
              />
            </View>
            {group.ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                saving={bought.isPending && bought.variables?.id === idea.id}
                onBought={(on) => {
                  setSavedNotice("ideas", "");
                  bought.mutate(
                    { id: idea.id, bought: on },
                    { onError: (e) => setSavedNotice("ideas", errorMessage(e) || "That didn't save. Try again in a moment.") }
                  );
                }}
              />
            ))}
          </View>
        );
      }}
      ListEmptyComponent={
        ideas.isPending ? (
          <LoadingState />
        ) : ideas.isError ? (
          <ErrorState message={errorMessage(ideas.error)} onRetry={() => ideas.refetch()} />
        ) : (
          <EmptyState
            icon="sparkles"
            title="No gift ideas yet"
            message="See something that would make a good gift for someone? Save it here to think about before their next birthday or holiday. Only you can see it."
            action={<Button title="Save a gift idea" icon="add" onPress={() => router.push("/idea")} />}
          />
        )
      }
    />
  );
}

function IdeaCard({ idea, saving, onBought }: { idea: GiftIdea; saving: boolean; onBought: (bought: boolean) => void }) {
  const theme = useTheme();
  const bought = Boolean(idea.boughtAt);
  const meta = [idea.price != null ? formatPrice(idea.price) : null, storeDomain(idea.externalUrl)].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the idea to edit it"
      onPress={() => {
        setSavedNotice("ideas", "");
        router.push({ pathname: "/idea", params: { id: idea.id } });
      }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.surfaceAlt : theme.surface, borderColor: theme.border, opacity: bought ? 0.6 : 1 },
      ]}
    >
      <ItemImage uri={idea.imageUrl} size={56} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          variant="subhead"
          numberOfLines={2}
          style={{ fontWeight: "500", textDecorationLine: bought ? "line-through" : "none" }}
          onPress={idea.externalUrl ? () => WebBrowser.openBrowserAsync(idea.externalUrl!) : undefined}
        >
          {idea.title}
        </Text>
        {meta ? (
          <Text variant="footnote" tone="tertiary" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {idea.notes ? (
          <Text variant="footnote" tone="secondary" numberOfLines={3}>
            {idea.notes}
          </Text>
        ) : null}
        {bought ? (
          <View style={{ flexDirection: "row" }}>
            <Pill label="Bought" tone="success" />
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Bought it: ${idea.title}`}
        accessibilityState={{ checked: bought, busy: saving }}
        hitSlop={10}
        disabled={saving}
        onPress={() => {
          haptic("success");
          onBought(!bought);
        }}
        style={{ alignItems: "center", gap: 2 }}
      >
        <Icon name={bought ? "checkbox" : "checkboxEmpty"} size={24} color={bought ? theme.success : theme.textTertiary} />
        <Text variant="caption" tone="tertiary">
          {saving ? "Saving…" : "Bought it"}
        </Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: "row", borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, height: 36, borderRadius: radius.sm + 1, alignItems: "center", justifyContent: "center" },
  callout: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listChip: { maxWidth: 160, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  toolbar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 96,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
