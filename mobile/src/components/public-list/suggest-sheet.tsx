// Suggesting an item to a list's owner, as a sheet: the website's dialog
// (src/components/suggest-item-dialog.tsx), with its words. The owner gets an
// email and can add it to the list.
//
// It asks only for what suggestItem saves: the name, link, price, why, and
// who's suggesting it. The website's dialog also shows a currency, quantity,
// category and "available to gift", which the server doesn't read.

import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";

import { toWebUrl } from "@shared/web-url";

import { Button, Field, haptic, IconButton, Text } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { errorMessage } from "@/lib/data";
import { parsePrice } from "@/lib/format";
import { useSuggestItem } from "@/lib/public-list-data";
import { spacing, useTheme } from "@/lib/theme";

import { ErrorLine, SheetFrame } from "./sheet-frame";

export function SuggestSheet({ registryId, onClose }: { registryId: string; onClose: () => void }) {
  const theme = useTheme();
  const { session } = useSession();
  const suggest = useSuggestItem();
  const accountName = typeof session?.user.user_metadata?.full_name === "string" ? session.user.user_metadata.full_name : "";
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [priceText, setPriceText] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState(accountName);
  const [email, setEmail] = useState(session?.user.email ?? "");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const openableUrl = toWebUrl(url);

  const submit = () => {
    if (suggest.isPending) return;
    if (!title.trim()) {
      setError("Add the item's name.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Add your name and email.");
      return;
    }
    setError("");
    // As on the website: a link typed without http:// gets it.
    const link = url.trim();
    suggest.mutate(
      {
        registryId,
        title: title.trim(),
        externalUrl: link && !/^https?:\/\//i.test(link) ? `http://${link}` : link,
        price: parsePrice(priceText),
        notes: notes.trim(),
        suggestedByName: name.trim(),
        suggestedByEmail: email.trim(),
      },
      {
        onSuccess: () => {
          haptic("success");
          setSent(true);
        },
        onError: (e) => {
          haptic("warning");
          setError(errorMessage(e));
        },
      },
    );
  };

  if (sent) {
    return (
      <SheetFrame title="Thank you!" onClose={onClose}>
        <Text variant="callout" tone="secondary">
          We sent your suggestion to the list&apos;s owner.
        </Text>
        <Button title="Done" onPress={onClose} />
      </SheetFrame>
    );
  }

  return (
    <SheetFrame title="Suggest an item" onClose={onClose}>
      <Text variant="callout" tone="secondary">
        We&apos;ll let the list&apos;s owner know.
      </Text>
      <Field label="Item name" value={title} onChangeText={setTitle} placeholder="e.g. Baby Monitor" returnKeyType="next" />
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Product URL (optional)"
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.example.com"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>
        {/* Lets the guest check the link before sending it. Grey until the field holds a web address. */}
        <View style={{ paddingBottom: 4 }}>
          <IconButton
            icon="external"
            accessibilityLabel="Open the link"
            color={openableUrl ? undefined : theme.placeholder}
            onPress={() => openableUrl && WebBrowser.openBrowserAsync(openableUrl).catch(() => {})}
          />
        </View>
      </View>
      <Field
        label="Estimated price (optional)"
        value={priceText}
        onChangeText={setPriceText}
        placeholder="0.00"
        keyboardType="decimal-pad"
        leading={
          <Text variant="body" tone="tertiary">
            $
          </Text>
        }
      />
      <Field label="Why do you recommend this? (optional)" value={notes} onChangeText={setNotes} placeholder="Enter a description..." multiline />
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
        returnKeyType="done"
      />
      <ErrorLine error={error} />
      <Button title="Suggest item" loading={suggest.isPending} onPress={submit} />
      <Button title="Cancel" variant="ghost" size="medium" disabled={suggest.isPending} onPress={onClose} />
    </SheetFrame>
  );
}
