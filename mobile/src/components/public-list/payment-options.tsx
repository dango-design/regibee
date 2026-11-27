// How a guest sends money to the list's owners: their Venmo, PayPal and Zelle
// handles from the list's settings. The website shows the same in
// src/components/payment-methods-display.tsx:
//
// - PaymentHandles lists the handles as text, in a gift fund's form, before
//   the guest has said how much.
// - PaymentOptions gives a card per handle with a Copy button, and a button
//   that opens the payment app with the amount filled in where a link can be
//   built, for covering an item the owners bought and on a gift fund's
//   thank-you.

import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Linking, View } from "react-native";

import { paypalPayUrl, venmoPayUrl } from "@shared/payment-links";
import type { PaymentMethods } from "@shared/types";

import { Button, haptic, Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

function hasPaymentMethod(methods: PaymentMethods | null | undefined): methods is PaymentMethods {
  return Boolean(methods && (methods.venmo || methods.paypal || methods.zelle));
}

/** The owners' handles as plain text. */
export function PaymentHandles({ methods }: { methods: PaymentMethods | null }) {
  if (!hasPaymentMethod(methods)) {
    return (
      <Text variant="footnote" tone="tertiary">
        Ask the owner how to pay them.
      </Text>
    );
  }
  const rows = [
    { service: "Venmo", handle: methods.venmo },
    { service: "PayPal", handle: methods.paypal },
    { service: "Zelle", handle: methods.zelle },
  ].filter((row): row is { service: string; handle: string } => Boolean(row.handle));
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="subhead" style={{ fontWeight: "600" }}>
        Send payment via:
      </Text>
      {rows.map((row) => (
        <View key={row.service} style={{ flexDirection: "row", gap: spacing.sm }}>
          <Text variant="subhead" tone="tertiary" style={{ width: 60, fontWeight: "600" }}>
            {row.service}
          </Text>
          <Text variant="subhead" selectable style={{ flex: 1 }}>
            {row.handle}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A card per handle with a Copy button. Venmo, and PayPal with a PayPal.Me
 * name, also get a button that opens the app with the amount filled in.
 */
export function PaymentOptions({
  methods,
  amount,
  note,
  parentName,
}: {
  methods: PaymentMethods | null;
  /** Filled in where the service takes an amount. Null when the item has no price. */
  amount: number | null;
  /** Filled in where the service takes a note (Venmo only). */
  note: string;
  parentName: string;
}) {
  if (!hasPaymentMethod(methods)) {
    return (
      <Text variant="footnote" tone="secondary">
        No Venmo, PayPal or Zelle yet. Ask {parentName} how to send it.
      </Text>
    );
  }
  const venmoUrl = venmoPayUrl({ handle: methods.venmo, amount, note });
  const paypalUrl = paypalPayUrl({ handle: methods.paypal, amount });
  return (
    <View style={{ gap: spacing.sm }}>
      {methods.venmo ? (
        <PaymentMethodCard service="Venmo" handle={methods.venmo} url={venmoUrl} hint="Send it in the Venmo app." />
      ) : null}
      {methods.paypal ? (
        <PaymentMethodCard service="PayPal" handle={methods.paypal} url={paypalUrl} hint="Send it in PayPal." />
      ) : null}
      {methods.zelle ? (
        <PaymentMethodCard service="Zelle" handle={methods.zelle} url={null} hint="Send it from your bank's app." />
      ) : null}
    </View>
  );
}

// The handle is always there to copy, in case the link doesn't open the app.
function PaymentMethodCard({
  service,
  handle,
  url,
  hint,
}: {
  service: string;
  handle: string;
  url: string | null;
  /** Shown only when there's no Pay button. */
  hint: string;
}) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(handle).catch(() => {});
    haptic();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  // Opened with the system, not the in-app browser, so a phone with the
  // Venmo or PayPal app opens it there.
  const open = (link: string) => Linking.openURL(link).catch(() => {});
  return (
    <View
      style={{
        gap: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subhead" style={{ fontWeight: "600" }}>
            {service}
          </Text>
          <Text variant="subhead" tone="secondary" selectable>
            {handle}
          </Text>
          {url ? null : (
            <Text variant="caption" tone="tertiary">
              {hint}
            </Text>
          )}
        </View>
        <Button
          title={copied ? "Copied" : "Copy"}
          icon={copied ? "check" : "copy"}
          variant="secondary"
          size="small"
          accessibilityLabel={copied ? `Copied ${service} handle` : `Copy ${service} handle`}
          onPress={copy}
        />
      </View>
      {url ? (
        <Button title={`Pay with ${service}`} icon="external" variant="secondary" size="medium" onPress={() => open(url)} />
      ) : null}
    </View>
  );
}
