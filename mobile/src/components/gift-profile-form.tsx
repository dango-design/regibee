// Birthday, sizes, colors, likes, things to skip and notes, for gift givers.
// The website's GiftProfileForm (src/components/gift-profile-form.tsx), with
// the same rules (src/lib/gift-profile.ts). It's on the Account tab for your
// own profile, and in a child's list's settings for theirs.

import { useState } from "react";
import { ScrollView, View } from "react-native";

import {
  BIRTHDAY_REMINDER_DAYS,
  daysInMonth,
  MAX_SIZE_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TEXT_LENGTH,
  MONTH_OPTIONS,
  parseGiftProfile,
  SIZE_LABELS,
  type GiftProfile,
  type GiftProfileSizes,
} from "@shared/gift-profile";

import { Icon } from "@/components/icon";
import { Button, Chip, Field, haptic, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { spacing, useTheme } from "@/lib/theme";

const SIZE_FIELDS: { key: keyof GiftProfileSizes; placeholder: string }[] = [
  { key: "tops", placeholder: "M" },
  { key: "bottoms", placeholder: "32 x 30" },
  { key: "shoes", placeholder: "9" },
  { key: "other", placeholder: "Ring 7, hat L" },
];

/** Adds tags to a list, skipping blanks and repeats, up to the limit. */
function addTags(tags: string[], entries: string[]): string[] {
  const next = [...tags];
  const seen = new Set(next.map((tag) => tag.toLowerCase()));
  for (const entry of entries.flatMap((e) => e.split(","))) {
    const tag = entry.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    if (next.length >= MAX_TAGS) break;
    seen.add(tag.toLowerCase());
    next.push(tag);
  }
  return next;
}

function TagField({
  label,
  hint,
  placeholder,
  tags,
  onTagsChange,
  draft,
  onDraftChange,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  draft: string;
  onDraftChange: (draft: string) => void;
}) {
  const full = tags.length >= MAX_TAGS;
  return (
    <View style={{ gap: spacing.sm }}>
      <Field
        label={label}
        value={draft}
        onChangeText={(text) => {
          if (text.includes(",")) {
            onTagsChange(addTags(tags, [text]));
            onDraftChange("");
          } else {
            onDraftChange(text);
          }
        }}
        onSubmitEditing={() => {
          onTagsChange(addTags(tags, [draft]));
          onDraftChange("");
        }}
        submitBehavior="submit"
        returnKeyType="done"
        placeholder={full ? undefined : placeholder}
        maxLength={MAX_TAG_LENGTH}
        editable={!full}
        hint={full ? `That's the most you can add (${MAX_TAGS}).` : hint}
      />
      {tags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {tags.map((tag) => (
            <Chip key={tag} label={`${tag}  ✕`} selected={false} onPress={() => onTagsChange(tags.filter((t) => t !== tag))} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function GiftProfileForm({
  initial,
  onSave,
  child,
}: {
  initial: GiftProfile;
  onSave: (profile: GiftProfile) => Promise<unknown>;
  /** Set for a list kept for a child: whose profile this is. */
  child?: { name?: string | null };
}) {
  const [month, setMonth] = useState<number | null>(initial.birthday?.month ?? null);
  const [day, setDay] = useState<number | null>(initial.birthday?.day ?? null);
  const [sizes, setSizes] = useState<GiftProfileSizes>(initial.sizes ?? {});
  const [colors, setColors] = useState(initial.colors ?? "");
  const [likes, setLikes] = useState<string[]>(initial.likes ?? []);
  const [likeDraft, setLikeDraft] = useState("");
  const [skip, setSkip] = useState<string[]>(initial.skip ?? []);
  const [skipDraft, setSkipDraft] = useState("");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const theme = useTheme();

  const childName = child?.name?.trim() || null;
  // "Toto's birthday" for a child's list, "Birthday" for your own.
  const title = (label: string) =>
    child ? `${childName ? `${childName}'s` : "Your child's"} ${label.toLowerCase()}` : label;
  const whose = childName ? `${childName}'s` : "your child's";
  const days = month ? daysInMonth(month) : 31;

  async function save() {
    setError("");
    setSaved(false);
    if (Boolean(month) !== Boolean(day)) {
      setError(month ? "Pick a day for the birthday too." : "Pick a month for the birthday too.");
      return;
    }
    // Keep anything typed in a tag box that wasn't added yet.
    const allLikes = addTags(likes, [likeDraft]);
    const allSkip = addTags(skip, [skipDraft]);
    setLikes(allLikes);
    setSkip(allSkip);
    setLikeDraft("");
    setSkipDraft("");
    const profile = parseGiftProfile({
      birthday: month && day ? { month, day } : null,
      sizes,
      colors,
      likes: allLikes,
      skip: allSkip,
      notes,
    });
    setSaving(true);
    try {
      await onSave(profile);
      setSaved(true);
      // "Saved" shows for a moment, as on the website.
      setTimeout(() => setSaved(false), 2000);
      haptic("success");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
          {title("Birthday")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {MONTH_OPTIONS.map((m) => (
            <Chip
              key={m.value}
              label={m.label}
              selected={month === m.value}
              onPress={() => {
                const next = month === m.value ? null : m.value;
                setMonth(next);
                setSaved(false);
                if (day && next && day > daysInMonth(next)) setDay(null);
              }}
            />
          ))}
        </ScrollView>
        {month ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
              <Chip key={d} label={String(d)} selected={day === d} onPress={() => setDay(day === d ? null : d)} />
            ))}
          </ScrollView>
        ) : null}
        <Text variant="footnote" tone="tertiary">
          {child
            ? `Only you and followers you approve see ${whose} birthday, while this list is on your profile.`
            : `Only you and followers you approve see it. They get a reminder ${BIRTHDAY_REMINDER_DAYS} days before.`}
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
          {title("Sizes")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
          {SIZE_FIELDS.map(({ key, placeholder }) => (
            <View key={key} style={{ width: "47%" }}>
              <Field
                label={SIZE_LABELS[key]}
                value={sizes[key] ?? ""}
                onChangeText={(value) => setSizes((current) => ({ ...current, [key]: value }))}
                placeholder={placeholder}
                maxLength={MAX_SIZE_LENGTH}
              />
            </View>
          ))}
        </View>
      </View>

      <Field label="Favorite colors" value={colors} onChangeText={setColors} placeholder="Green, gold, anything sparkly" maxLength={MAX_TEXT_LENGTH} />
      <TagField
        label="Likes"
        hint="Press return after each one."
        placeholder="Tea, puzzles, hiking"
        tags={likes}
        onTagsChange={setLikes}
        draft={likeDraft}
        onDraftChange={setLikeDraft}
      />
      <TagField
        label="Please skip"
        placeholder="Candles, mugs"
        tags={skip}
        onTagsChange={setSkip}
        draft={skipDraft}
        onDraftChange={setSkipDraft}
      />
      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Anything else givers should know" maxLength={MAX_TEXT_LENGTH} multiline />

      {error ? (
        <Text variant="footnote" tone="danger">
          {error}
        </Text>
      ) : null}
      <Button title="Save" onPress={save} loading={saving} />
      {saved ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={14} color={theme.textTertiary} />
          <Text variant="footnote" tone="tertiary">
            Saved
          </Text>
        </View>
      ) : null}
    </View>
  );
}
