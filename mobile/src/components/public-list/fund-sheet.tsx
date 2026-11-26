// Giving to a gift fund on someone else's list, as a sheet: the website's
// Contribute dialog (src/components/contribute-fund-dialog.tsx) and the
// thank-you it shows after (CelebrationDialog), with their words.
//
// The guest sends the money to the owners themselves, with Venmo, PayPal or
// Zelle, and says how much here. Regibee never moves money.

import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";

import type { PublicListFund, PublicListPageData } from "@shared/public-list-page-types";

import { Button, Field, haptic, ProgressBar, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { formatDollars, formatPrice, parsePrice } from "@/lib/format";
import { useContributeToFund, type EventLink } from "@/lib/public-list-data";
import { radius, spacing, useTheme } from "@/lib/theme";

import { PaymentHandles } from "./payment-options";
import { ErrorLine, SheetFrame } from "./sheet-frame";

export function FundSheet({
  fund,
  page,
  given,
  link,
  onClose,
}: {
  fund: PublicListFund;
  page: PublicListPageData;
  /** What this guest already gave, which opens the sheet at the thank-you. */
  given?: number;
  link: EventLink | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { session } = useSession();
  const contribute = useContributeToFund(link);

  // A guest from an event invitation starts with the name and email they
  // gave the host. Anyone else starts with their account's.
  const prefill = page.guestPrefill;
  const accountName = typeof session?.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name : "";
  const [name, setName] = useState(prefill?.name || accountName);
  const [email, setEmail] = useState(prefill?.email || session?.user.email || "");
  const [amountText, setAmountText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [contributed, setContributed] = useState<number | null>(given ?? null);

  const remaining = fund.goal_amount != null ? Math.max(0, fund.goal_amount - fund.current_amount) : null;

  const submit = () => {
    if (contribute.isPending) return;
    const amount = parsePrice(amountText);
    if (amount == null) {
      setError("Enter an amount above $0.");
      return;
    }
    // The website's field stops at what's left of the goal.
    if (remaining != null && remaining > 0 && amount > remaining) {
      setError(`Enter ${formatPrice(remaining)} or less. That's what's left of the goal.`);
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Add your name and email.");
      return;
    }
    setError("");
    contribute.mutate(
      { fundId: fund.id, amount, buyerName: name.trim(), buyerEmail: email.trim(), message: message.trim() },
      {
        onSuccess: () => {
          haptic("success");
          setContributed(amount);
        },
        onError: (e) => {
          haptic("warning");
          setError(errorMessage(e));
        },
      },
    );
  };

  if (contributed != null) {
    const hasMethods = Boolean(page.paymentMethods?.venmo || page.paymentMethods?.paypal || page.paymentMethods?.zelle);
    return (
      <SheetFrame title="Thank you!" onClose={onClose}>
        <View style={{ alignItems: "center" }}>
          <Image source={require("@/assets/images/panda.png")} style={{ width: 96, height: 110 }} contentFit="contain" accessibilityIgnoresInvertColors />
        </View>
        <Text variant="callout" tone="secondary" style={{ textAlign: "center" }}>
          You contributed {formatPrice(contributed)} to “{fund.title}”! {page.parentName} will really appreciate it. ❤️
        </Text>
        {hasMethods ? (
          <View style={{ borderRadius: radius.md, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceAlt, padding: spacing.lg }}>
            <PaymentHandles methods={page.paymentMethods} />
          </View>
        ) : null}
        <Button title="Done" onPress={onClose} />
      </SheetFrame>
    );
  }

  return (
    <SheetFrame title={`Contribute to “${fund.title}”`} onClose={onClose}>
      <Text variant="callout" tone="secondary">
        You send the money to them directly.
      </Text>
      {fund.goal_amount != null ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="footnote">{formatDollars(fund.current_amount)} raised</Text>
            <Text variant="footnote">{formatDollars(fund.goal_amount)} goal</Text>
          </View>
          <ProgressBar value={fund.goal_amount > 0 ? fund.current_amount / fund.goal_amount : 0} />
          {remaining != null && remaining > 0 ? (
            <Text variant="caption" tone="tertiary">
              {formatDollars(remaining)} remaining
            </Text>
          ) : null}
        </View>
      ) : null}
      {/* No amount up here, as on the website: a number next to "Send
          payment via" reads like the price to pay. */}
      <PaymentHandles methods={page.paymentMethods} />
      <Field
        label="Amount"
        value={amountText}
        onChangeText={setAmountText}
        placeholder="0.00"
        keyboardType="decimal-pad"
        leading={
          <Text variant="body" tone="tertiary">
            $
          </Text>
        }
      />
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
      <Field label="Message (optional)" value={message} onChangeText={setMessage} placeholder="Congratulations!" multiline />
      <ErrorLine error={error} />
      <Button title="Contribute" loading={contribute.isPending} onPress={submit} />
      <Button title="Cancel" variant="ghost" size="medium" disabled={contribute.isPending} onPress={onClose} />
    </SheetFrame>
  );
}
