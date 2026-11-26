// How a guest sends money to the list's owners: their Venmo, PayPal and Zelle
// handles from the list's settings. The website shows the same in
// src/components/payment-methods-display.tsx:
//
// - PaymentHandles lists the handles as text, for a gift fund.
// - PaymentOptions gives a button per handle that opens the payment app with
//   the amount filled in, or a Copy button where no link can be built, for
//   covering an item the owners bought.

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

/** A button per handle that opens it with the amount filled in, or a Copy button. */
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
  // Opened with the system, not the in-app browser, so a phone with the
  // Venmo or PayPal app opens it there.
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  return (
    <View style={{ gap: spacing.sm }}>
      {methods.venmo ? (
        venmoUrl ? (
          <Button title="Pay with Venmo" icon="external" variant="secondary" size="medium" onPress={() => open(venmoUrl)} />
        ) : (
          <CopyHandle service="Venmo" handle={methods.venmo} hint="Send it in the Venmo app." />
        )
      ) : null}
      {methods.paypal ? (
        paypalUrl ? (
          <Button title="Pay with PayPal" icon="external" variant="secondary" size="medium" onPress={() => open(paypalUrl)} />
        ) : (
          <CopyHandle service="PayPal" handle={methods.paypal} hint="Send it in PayPal." />
        )
      ) : null}
      {methods.zelle ? <CopyHandle service="Zelle" handle={methods.zelle} hint="Send it from your bank's app." /> : null}
    </View>
  );
}

function CopyHandle({ service, handle, hint }: { service: string; handle: string; hint: string }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(handle).catch(() => {});
    haptic();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subhead" style={{ fontWeight: "600" }}>
          {service}
        </Text>
        <Text variant="subhead" tone="secondary" selectable>
          {handle}
        </Text>
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
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
  );
}
