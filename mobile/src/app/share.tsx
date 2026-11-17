// What another app shared to Regibee: a product link, usually with its name.
// On iPhone, a page shared from Safari arrives already read (see
// app.config.ts), so the form fills in at once.

import { router, Stack } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { Icon } from "@/components/icon";
import { ItemEditor } from "@/components/item-editor";
import { Button, EmptyState, haptic, LoadingState, Text } from "@/components/ui";
import { useRegistries } from "@/lib/data";
import { rememberRegistry, useDefaultRegistry } from "@/lib/last-registry";
import { parseReadProduct, parseSharedText } from "@/lib/product";
import { spacing, useTheme } from "@/lib/theme";

export default function ShareScreen() {
  const theme = useTheme();
  const { shareIntent, hasShareIntent, resetShareIntent } = useShareIntentContext();
  const registries = useRegistries();
  const fallback = useDefaultRegistry(registries.data);
  const [chosen, setChosen] = useState<string | null>(null);
  const [added, setAdded] = useState<{ registryId: string; title: string } | null>(null);
  const registryId = chosen ?? fallback ?? null;

  const shared = useMemo(() => {
    const read = (() => {
      const raw = shareIntent.meta?.["regibee:product"];
      if (!raw) return null;
      try {
        return parseReadProduct(JSON.parse(raw));
      } catch {
        return null;
      }
    })();
    const { url, title } = parseSharedText(shareIntent.text, read?.url || shareIntent.webUrl, shareIntent.meta?.title);
    return { url, title, product: read && (read.isProduct || read.price != null) ? read : null };
  }, [shareIntent]);

  function close() {
    resetShareIntent();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  const cancel = (
    <Stack.Screen
      options={{
        headerLeft: () => (
          <Text variant="body" tone="tint" onPress={close} accessibilityRole="button" suppressHighlighting>
            {added ? "Done" : "Cancel"}
          </Text>
        ),
      }}
    />
  );

  if (added) {
    const registry = registries.data?.find((r) => r.id === added.registryId);
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {cancel}
        <EmptyState
          icon="checkCircle"
          title="Added"
          message={`“${added.title}” is on ${registry?.title ?? "your registry"}.`}
          action={
            <View style={{ width: "100%", maxWidth: 320, gap: spacing.sm }}>
              <Button
                title="See the registry"
                onPress={() => {
                  resetShareIntent();
                  router.replace({ pathname: "/registry/[id]", params: { id: added.registryId } });
                }}
              />
              <Button title="Done" variant="secondary" onPress={close} />
            </View>
          }
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {cancel}
      {!hasShareIntent && !shared.url ? (
        <EmptyState
          icon="link"
          title="There's no link to add"
          message="What you shared didn't include a link to a product. Open the product in its store's app or your browser, then share it to Regibee again."
        />
      ) : fallback === undefined ? (
        <LoadingState />
      ) : !registryId ? (
        <EmptyState
          icon="gift"
          title="Make a registry first"
          message="You don't have a registry to add this to yet. Make one, then share the product to Regibee again."
          action={<Button title="Create a registry" icon="add" onPress={() => router.push("/new-registry")} />}
        />
      ) : (
        <ItemEditor
          // Start over if a new share arrives while this one is open.
          key={`${shared.url}|${shared.title}`}
          mode="add"
          registryId={registryId}
          registries={registries.data}
          onRegistryChange={setChosen}
          initialLink={shared.url}
          initialTitle={shared.title}
          initialProduct={shared.product}
          header={
            <View style={{ gap: spacing.sm }}>
              {shared.product ? (
                <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                  <Icon name="checkCircle" size={16} color={theme.success} />
                  <Text variant="footnote" tone="secondary">
                    Read from the page you shared.
                  </Text>
                </View>
              ) : null}
              {/* The website's share page asks "For you" or "For someone else" (src/components/share-picker.tsx). */}
              <Button
                title="For someone else? Save as a gift idea"
                icon="sparkles"
                variant="secondary"
                size="small"
                onPress={() => {
                  resetShareIntent();
                  router.replace({
                    pathname: "/idea",
                    params: { url: shared.url ?? undefined, title: shared.title ?? undefined },
                  });
                }}
              />
            </View>
          }
          onDone={(result) => {
            if (result.type !== "added") return;
            rememberRegistry(result.registryId);
            haptic("success");
            setAdded({ registryId: result.registryId, title: result.title });
            // Handled, so opening the app later doesn't offer it again.
            resetShareIntent();
          }}
        />
      )}
    </View>
  );
}
