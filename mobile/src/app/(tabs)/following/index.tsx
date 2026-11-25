// The Following tab: finding people, birthdays coming up, lists shared with
// your groups, and the lists of people who approved your follow. The
// website's (src/components/following-feed.tsx, people-search.tsx and
// birthdays-coming-up.tsx), from the same loader (src/lib/people-page.ts).
// Other people's lists and profiles open on the website, as guests see them.

import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";

import { looksLikeEmail } from "@shared/email-address";
import { birthdayCountdown, formatBirthdayDate, sortBirthdays } from "@shared/gift-profile";
import { profilePath, displayName } from "@shared/profile-link";
import { isPastEvent, sortListedRegistries, type ListedRegistry } from "@shared/registry-listing";
import { occasionLabel } from "@shared/registry-copy";

import { NavRow } from "@/components/nav-row";
import { Button, Card, Divider, EmptyState, ErrorState, Field, haptic, LoadingState, Pill, Section, Text } from "@/components/ui";
import { Icon } from "@/components/icon";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { searchPeople, useFollowingTab, useRunPeopleAction, type SearchResult } from "@/lib/people-data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { spacing, useTheme } from "@/lib/theme";
import { openSite } from "@/lib/web";
import { OpenLinkCard } from "@/components/open-link-card";

const MIN_NAME_LENGTH = 3;

const open = (path: string) => openSite(path);

