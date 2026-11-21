// "Invite people you follow" on an event's guest list: the website's
// InviteFollowedDialog (src/components/invite-followed-dialog.tsx), in its
// words. It adds people who approved the host's follow, with the email on
// their account (events.inviteFollowedPeople). The host sees that email only
// when they follow each other (src/lib/guest-emails.ts).

import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { InvitablePerson } from "@shared/events-page-types";

import { Icon } from "@/components/icon";
import { Button, Card, Field, haptic, Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

/** Past this many people, the card offers a search box, like the website. */
const SEARCH_FROM = 8;

export function InviteFollowed({
  people,
  busy,
  onInvite,
  onClose,
}: {
  people: InvitablePerson[];
  busy: boolean;
  onInvite: (publicIds: string[]) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return words ? people.filter((person) => person.name.toLowerCase().includes(words)) : people;
  }, [people, query]);
  const available = people.filter((person) => !person.onList).length;

  function toggle(publicId: string) {
    haptic();
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  }

  return (
    <Card>
      <Text variant="headline">Invite people you follow</Text>
      <Text variant="footnote" tone="secondary">
        They&apos;re added to your guest list, and Regibee emails each one the invitation when you send it. You&apos;ll see
        the email of people who follow you back.
      </Text>
      {people.length >= SEARCH_FROM ? (
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search people you follow"
        />
      ) : null}
      {shown.length === 0 ? (
        <Text variant="footnote" tone="tertiary">
          Nobody you follow matches “{query.trim()}”.
        </Text>
      ) : (
        <View style={[styles.list, { borderColor: theme.border }]}>
          {shown.map((person) => {
            const selected = person.onList || chosen.has(person.publicId);
            return (
              <Pressable
                key={person.publicId}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: person.onList || busy }}
                disabled={person.onList || busy}
                onPress={() => toggle(person.publicId)}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceAlt : "transparent" }]}
              >
                <Icon
                  name={selected ? "checkbox" : "checkboxEmpty"}
                  size={22}
                  color={person.onList ? theme.textTertiary : selected ? theme.tint : theme.textTertiary}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="callout" tone={person.onList ? "tertiary" : undefined}>
                    {person.name}
                  </Text>
                  <Text variant="footnote" tone="tertiary">
                    {person.onList
                      ? "Already on the guest list"
                      : person.mutual
                        ? "You follow each other"
                        : "Their email stays private"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text variant="footnote" tone="tertiary">
        {available === 0 ? "Everyone you follow is on the list." : `${chosen.size} of ${available} chosen`}
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end" }}>
        <Button title="Cancel" size="small" variant="ghost" onPress={onClose} />
        <Button
          title={chosen.size === 0 ? "Add guests" : chosen.size === 1 ? "Add 1 guest" : `Add ${chosen.size} guests`}
          icon="personAdd"
          size="small"
          loading={busy}
          disabled={chosen.size === 0}
          onPress={() => onInvite([...chosen])}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
});
