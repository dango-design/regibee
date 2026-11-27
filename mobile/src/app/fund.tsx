// Create or edit a gift fund, as the website's "Create gift fund" and "Edit
// gift fund" dialogs do (src/components/add-cash-fund-dialog.tsx,
// src/components/cash-fund-card.tsx). Editing also lists who contributed.
// Creating also shows where guests send money, and sets it when the list has
// none, so the owner doesn't go to settings first. The checklist opens it with
// `title` and `description` filled in, for an entry such as Diaper Fund.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatGiftDate, giftActivityTag } from "@shared/gifts";

import { KeyboardFooter, KeyboardScrollView, useKeyboardFooter } from "@/components/keyboard";
import { Button, Divider, EmptyState, Field, haptic, IconButton, Pill, Section, Text } from "@/components/ui";
import { errorMessage, useDeleteFund, useRegistry, useSaveFund } from "@/lib/data";
import { formatPrice, parsePrice } from "@/lib/format";
import { spacing } from "@/lib/theme";
import type { PaymentMethods } from "@shared/types";

export default function FundScreen() {
  const params = useLocalSearchParams<{ registryId: string; fundId?: string; title?: string; description?: string }>();
  const { registryId, fundId } = params;
  const insets = useSafeAreaInsets();
  const keyboardFooter = useKeyboardFooter();
  const registry = useRegistry(registryId);
  const fund = fundId ? registry.data?.funds.find((f) => f.id === fundId) : undefined;
  const gifts = fundId ? (registry.data?.gifts ?? []).filter((g) => g.cash_fund_id === fundId) : [];
  const save = useSaveFund();
  const remove = useDeleteFund();

  const [title, setTitle] = useState(fund?.title ?? params.title ?? "");
  const [description, setDescription] = useState(fund?.description ?? params.description ?? "");
  // Until the list has loaded, its payment methods are unknown: the section
  // waits, so blank fields never replace methods it already has.
  const methodsKnown = Boolean(registry.data);
  const saved = registry.data?.registry.settings?.payment_methods as PaymentMethods | undefined;
  const hasSaved = Boolean(saved?.venmo || saved?.paypal || saved?.zelle);
  const [editingMethods, setEditingMethods] = useState(!hasSaved);
  const [venmo, setVenmo] = useState(saved?.venmo ?? "");
  const [paypal, setPaypal] = useState(saved?.paypal ?? "");
  const [zelle, setZelle] = useState(saved?.zelle ?? "");
  const [methodsSeen, setMethodsSeen] = useState(methodsKnown);
  if (methodsKnown && !methodsSeen) {
    // The list loaded after this screen opened: start from what it has.
    setMethodsSeen(true);
    setEditingMethods(!hasSaved);
    setVenmo(saved?.venmo ?? "");
    setPaypal(saved?.paypal ?? "");
    setZelle(saved?.zelle ?? "");
  }
  const [goalText, setGoalText] = useState(fund?.goal_amount ? String(fund.goal_amount) : "");
  const [error, setError] = useState<string | null>(null);

  if (fundId && !fund) {
    return <EmptyState icon="error" title="This fund is gone" message="It may have been deleted on another device." />;
  }

  function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Give the fund a name.");
      return;
    }
    save.mutate(
      {
        registryId,
        fund,
        input: {
          title,
          description,
          goalAmount: parsePrice(goalText),
          // Sent only when the fields showed, as the website's dialog does.
          ...(!fund && methodsKnown && editingMethods ? { paymentMethods: { venmo, paypal, zelle } } : {}),
        },
      },
      {
        onSuccess: () => {
          haptic("success");
          router.back();
        },
        onError: (e) => setError(errorMessage(e)),
      }
    );
  }

  function confirmDelete() {
    if (!fund) return;
    Alert.alert(`Delete “${fund.title}”?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          remove.mutate(fund, { onError: (e) => Alert.alert("Couldn't delete it", errorMessage(e)) });
          haptic("success");
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: fund ? "Edit gift fund" : "Create gift fund",
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => router.back()} />
              : undefined,
        }}
      />
      <KeyboardScrollView bottomOffset={keyboardFooter.bottomOffset} contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        <Field label="Fund Name" value={title} onChangeText={setTitle} placeholder="e.g., Diaper Fund" autoCapitalize="words" />
        <Field
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What's this fund for?"
          multiline
        />
        <Field
          label="Goal Amount (optional)"
          value={goalText}
          onChangeText={(text) => setGoalText(text.replace(/[^0-9.,]/g, ""))}
          placeholder="0.00"
          keyboardType="decimal-pad"
          leading={<Text tone="tertiary">$</Text>}
        />
        {!fund && methodsKnown ? (
          <Section title="Where guests send money">
            {editingMethods ? (
              <View style={{ padding: spacing.lg, gap: spacing.lg }}>
                <Text variant="footnote" tone="tertiary">
                  Guests pay you directly. Regibee never handles money.
                </Text>
                <Field label="Venmo" value={venmo} onChangeText={setVenmo} placeholder="@your-venmo" autoCapitalize="none" autoCorrect={false} />
                <Field
                  label="PayPal"
                  value={paypal}
                  onChangeText={setPaypal}
                  placeholder="you@email.com or PayPal.me link"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Field
                  label="Zelle"
                  value={zelle}
                  onChangeText={setZelle}
                  placeholder="you@email.com or phone number"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ) : (
              <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                {(
                  [
                    ["Venmo", saved?.venmo],
                    ["PayPal", saved?.paypal],
                    ["Zelle", saved?.zelle],
                  ] as const
                )
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <View key={label} style={{ flexDirection: "row", gap: spacing.sm }}>
                      <Text variant="subhead" tone="tertiary" style={{ width: 64, fontWeight: "500" }}>
                        {label}
                      </Text>
                      <Text variant="subhead" style={{ flex: 1 }}>
                        {value}
                      </Text>
                    </View>
                  ))}
                <View style={{ flexDirection: "row" }}>
                  <Button title="Edit" variant="ghost" size="small" onPress={() => setEditingMethods(true)} />
                </View>
              </View>
            )}
          </Section>
        ) : null}

        {fund && fund.current_amount > 0 ? (
          <Text variant="footnote" tone="tertiary">
            {formatPrice(fund.current_amount)} contributed so far.
          </Text>
        ) : null}

        {gifts.length > 0 ? (
          <Section title="Contributions">
            {gifts.map((gift, index) => {
              const tag = giftActivityTag(gift);
              return (
                <View key={gift.id}>
                  {index > 0 ? <Divider inset={spacing.lg} /> : null}
                  <View style={{ padding: spacing.lg, gap: 4, opacity: gift.status === "cancelled" ? 0.5 : 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                      <Text variant="subhead" style={{ fontWeight: "600" }}>
                        {gift.buyer_name}
                      </Text>
                      <Pill label={tag.label} tone={tag.kind === "cancelled" ? "neutral" : "success"} />
                      {gift.amount != null ? (
                        <Text variant="footnote" style={{ fontWeight: "600" }}>
                          {formatPrice(gift.amount)}
                        </Text>
                      ) : null}
                    </View>
                    {gift.message ? (
                      <Text variant="footnote" tone="secondary">
                        {gift.message}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                      <Text variant="caption" tone="tertiary">
                        {formatGiftDate(gift.created_at)}
                      </Text>
                      {gift.buyer_email && !gift.hide_giver ? (
                        <Text
                          variant="caption"
                          tone="tint"
                          accessibilityRole="link"
                          onPress={() => Linking.openURL(`mailto:${gift.buyer_email}`)}
                        >
                          {gift.buyer_email}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </Section>
        ) : null}

        {fund ? <Button title="Delete" variant="danger" icon="trash" onPress={confirmDelete} /> : null}
      </KeyboardScrollView>
      <KeyboardFooter {...keyboardFooter.footerProps} style={{ padding: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg), gap: spacing.sm }}>
        {error ? (
          <Text variant="footnote" tone="danger" style={{ textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
        <Button title={fund ? "Save changes" : "Create fund"} onPress={submit} loading={save.isPending} />
      </KeyboardFooter>
    </>
  );
}
