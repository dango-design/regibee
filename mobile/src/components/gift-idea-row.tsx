// One gift idea on the Gift ideas screen. Tapping it opens it to edit. The
// circle on the right marks it bought, like the website's "Bought it" switch
// (src/components/gift-ideas.tsx).

import { Link, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { memo } from "react";
import { Alert, Platform, Pressable, StyleSheet, View } from "react-native";

import type { GiftIdea } from "@shared/gift-ideas";

import { Icon } from "@/components/icon";
import { ItemImage } from "@/components/item-image";
import { haptic, Pill, Text } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { storeLabel } from "@/lib/product";
import { spacing, useTheme } from "@/lib/theme";

export interface GiftIdeaActions {
  setBought: (idea: GiftIdea, bought: boolean) => void;
  remove: (idea: GiftIdea) => void;
}

function openLink(idea: GiftIdea) {
  if (idea.externalUrl) WebBrowser.openBrowserAsync(idea.externalUrl);
}

/** Long-press options on Android, where there's no native link menu. */
function showActions(idea: GiftIdea, actions: GiftIdeaActions) {
  haptic();
  const bought = Boolean(idea.boughtAt);
  Alert.alert(idea.title, undefined, [
    { text: bought ? "Not bought yet" : "Bought it", onPress: () => actions.setBought(idea, !bought) },
    ...(idea.externalUrl ? [{ text: "Shop", onPress: () => openLink(idea) }] : []),
    { text: "Delete idea", style: "destructive" as const, onPress: () => actions.remove(idea) },
    { text: "Cancel", style: "cancel" as const },
  ]);
}

export const GiftIdeaRow = memo(function GiftIdeaRow({ idea, actions }: { idea: GiftIdea; actions: GiftIdeaActions }) {
  const theme = useTheme();
  const bought = Boolean(idea.boughtAt);
  const store = storeLabel(idea.externalUrl);
  const href = { pathname: "/gift-idea/[id]", params: { id: idea.id } } as const;
  const ios = Platform.OS === "ios";

  const content = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${idea.title}${bought ? ", bought" : ""}${idea.price ? `, ${formatPrice(idea.price)}` : ""}`}
      accessibilityHint="Opens the idea to edit it"
      // On iPhone the Link below opens it and adds the long-press menu.
      onPress={ios ? undefined : () => router.push(href)}
      onLongPress={ios ? undefined : () => showActions(idea, actions)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceAlt : theme.surface }]}
    >
      <View style={{ opacity: bought ? 0.5 : 1 }}>
        <ItemImage uri={idea.imageUrl} size={64} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="subhead" numberOfLines={2} style={{ fontWeight: "500" }}>
          {idea.title}
        </Text>
        {bought ? <Pill label="Bought" tone="success" icon="check" /> : null}
        {idea.price || store ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {idea.price ? (
              <Text variant="footnote" style={{ fontWeight: "600" }}>
                {formatPrice(idea.price)}
              </Text>
            ) : null}
            {store ? (
              <Text variant="footnote" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {store}
              </Text>
            ) : null}
          </View>
        ) : null}
        {idea.notes ? (
          <Text variant="footnote" tone="secondary" numberOfLines={2}>
            {idea.notes}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Bought it: ${idea.title}`}
        accessibilityState={{ checked: bought }}
        hitSlop={10}
        onPress={() => {
          haptic(bought ? "tap" : "success");
          actions.setBought(idea, !bought);
        }}
        style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
      >
        <Icon name={bought ? "checkCircle" : "circle"} size={26} color={bought ? theme.success : theme.textTertiary} />
      </Pressable>
    </Pressable>
  );

  if (!ios) return content;

  return (
    <Link href={href} asChild>
      <Link.Trigger>{content}</Link.Trigger>
      <Link.Menu>
        <Link.MenuAction
          title={bought ? "Not bought yet" : "Bought it"}
          icon={bought ? "arrow.uturn.backward" : "checkmark.circle"}
          onPress={() => actions.setBought(idea, !bought)}
        />
        {idea.externalUrl ? <Link.MenuAction title="Shop" icon="safari" onPress={() => openLink(idea)} /> : null}
        <Link.MenuAction title="Delete idea" icon="trash" destructive onPress={() => actions.remove(idea)} />
      </Link.Menu>
    </Link>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
});
