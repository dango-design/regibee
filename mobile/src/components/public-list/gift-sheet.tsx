// Giving an item on someone else's list, as a sheet: the website's gift
// dialog (src/components/reserve-item-dialog.tsx), with its steps and words.
//
// The guest fills in their details and presses Reserve and buy. That holds
// the item for GIFT_HOLD_DAYS and shows the address to ship it to. The store
// opens in the in-app browser, and when the guest closes it the sheet asks
// whether they bought it. On the owners' own store registry, the store has
// their address, so Reserve and buy opens the store straight away.

import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import * as WebBrowser from "expo-web-browser";
import { useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, StatusBar, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GIFT_HOLD_DAYS, SECRET_GIVER_NAME, formatReservedUntil, type MyItemGift } from "@shared/gifts";
import type { PublicListItem, PublicListPageData } from "@shared/public-list-page-types";

import { Icon } from "@/components/icon";
import { ItemImage } from "@/components/item-image";
import { KeyboardScrollView } from "@/components/keyboard";
import { Button, Field, haptic, IconButton, Stepper, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { formatPrice } from "@/lib/format";
import { useConfirmGift, useReleaseGift, useReserveItem, type EventLink } from "@/lib/public-list-data";
import { radius, spacing, useTheme } from "@/lib/theme";

export type GiftStep = "reserve" | "already" | "buy" | "confirm" | "notyet" | "done" | "release" | "details";

/** The store names the sheet uses for one item. */
export interface ItemShop {
  /** The store's name, or the link's host. Undefined for an item with no link. */
  shopName?: string;
  /** Set when the link is on the owners' own registry at that store. */
  registryStoreName?: string;
}

export function GiftSheet({
  item,
  page,
  gift: giftProp,
  shop,
  step: initialStep,
  link,
  onClose,
}: {
  item: PublicListItem;
  page: PublicListPageData;
  gift: MyItemGift | null;
  shop: ItemShop;
  /** The step it opens at. */
  step: GiftStep;
  link: EventLink | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const reserve = useReserveItem(link);
  const confirm = useConfirmGift();
  const release = useReleaseGift();

  // A guest from an event invitation starts with the name and email they
  // gave the host. Anyone else starts with their account's.
  const prefill = page.guestPrefill;
  const accountName = typeof session?.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name : "";
  const [name, setName] = useState(prefill?.name || accountName);
  const [email, setEmail] = useState(prefill?.email || session?.user.email || "");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");

  const [step, setStep] = useState<GiftStep>(initialStep);
  const [gift, setGift] = useState<MyItemGift | null>(giftProp);
  const [address, setAddress] = useState(page.shippingAddress ?? undefined);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  // Where "Keep it" goes back to from the release step.
  const [releaseFrom, setReleaseFrom] = useState<GiftStep | null>(null);

  const parentName = page.parentName;
  // Who the owners see the gift is from.
  const fromWhom = prefill?.secretGiver ? SECRET_GIVER_NAME : "you";
  const remaining = item.quantity_needed - item.quantity_fulfilled;
  const { shopName, registryStoreName } = shop;
  const oneTap = Boolean(item.external_url && registryStoreName);
  const until = gift?.reservedUntil ? formatReservedUntil(gift.reservedUntil) : null;
  const busy = reserve.isPending || confirm.isPending || release.isPending;

  const go = (next: GiftStep) => {
    setError("");
    setStep(next);
  };
  const goToRelease = () => {
    setError("");
    setReleaseFrom(step);
    setStep("release");
  };

  /** Opens the store in the in-app browser. Closing it brings the guest back to "Did you buy it?". */
  const openStore = async (copyAddress: boolean) => {
    if (!item.external_url) return;
    if (copyAddress && address) await Clipboard.setStringAsync(address).catch(() => {});
    await WebBrowser.openBrowserAsync(item.external_url).catch(() => {});
    setStep("confirm");
  };

  const submit = () => {
    if (busy) return;
    if (!name.trim() || !email.trim()) {
      setError("Add your name and email.");
      return;
    }
    setError("");
    const alreadyBought = step === "already";
    reserve.mutate(
      { itemId: item.id, buyerName: name.trim(), buyerEmail: email.trim(), quantity, message: message.trim(), alreadyBought },
      {
        onSuccess: (result) => {
          haptic("success");
          setGift({ purchaseId: result.purchaseId, status: result.status, reservedUntil: result.reservedUntil, quantity });
          if (result.shippingAddress) setAddress(result.shippingAddress);
          if (result.status === "purchased") setStep("done");
          else if (oneTap) void openStore(false);
          else setStep("buy");
        },
        onError: (e) => {
          haptic("warning");
          setError(errorMessage(e));
        },
      },
    );
  };

  const markBought = () => {
    if (!gift || busy) return;
    setError("");
    confirm.mutate(gift.purchaseId, {
      onSuccess: () => {
        haptic("success");
        setGift({ ...gift, status: "purchased", reservedUntil: null });
        setStep("done");
      },
      onError: (e) => setError(errorMessage(e)),
    });
  };

  const releaseGift = () => {
    if (!gift || busy) return;
    setError("");
    release.mutate(
      { itemId: item.id, purchaseId: gift.purchaseId },
      {
        onSuccess: () => {
          setGift(null);
          onClose();
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  const copyAddress = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address).catch(() => {});
    haptic();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const errorLine = error ? (
    <Text variant="footnote" tone="danger">
      {error}
    </Text>
  ) : null;
  const shipTo = (copyable: boolean) =>
    address ? (
      <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt, padding: spacing.lg, gap: 4 }}>
        <Text variant="caption" tone="tertiary">
          Ship to
        </Text>
        <Text variant="subhead" selectable>
          {address}
        </Text>
        {copyable ? (
          <Pressable accessibilityRole="button" onPress={copyAddress} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Icon name={copied ? "check" : "copy"} size={14} color={theme.tint} />
            <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }}>
              {copied ? "Copied!" : "Copy address"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    ) : null;

  let title = "";
  let content: ReactNode = null;

  if (step === "reserve" || step === "already") {
    title = step === "reserve" ? `Gift the ${item.title}` : `Tell ${parentName} you bought it`;
    content = (
      <>
        <Text variant="callout" tone="secondary">
          {step === "reserve"
            ? registryStoreName
              ? `It's on ${parentName}'s ${registryStoreName} registry, so the store has their address.`
              : "Reserve it so nobody else buys it."
            : `They'll see it's from ${fromWhom}.`}
        </Text>
        <ItemPanel item={item} shop={shop} showShop={step === "reserve"} />
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
        />
        {item.quantity_needed > 1 ? (
          <View style={{ gap: 6 }}>
            <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
              Quantity
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Stepper value={quantity} onChange={setQuantity} min={1} max={Math.max(1, remaining)} />
              <Text variant="footnote" tone="tertiary">
                {remaining} of {item.quantity_needed} available to gift
              </Text>
            </View>
          </View>
        ) : null}
        <Field label="Message (optional)" value={message} onChangeText={setMessage} placeholder="Congratulations!" multiline />
        {errorLine}
        <View style={{ gap: spacing.sm }}>
          <Button
            title={
              step === "already"
                ? "Mark as bought"
                : oneTap
                  ? `Reserve and buy at ${registryStoreName}`
                  : "Reserve and buy"
            }
            icon={step === "reserve" && oneTap ? "external" : undefined}
            loading={reserve.isPending}
            onPress={submit}
          />
          {step === "reserve" ? (
            <Text variant="footnote" tone="tertiary" style={{ textAlign: "center" }}>
              {oneTap
                ? `${shopName} opens in the browser. Come back here after checkout.`
                : `We'll hold it for you for ${GIFT_HOLD_DAYS} days.`}
            </Text>
          ) : null}
        </View>
        <Button
          title={step === "reserve" ? "Already bought it?" : "Back"}
          variant="ghost"
          size="medium"
          onPress={() => go(step === "reserve" ? "already" : "reserve")}
        />
      </>
    );
  } else if (step === "buy") {
    const copyAndGo = !registryStoreName && Boolean(address) && Boolean(item.external_url);
    title = registryStoreName || !address ? (shopName ? `Buy it at ${shopName}` : "Buy it") : `Ship it to ${parentName}`;
    content = (
      <>
        {until ? (
          // The reservation is saved by now, which a guest may not have
          // expected, so the way to cancel it sits next to the notice.
          <View style={{ flexDirection: "row", gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, backgroundColor: theme.successSoft, alignItems: "flex-start" }}>
            <Icon name="check" size={16} color={theme.success} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subhead" style={{ color: theme.success, fontWeight: "600" }}>
                Reserved for you until {until}
              </Text>
              <Pressable accessibilityRole="button" onPress={goToRelease} hitSlop={8}>
                <Text variant="footnote" tone="secondary" style={{ textDecorationLine: "underline" }}>
                  Cancel reservation
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {registryStoreName ? (
          <Text variant="callout" tone="secondary">
            It&apos;s on their registry, so {registryStoreName} has their address.
          </Text>
        ) : !address ? (
          <Text variant="callout" tone="secondary">
            {prefill?.secretGiver
              ? "No shipping address yet. Bring it to the gift exchange, or ask the host."
              : `No shipping address yet. Ask ${parentName} where to send it.`}
          </Text>
        ) : null}
        {!registryStoreName ? shipTo(!copyAndGo) : null}
        {item.external_url ? (
          <Button
            title={copyAndGo ? `Copy address and open ${shopName}` : `Buy at ${shopName}`}
            icon="external"
            onPress={() => void openStore(copyAndGo)}
          />
        ) : (
          <Button title="I bought it" onPress={() => go("confirm")} />
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center" }}>
          {item.external_url ? <Button title="I already bought it" variant="ghost" size="medium" onPress={() => go("confirm")} /> : null}
          <Button title="Finish later" variant="ghost" size="medium" onPress={onClose} />
        </View>
        {!until ? <Button title="Cancel reservation" variant="ghost" size="small" onPress={goToRelease} /> : null}
      </>
    );
  } else if (step === "confirm") {
    title = `Did you buy the ${item.title}?`;
    content = (
      <>
        <Text variant="callout" tone="secondary">
          {parentName} will see it&apos;s from {fromWhom}.
        </Text>
        {errorLine}
        <Button title="Yes, I bought it" loading={confirm.isPending} onPress={markBought} />
        <Button title="Not yet" variant="secondary" disabled={busy} onPress={() => go("notyet")} />
        <Button title="I'm not getting it" variant="ghost" size="medium" disabled={busy} onPress={goToRelease} />
      </>
    );
  } else if (step === "notyet") {
    title = "It's still yours";
    content = (
      <>
        <View style={{ alignItems: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Icon name="clock" size={30} color={theme.onAccentSoft} />
          </View>
        </View>
        <Text variant="callout" tone="secondary" style={{ textAlign: "center" }}>
          We&apos;ll hold the {item.title}
          {until ? ` until ${until}` : ""} and email you the day before.
        </Text>
        <Button title="Done" onPress={onClose} />
        <Button title="Release it instead" variant="ghost" size="medium" onPress={goToRelease} />
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
          {parentName} will see the {item.title} is from {fromWhom}. We emailed you a copy. ❤️
        </Text>
        <Button title="Done" onPress={onClose} />
      </>
    );
  } else if (step === "release") {
    const undo = gift?.status === "purchased";
    title = undo ? `Undo your gift of the ${item.title}?` : `Release the ${item.title}?`;
    content = (
      <>
        <Text variant="callout" tone="secondary">
          It goes back on the list.
        </Text>
        {errorLine}
        <Button title={undo ? "Undo gift" : "Release gift"} variant="danger" loading={release.isPending} onPress={releaseGift} />
        <Button
          title="Keep it"
          variant="secondary"
          disabled={busy}
          onPress={() => (releaseFrom ? go(releaseFrom) : onClose())}
        />
      </>
    );
  } else if (step === "details") {
    title = "Your gift";
    content = (
      <>
        <Text variant="callout" tone="secondary">
          You&apos;re giving the {item.title}
          {gift && gift.quantity > 1 ? ` (×${gift.quantity})` : ""}. {parentName} can see it&apos;s from {fromWhom}.
        </Text>
        <ItemPanel item={item} shop={shop} showShop={false} />
        {!registryStoreName ? shipTo(true) : null}
        <Button title="Done" onPress={onClose} />
        <Button title="Undo this gift" variant="ghost" size="medium" onPress={goToRelease} />
      </>
    );
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      // On Android the sheet is its own window, and it opened with white
      // status bar icons, even in light mode. Setting the style again reaches
      // that window too, so the clock and battery show on a light background.
      onShow={() => {
        if (Platform.OS === "android") StatusBar.setBarStyle(theme.dark ? "light-content" : "dark-content");
      }}
    >
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingTop: Platform.OS === "ios" ? spacing.lg : insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
          }}
        >
          <Text variant="title" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
          <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
        </View>
        <KeyboardScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        >
          {content}
        </KeyboardScrollView>
      </View>
    </Modal>
  );
}

/** The item's photo, with its price, its store and a link to see it there. */
function ItemPanel({ item, shop, showShop }: { item: PublicListItem; shop: ItemShop; showShop: boolean }) {
  const theme = useTheme();
  const line = [
    item.price ? formatPrice(item.price) : null,
    showShop && shop.shopName ? (shop.registryStoreName ? `On their ${shop.registryStoreName} registry` : `From ${shop.shopName}`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, overflow: "hidden" }}>
      <View style={{ alignItems: "center", padding: spacing.lg, backgroundColor: theme.dark ? theme.surfaceAlt : "#FFFFFF" }}>
        <ItemImage uri={item.image_url} size={160} />
      </View>
      {line || (showShop && item.external_url) ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, padding: spacing.md }}>
          <Text variant="footnote" tone="secondary" style={{ flex: 1 }}>
            {line}
          </Text>
          {showShop && item.external_url ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(item.external_url!)}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Text variant="footnote" tone="tint" style={{ fontWeight: "600" }}>
                See it
              </Text>
              <Icon name="external" size={13} color={theme.tint} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
