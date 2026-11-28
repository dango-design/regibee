// Starting a group gift on an item, as a sheet: the website's dialog
// (src/components/start-group-gift-dialog.tsx), with its words. The guest
// reserves the item in their name, friends chip in and pay them back, and
// they buy it. Once it's started, the group gift's page opens, which is still
// a website page.
//
// Starting one takes an account, on the website too. Signed out (or in the
// demo), the sheet asks the guest to sign in or make an account instead.

import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { PAYBACK_NOTE_MAX, groupGiftPath, parseGroupGiftAmount } from "@shared/group-gifts";
import type { PublicListItem, PublicListPageData } from "@shared/public-list-page-types";

import { Button, Field, haptic, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { useStartGroupGift, type EventLink } from "@/lib/public-list-data";
import { spacing } from "@/lib/theme";
import { openSite } from "@/lib/web";

import { ItemPhoto } from "./cover-sheet";
import { ErrorLine, SheetFrame } from "./sheet-frame";

export function GroupGiftSheet({
  item,
  page,
  link,
  onClose,
}: {
  item: PublicListItem;
  page: PublicListPageData;
  link: EventLink | null;
  onClose: () => void;
}) {
  const start = useStartGroupGift(link);
  const { session, demo, endDemo } = useSession();
  const [goal, setGoal] = useState(item.price ? String(item.price) : "");
  const [payback, setPayback] = useState("");
  const [error, setError] = useState("");
  const eventTitle = page.groupGifts?.eventTitle;

  const submit = () => {
    if (start.isPending) return;
    if (goal.trim() && parseGroupGiftAmount(goal) === null) {
      setError("Enter the total to collect, like 120.");
      return;
    }
    setError("");
    start.mutate(
      { registryId: page.registry.id, itemId: item.id, goalAmount: goal.trim() || null, paybackNote: payback },
      {
        onSuccess: (result) => {
          haptic("success");
          onClose();
          openSite(groupGiftPath(result.token));
        },
        onError: (e) => {
          haptic("warning");
          setError(errorMessage(e));
        },
      },
    );
  };

  // The sign-in and sign-up screens open only signed out, so the demo ends first.
  const goToAccount = (path: "/sign-in" | "/sign-up") => {
    onClose();
    if (demo) endDemo();
    router.push(path);
  };

  const intro = (
    <>
      <Text variant="callout" tone="secondary">
        You reserve the {item.title}
        {item.price ? ` (${formatPrice(item.price)})` : ""}, friends chip in and pay you back, and you buy it.{" "}
        {page.parentName} won&apos;t see who chipped in.
      </Text>
      <ItemPhoto item={item} />
    </>
  );

  if (!session) {
    return (
      <SheetFrame title="Go in on it together" onClose={onClose}>
        {intro}
        <Text variant="callout" tone="secondary">
          Sign in to start one. Friends who chip in don&apos;t need an account.
        </Text>
        <View style={{ gap: spacing.sm }}>
          <Button title="Sign in" onPress={() => goToAccount("/sign-in")} />
          <Button title="Create an account" variant="secondary" onPress={() => goToAccount("/sign-up")} />
        </View>
      </SheetFrame>
    );
  }

  return (
    <SheetFrame title="Go in on it together" onClose={() => !start.isPending && onClose()}>
      {intro}
      <Field
        label="Total to collect"
        value={goal}
        onChangeText={setGoal}
        placeholder="120"
        keyboardType="decimal-pad"
        hint="Usually the price. Optional."
        leading={
          <Text variant="body" tone="tertiary">
            $
          </Text>
        }
      />
      <Field
        label="How should people pay you back?"
        value={payback}
        onChangeText={setPayback}
        placeholder="Venmo @your-name"
        maxLength={PAYBACK_NOTE_MAX}
        autoCapitalize="none"
        hint="Regibee never holds the money."
      />
      {eventTitle ? (
        <Text variant="footnote" tone="tertiary">
          Guests of {eventTitle} see it on their invitation and can chip in.
        </Text>
      ) : null}
      <ErrorLine error={error} />
      <Button title="Start group gift" loading={start.isPending} onPress={submit} />
      <Button title="Cancel" variant="ghost" size="medium" disabled={start.isPending} onPress={onClose} />
    </SheetFrame>
  );
}