export default function FollowingScreen() {
  const theme = useTheme();
  const { demo } = useSession();
  const tab = useFollowingTab();
  const pull = usePullToRefresh(tab.refetch);

  if (demo) {
    return (
      <EmptyState
        icon="people"
        title="Following is for accounts"
        message="Make an account to follow friends and family, see their registries, and get reminded before their birthdays."
      />
    );
  }

  const data = tab.data;
  const approved = data?.people.filter((p) => p.status === "approved") ?? [];
  const waiting = data?.people.filter((p) => p.status === "pending") ?? [];
  const sorted = data ? sortListedRegistries(data.registries, data.today) : [];
  const groups = data
    ? [
        { title: "Coming up", registries: sorted.filter((r) => r.event_date !== null && !isPastEvent(r, data.today)) },
        { title: "Anytime", registries: sorted.filter((r) => r.event_date === null) },
        { title: "Past events", registries: sorted.filter((r) => isPastEvent(r, data.today)) },
      ]
    : [];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          {...pull}
          tintColor={theme.tint}
        />
      }
    >
      <Text variant="subhead" tone="secondary">
        Registries from people who&apos;ve approved your follow.
      </Text>
      <PeopleSearch />
      <OpenLinkCard />

      {!data ? (
        tab.isError ? (
          <ErrorState message={errorMessage(tab.error)} onRetry={() => tab.refetch()} />
        ) : (
          <LoadingState />
        )
      ) : (
        <>
          {data.birthdays.length > 0 ? (
            <Section title="Birthdays coming up">
              {sortBirthdays(data.birthdays).map((birthday, index) => (
                <View key={birthday.key}>
                  {index > 0 ? <Divider inset={52} /> : null}
                  <NavRow
                    icon="cake"
                    label={birthday.parentName ? `${birthday.name} · ${birthday.parentName}'s list` : birthday.name}
                    detail={`${birthdayCountdown(birthday.date, data.today)} · ${formatBirthdayDate(birthday.date)}`}
                    external
                    onPress={() => open(birthday.href)}
                  />
                </View>
              ))}
            </Section>
          ) : null}

          {data.shared.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="title" style={{ fontSize: 20 }}>
                Shared with your groups
              </Text>
              {sortListedRegistries(data.shared, data.today).map((registry) => (
                <RegistryCard
                  key={registry.slug}
                  registry={registry}
                  owner={displayName(registry.owner)}
                  today={data.today}
                  extra={registry.groupNames.join(", ")}
                  privateLabel="Your group only"
                />
              ))}
            </View>
          ) : null}

          {data.people.length === 0 ? (
            <EmptyState
              icon="people"
              title="You're not following anyone yet"
              message="Search for friends above by name or email, or open their profile link and tap Follow. Once they approve, their registries show up here."
            />
          ) : (
            <>
              {data.registries.length === 0 ? (
                <EmptyState
                  icon="gift"
                  title="No registries yet"
                  message={
                    approved.length === 0
                      ? "Their registries will show up here once they approve your follow."
                      : "The people you follow haven't shared any registries on their profiles yet."
                  }
                />
              ) : (
                groups
                  .filter((g) => g.registries.length > 0)
                  .map((group) => (
                    <View key={group.title} style={{ gap: spacing.sm }}>
                      <Text variant="title" style={{ fontSize: 20 }}>
                        {group.title}
                      </Text>
                      {group.registries.map((registry) => (
                        <RegistryCard key={registry.slug} registry={registry} owner={displayName(registry.owner)} today={data.today} />
                      ))}
                    </View>
                  ))
              )}

              <Section title="People you follow" footer="Manage who you follow on your Account tab.">
                {[...approved, ...waiting].map((person, index) => (
                  <View key={person.public_id}>
                    {index > 0 ? <Divider inset={52} /> : null}
                    <NavRow
                      icon="person"
                      label={`${displayName(person)}${person.mutual ? " · Friends" : ""}`}
                      detail={person.status === "pending" ? "Waiting for approval" : undefined}
                      external
                      onPress={() => open(profilePath(person))}
                    />
                  </View>
                ))}
              </Section>
              <Button title="Manage who you follow" variant="ghost" size="small" onPress={() => router.push("/account/follows")} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function RegistryCard({
  registry,
  owner,
  today,
  extra,
  privateLabel = "Followers only",
}: {
  registry: ListedRegistry;
  owner: string;
  today: string;
  extra?: string;
  /** The badge on a list that isn't public: who can see it. */
  privateLabel?: string;
}) {
  const theme = useTheme();
  const past = isPastEvent(registry, today);
  return (
    <Card onPress={() => open(`/r/${registry.slug}`)} accessibilityRole="button" style={{ opacity: past ? 0.7 : 1 }}>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="headline">{registry.title}</Text>
          <Text variant="footnote" tone="secondary">
            {owner}
            {extra ? ` · ${extra}` : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill label={occasionLabel(registry.registry_type ?? "baby", registry.event_type)} tone="accent" />
            {registry.event_date ? (
              <Pill
                label={new Date(`${registry.event_date}T00:00:00`).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                tone="tint"
                icon="calendar"
              />
            ) : null}
            {!registry.is_public ? <Pill label={privateLabel} tone="neutral" icon="lock" /> : null}
            {past ? <Pill label="Past" tone="neutral" /> : null}
          </View>
        </View>
        <Icon name="external" size={15} color={theme.textTertiary} />
      </View>
    </Card>
  );
}

/** "Find people": the website's PeopleSearch. */
function PeopleSearch() {
  const theme = useTheme();
  const { run } = useRunPeopleAction();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ query: string; kind?: "name" | "email"; list: SearchResult[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<"idle" | "sending" | "sent">("idle");
  // Counts searches, so an answer that arrives after a newer search started
  // is ignored, as on the website.
  const latest = useRef(0);
  const isEmailQuery = query.includes("@");

  async function search(text: string) {
    const request = ++latest.current;
    setSearching(true);
    setError(null);
    setInvite("idle");
    try {
      const response = await searchPeople(text);
      if (request !== latest.current) return;
      setResults({ query: text.trim(), kind: response.kind, list: response.results });
    } catch (e) {
      if (request !== latest.current) return;
      setError(errorMessage(e));
    } finally {
      if (request === latest.current) setSearching(false);
    }
  }

  // Names search as you type, after a pause. Email addresses wait for Look up.
  useEffect(() => {
    if (isEmailQuery || query.trim().length < MIN_NAME_LENGTH) return;
    const timer = setTimeout(() => search(query), 350);
    return () => clearTimeout(timer);
  }, [query, isEmailQuery]);

  let hint = "Search by name, or type someone's whole email address and press Look up.";
  if (isEmailQuery) {
    hint = looksLikeEmail(query) ? "Tap Look up to look up this email address." : "Type the whole email address, then tap Look up.";
  }
  const showEmpty = results && results.list.length === 0 && !searching;

  async function follow(person: SearchResult) {
    const name = displayName(person);
    const go = async (action: string, next: SearchResult["state"]) => {
      try {
        await run(action, person.public_id);
        haptic("success");
        setResults((r) =>
          r ? { ...r, list: r.list.map((p) => (p.public_id === person.public_id ? { ...p, state: next } : p)) } : r
        );
      } catch (e) {
        Alert.alert("That didn't work", errorMessage(e));
      }
    };
    // Someone you already follow shows as "Following" with no button, as on
    // the website. Unfollowing is on the Account tab.
    if (person.state === "none") go("follows.requestFollow", "pending");
    else if (person.state === "pending")
      Alert.alert(`Withdraw your request to follow ${name}?`, undefined, [
        { text: "Keep it", style: "cancel" },
        { text: "Withdraw", style: "destructive", onPress: () => go("follows.cancelFollow", "none") },
      ]);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Find people"
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              // An email address is looked up only when it's whole, so what
              // showed for the last one goes as soon as it changes. So does
              // everything once the text is too short to search, as on the website.
              if (text.includes("@") || text.trim().length < MIN_NAME_LENGTH) {
                latest.current++;
                setSearching(false);
                setResults(null);
                setError(null);
                setInvite("idle");
              }
            }}
            placeholder="Name or email address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => (isEmailQuery ? looksLikeEmail(query) : query.trim().length >= MIN_NAME_LENGTH) && search(query)}
          />
        </View>
        {isEmailQuery ? (
          <Button title="Look up" size="medium" variant="secondary" disabled={!looksLikeEmail(query) || searching} onPress={() => search(query)} />
        ) : null}
      </View>
      <Text variant="footnote" tone="tertiary">
        {hint}
      </Text>
      {searching ? (
        <Text variant="footnote" tone="tertiary">
          Searching...
        </Text>
      ) : null}
      {error ? (
        <Text variant="footnote" tone="danger">
          {error}
        </Text>
      ) : null}
      {showEmpty && results.kind !== "email" ? (
        <Text variant="footnote" tone="tertiary">
          No one found. Try their email address, or ask them for their profile link.
        </Text>
      ) : null}
      {showEmpty && results.kind === "email" ? (
        <Card>
          {invite === "sent" ? (
            <Text variant="footnote" tone="secondary">
              Invite sent to <Text variant="footnote" style={{ fontWeight: "600" }}>{results.query}</Text>. If they say yes,
              you&apos;ll follow them.
            </Text>
          ) : (
            <>
              <Text variant="footnote" tone="secondary">
                No one has made their account findable with{" "}
                <Text variant="footnote" style={{ fontWeight: "600" }}>
                  {results.query}
                </Text>
                . Invite them, and if they say yes, you&apos;ll follow them.
              </Text>
              <Button
                title="Send invite"
                size="small"
                loading={invite === "sending"}
                onPress={async () => {
                  setInvite("sending");
                  try {
                    await run("followInvites.sendFollowInvite", results.query);
                    setInvite("sent");
                    haptic("success");
                  } catch (e) {
                    setInvite("idle");
                    setError(errorMessage(e));
                  }
                }}
              />
            </>
          )}
        </Card>
      ) : null}
      {results && results.list.length > 0 ? (
        <Section>
          {results.list.map((person, index) => (
            <View key={person.public_id}>
              {index > 0 ? <Divider inset={spacing.lg} /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="subhead" style={{ fontWeight: "600" }} accessibilityRole="link" onPress={() => open(profilePath(person))}>
                    {displayName(person)}
                  </Text>
                  {/* The line under the name, in the website's words. */}
                  <Text variant="footnote" tone="tertiary">
                    {person.state === "self"
                      ? "That's you"
                      : person.state === "none"
                        ? "Approves every follower"
                        : person.state === "approved"
                          ? "You can see their private registries"
                          : "Waiting for approval · "}
                    {person.state === "pending" ? (
                      <Text
                        variant="footnote"
                        tone="tint"
                        style={{ fontWeight: "600" }}
                        accessibilityRole="button"
                        accessibilityLabel={`Withdraw your request to follow ${displayName(person)}`}
                        onPress={() => follow(person)}
                      >
                        Withdraw
                      </Text>
                    ) : null}
                  </Text>
                </View>
                {person.state === "self" ? null : person.state === "approved" ? (
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    <Icon name="check" size={13} color={theme.textTertiary} />
                    <Text variant="footnote" tone="tertiary">
                      Following
                    </Text>
                  </View>
                ) : (
                  <Button
                    title={person.state === "none" ? "Follow" : "Requested"}
                    size="small"
                    variant={person.state === "none" ? "primary" : "secondary"}
                    onPress={() => follow(person)}
                  />
                )}
              </View>
            </View>
          ))}
        </Section>
      ) : null}
      <Text variant="caption" tone="tertiary">
        Only people who let others find them appear here. Email addresses are never shown.
      </Text>
    </View>
  );
}
