// Save or edit a gift idea: something you might give someone else, which only
// you can see. The website's "Save a gift idea" dialog
// (src/components/gift-idea-dialog.tsx), with the app's product reader to
// fill in a link's name, price and picture.

import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { recentRecipients, recipientKey } from "@shared/gift-ideas";

import { ItemImage } from "@/components/item-image";
import { PasteLinkButton } from "@/components/paste-link-button";
import { ProductReader } from "@/components/product-reader";
import { Button, Chip, Field, haptic, IconButton, Text } from "@/components/ui";
import { errorMessage } from "@/lib/data";
import { parsePrice } from "@/lib/format";
import { normalizeLink, parseSharedText, storeLabel, type ReadProduct } from "@/lib/product";
import { useDeleteIdea, useGiftIdeas, useSaveIdea } from "@/lib/saved-data";
import { radius, spacing, useTheme } from "@/lib/theme";

export default function IdeaScreen() {
  const params = useLocalSearchParams<{ id?: string; recipient?: string; url?: string; title?: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const ideas = useGiftIdeas();
  const save = useSaveIdea();
  const remove = useDeleteIdea();
  const idea = params.id ? ideas.data?.find((i) => i.id === params.id) : undefined;
  const recipients = recentRecipients(ideas.data ?? []);

  const startingLink = idea?.externalUrl ?? (params.url ? normalizeLink(params.url) : null) ?? "";
  const [recipient, setRecipient] = useState(idea?.recipient ?? params.recipient ?? "");
  const [link, setLink] = useState(startingLink);
  const [title, setTitle] = useState(idea?.title ?? params.title ?? "");
  const [priceText, setPriceText] = useState(idea?.price != null ? idea.price.toFixed(2) : "");
  const [notes, setNotes] = useState(idea?.notes ?? "");
  const [images, setImages] = useState<string[]>(idea?.imageUrl ? [idea.imageUrl] : []);
  const [imageUrl, setImageUrl] = useState<string | null>(idea?.imageUrl ?? null);
  const [reading, setReading] = useState<string | null>(!idea && startingLink ? startingLink : null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function read(raw: string) {
    const { url } = parseSharedText(raw);
    const normalized = normalizeLink(url ?? raw);
    if (!normalized) {
      setStatus("That doesn't look like a link.");
      return;
    }
    setLink(normalized);
    setStatus(null);
    setReading(normalized);
  }

  function onProduct(product: ReadProduct | null) {
    setReading(null);
    if (!product) {
      setStatus(`We couldn't read the details from ${storeLabel(link) ?? "this link"}. Fill in the rest by hand.`);
      return;
    }
    const filled: string[] = [];
    if (product.title && !title.trim()) {
      setTitle(product.title);
      filled.push("name");
    }
    if (product.price != null && !priceText.trim()) {
      setPriceText(product.price.toFixed(2));
      filled.push("price");
    }
    if (product.images.length > 0) {
      setImages(product.images);
      if (!imageUrl) {
        setImageUrl(product.images[0]);
        filled.push("picture");
      }
    }
    haptic("success");
    setStatus(filled.length > 0 ? `Filled in the ${filled.join(", ")}.` : "Nothing new to fill in from that page.");
  }

  function submit() {
    setError(null);
    if (!recipient.trim()) {
      setError("Say who it's for.");
      return;
    }
    if (!title.trim()) {
      setError("Say what it is.");
      return;
    }
    save.mutate(
      {
        id: idea?.id,
        input: {
          recipient,
          title,
          url: link.trim() ? (normalizeLink(link) ?? link.trim()) : null,
          imageUrl,
          price: parsePrice(priceText),
          notes,
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
    if (!idea) return;
    Alert.alert(`Delete “${idea.title}”?`, "You can't undo this.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Delete it",
        style: "destructive",
        onPress: () => {
          remove.mutate(idea.id, { onError: (e) => Alert.alert("The idea wasn't deleted", errorMessage(e)) });
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen
        options={{
          title: idea ? "Edit gift idea" : "Save a gift idea",
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => router.back()} />
              : undefined,
        }}
      />
      {reading ? <ProductReader key={reading} url={reading} onResult={onProduct} /> : null}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <Field
            label="Who's it for?"
            value={recipient}
            onChangeText={setRecipient}
            placeholder="Mom, Sam, my brother…"
            autoCapitalize="words"
          />
          {recipients.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {recipients.map((name) => (
                <Chip
                  key={recipientKey(name)}
                  label={name}
                  selected={recipientKey(name) === recipientKey(recipient)}
                  onPress={() => setRecipient(name)}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Field
            label="Link (optional)"
            value={link}
            onChangeText={setLink}
            placeholder="https://www.example.com/..."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onSubmitEditing={() => link.trim() && read(link)}
            returnKeyType="go"
          />
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
            {!link ? <PasteLinkButton onPaste={read} /> : null}
            {link ? <Button title="Fill in" size="small" variant="secondary" loading={Boolean(reading)} onPress={() => read(link)} /> : null}
          </View>
          {reading ? (
            <Text variant="footnote" tone="secondary">
              Reading the page…
            </Text>
          ) : status ? (
            <Text variant="footnote" tone="secondary">
              {status}
            </Text>
          ) : null}
        </View>

        <Field label="What is it?" value={title} onChangeText={setTitle} placeholder="e.g., Wool scarf in green" multiline />

        {images.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
              Picture
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {images.map((uri) => {
                const selected = uri === imageUrl;
                return (
                  <Pressable
                    key={uri}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={selected ? "Don't use a picture" : "Use this picture"}
                    accessibilityState={{ selected }}
                    onPress={() => setImageUrl(selected ? null : uri)}
                    style={{ borderRadius: radius.md + 2, borderWidth: 2, borderColor: selected ? theme.tint : "transparent" }}
                  >
                    <ItemImage uri={uri} size={72} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <Field
          label="Price (optional)"
          value={priceText}
          onChangeText={(text) => setPriceText(text.replace(/[^0-9.,]/g, ""))}
          placeholder="0.00"
          keyboardType="decimal-pad"
          leading={<Text tone="tertiary">$</Text>}
        />
        <Field
          label="Note (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Her size, the color she liked, when to get it…"
          multiline
        />
        {idea ? <Button title="Delete" variant="danger" icon="trash" onPress={confirmDelete} /> : null}
      </ScrollView>
      <View style={{ padding: spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.lg), gap: spacing.sm }}>
        {error ? (
          <Text variant="footnote" tone="danger" style={{ textAlign: "center" }}>
            {error}
          </Text>
        ) : null}
        <Button title={idea ? "Save" : "Save idea"} onPress={submit} loading={save.isPending} />
      </View>
    </KeyboardAvoidingView>
  );
}
