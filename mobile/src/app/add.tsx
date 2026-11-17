import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";

import { ItemEditor } from "@/components/item-editor";
import { IconButton, LoadingState } from "@/components/ui";
import { useRegistries } from "@/lib/data";
import { GIFT_IDEAS, rememberRegistry, useDefaultRegistry } from "@/lib/last-registry";
import { useTheme } from "@/lib/theme";

/**
 * Add an item, or save a gift idea. Opened from a registry, from the Gift
 * ideas screen (registryId GIFT_IDEAS), or by a regibee://add?url=… link,
 * where the owner picks the list.
 */
export default function AddScreen() {
  const params = useLocalSearchParams<{ registryId?: string; url?: string; title?: string; recipient?: string }>();
  const theme = useTheme();
  const registries = useRegistries();
  const fallback = useDefaultRegistry(registries.data, params.registryId);
  const [chosen, setChosen] = useState<string | null>(null);
  const registryId = chosen ?? fallback ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          title: registryId === GIFT_IDEAS ? "Save a gift idea" : "Add an item",
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => router.back()} />
              : undefined,
        }}
      />
      {!registryId ? (
        <LoadingState />
      ) : (
        <ItemEditor
          mode="add"
          registryId={registryId}
          // Opened from a registry or gift ideas, it goes there. Opened from a link, the owner picks.
          registries={params.registryId ? undefined : registries.data}
          onRegistryChange={setChosen}
          initialLink={params.url ?? null}
          initialTitle={params.title ?? null}
          initialRecipient={params.recipient ?? null}
          onDone={(result) => {
            if (result.type === "added") rememberRegistry(result.registryId);
            router.back();
          }}
        />
      )}
    </View>
  );
}
