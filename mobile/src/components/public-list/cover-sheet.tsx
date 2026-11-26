// Giving an item the owners already bought, as a sheet: the website's cover
// dialog (src/components/cover-item-dialog.tsx), with its steps and words.
//
// The guest sends the owners its price with Venmo, PayPal or Zelle, then says
// so here. Paying takes seconds and nothing ships, so the gift is saved as
// given straight away, with no hold. The guest can see and undo it later.

import { Image } from "expo-image";
import { useState, type ReactNode } from "react";
import { View } from "react-native";

import { SECRET_GIVER_NAME, type MyItemGift } from "@shared/gifts";
import { paymentNote } from "@shared/payment-links";
import type { PublicListItem, PublicListPageData } from "@shared/public-list-page-types";

import { ItemImage } from "@/components/item-image";
import { Button, Field, haptic, Stepper, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { useCoverItem, useReleaseGift, type EventLink } from "@/lib/public-list-data";
import { radius, spacing, useTheme } from "@/lib/theme";

import { PaymentOptions } from "./payment-options";
import { ErrorLine, SheetFrame } from "./sheet-frame";

type Step = "pay" | "done" | "details" | "release";

export function CoverSheet({
  item,
  page,
  gift: giftProp,
  availableToGift,
  link,
  onClose,
}: {
  item: PublicListItem;
  page: PublicListPageData;
  /** This guest's gift on the item, which opens the sheet at "Your gift". */
  gift: MyItemGift | null;
  /** How many are left for guests to give. */
  availableToGift: number;
  link: EventLink | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { session } = useSession();
  const cover = useCoverItem(link);
  const release = useReleaseGift();

  const prefill = page.guestPrefill;
  const accountName = typeof session?.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name : "";
  const [name, setName] = useState(prefill?.name || accountName);
  const [email, setEmail] = useState(prefill?.email || session?.user.email || "");
  const [message, setMessage] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [gift, setGift] = useState<MyItemGift | null>(giftProp);
  const [step, setStep] = useState<Step>(giftProp ? "details" : "pay");
  const [error, setError] = useState("");
  // Where "Keep it" goes back to from the release step.
  const [releaseFrom, setReleaseFrom] = useState<Step | null>(null);

  const parentName = page.parentName;
  // Who the owners see the gift is from.
  const fromWhom = prefill?.secretGiver ? SECRET_GIVER_NAME : "you";
  const available = Math.max(availableToGift, 1);
  const amountFor = (qty: number) => (item.price ? item.price * qty : null);
  const amount = amountFor(quantity);
  const giftAmount = gift ? amountFor(gift.quantity) : null;
  const sentLabel = (value: number | null) => (value != null ? formatPrice(value) : "it");
  const busy = cover.isPending || release.isPending;

  const goToRelease = () => {
    setError("");
    setReleaseFrom(step);
    setStep("release");
  };

  const submit = () => {
    if (busy) return;
    if (!name.trim() || !email.trim()) {
      setError("Add your name and email.");
      return;
    }
    setError("");
    cover.mutate(
      { itemId: item.id, quantity, buyerName: name.trim(), buyerEmail: email.trim(), message: message.trim() },
      {
        onSuccess: (result) => {
          haptic("success");
          setGift({ purchaseId: result.purchaseId, status: "purchased", reservedUntil: null, quantity });
          setStep("done");
        },
        onError: (e) => {
          haptic("warning");
          setError(errorMessage(e));
        },
      },
    );
  };

  const undo = () => {
    if (!gift || busy) return;
    setError("");
    release.mutate(
      { itemId: item.id, purchaseId: gift.purchaseId },
      {
        onSuccess: onClose,
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  let title = "";
  let content: ReactNode = null;

  if (step === "pay") {
    title = `Gift the ${item.title}`;
    content = (
      <>
        <Text variant="callout" tone="secondary">
          {page.coverFlavor || `${parentName} already bought this one.`} Give it by sending them the money for it.
        </Text>
        <ItemPhoto item={item} />
        <View style={{ gap: spacing.md }}>
          <View style={{ borderRadius: radius.md, backgroundColor: theme.surfaceAlt, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 }}>
            <Text variant="caption" tone="tertiary">
              1. Send {parentName}
            </Text>
            {amount != null ? (
              <Text variant="title">{formatPrice(amount)}</Text>
            ) : (
              <Text variant="subhead" tone="secondary">
                What you&apos;d like to give. This item has no price.
              </Text>
            )}
            {amount != null && quantity > 1 && item.price ? (
              <Text variant="caption" tone="tertiary">
                {quantity} × {formatPrice(item.price)}
              </Text>
            ) : null}
          </View>
          {item.quantity_needed > 1 ? (
            <View style={{ gap: 6 }}>
              <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
                How many
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Stepper value={quantity} onChange={setQuantity} min={1} max={available} />
                <Text variant="footnote" tone="tertiary" style={{ flex: 1 }}>
                  {availableToGift} of {item.quantity_needed} available to gift
                </Text>
              </View>
            </View>
          ) : null}
          <PaymentOptions methods={page.paymentMethods} amount={amount} note={paymentNote(item.title, quantity)} parentName={parentName} />
        </View>
        <View style={{ gap: spacing.md }}>
          <Text variant="headline">
            2. Tell {parentName} it&apos;s from {fromWhom}
          </Text>
          <Field label="Your Name" value={name} onChangeText={setName} placeholder="Alex Kim" autoComplete="name" textContentType="name" returnKeyType="next" />
          <Field
            label="Your Email"
            value={email}
            onChangeText={setEmail}
            placeholder="alex@example.com"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
            hint="We'll email you a copy."
          />
          <Field label="Message (optional)" value={message} onChangeText={setMessage} placeholder="Congratulations!" multiline />
          <ErrorLine error={error} />
          <Button title={`I sent ${sentLabel(amount)}`} loading={cover.isPending} onPress={submit} />
        </View>
      </>
    );
  } else if (step === "done") {
    title = "Thank you!";
    content = (
      <>
        <View style={{ alignItems: "center" }}>
          <Image source={require("@/assets/images/panda.png")} style={{ width: 96, height: 110 }} contentFit="contain" accessibilityIgnoresInvertColors />
        </View>
        <Text variant="callout" tone="secondary" style={{ textAlign: "center" }}>
          {prefill?.secretGiver
            ? `${parentName} will see ${SECRET_GIVER_NAME} sent ${sentLabel(giftAmount)} for the ${item.title}.`
            : `${parentName} will see you sent ${sentLabel(giftAmount)} for the ${item.title}.`}{" "}
          We emailed you a copy. ❤️
        </Text>
        <Button title="Done" onPress={onClose} />
      </>
    );
  } else if (step === "details") {
    title = "Your gift";
    content = (
      <>
        <Text variant="callout" tone="secondary">
          You sent {sentLabel(giftAmount)} for the {item.title}
          {gift && gift.quantity > 1 ? ` (×${gift.quantity})` : ""}. {parentName} can see it&apos;s from {fromWhom}.
        </Text>
        <ItemPhoto item={item} />
        <Button title="Done" onPress={onClose} />
        <Button title="Undo this gift" variant="ghost" size="medium" onPress={goToRelease} />
      </>
    );
  } else {
    title = `Undo your gift of the ${item.title}?`;
    content = (
      <>
        <Text variant="callout" tone="secondary">
          It goes back on the list. Regibee doesn&apos;t move money, so ask {parentName} if you need it back.
        </Text>
        <ErrorLine error={error} />
        <Button title="Undo gift" variant="danger" loading={release.isPending} onPress={undo} />
        <Button
          title="Keep it"
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setError("");
            if (releaseFrom) setStep(releaseFrom);
            else onClose();
          }}
        />
      </>
    );
  }

  return (
    <SheetFrame title={title} onClose={onClose}>
      {content}
    </SheetFrame>
  );
}

/** The item's photo on a light tile, as on the website's dialogs. */
export function ItemPhoto({ item }: { item: Pick<PublicListItem, "image_url"> }) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        padding: spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.dark ? theme.surfaceAlt : "#FFFFFF",
      }}
    >
      <ItemImage uri={item.image_url} size={140} />
    </View>
  );
}
