import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";

import { ItemEditor } from "@/components/item-editor";
import { Button, EmptyState, IconButton, LoadingState } from "@/components/ui";
import { useRegistries } from "@/lib/data";
import { rememberRegistry, useDefaultRegistry } from "@/lib/last-registry";
import { spacing, useTheme } from "@/lib/theme";

/**
 * Add an item. Opened from a registry, or by a regibee://add?url=… link, where
 * the owner picks a registry or Gift ideas, like one more list.
 */
export default function AddScreen() {
  const params = useLocalSearchParams<{
    registryId?: string;
    url?: string;
    title?: string;
    // From the baby checklist's "Yes, add its link" (src/app/registry/[id]/checklist.tsx).
    checklistEntry?: string;
    categoryId?: string;
    quantity?: string;
    notes?: string;
  }>();
  const theme = useTheme();
  const registries = useRegistries();
  const fallback = useDefaultRegistry(registries.data, params.registryId);
  const [chosen, setChosen] = useState<string | null>(null);
  const registryId = chosen ?? fallback ?? null;

  /** Opens the gift idea form (src/app/idea.tsx) with the link. */
  function saveAsGiftIdea() {
    router.replace({ pathname: "/idea", params: { url: params.url, title: params.title } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Cancel" onPress={() => router.back()} />
              : undefined,
        }}
      />
      {fallback === undefined ? (
        <LoadingState />
      ) : !registryId ? (
        <EmptyState
          icon="gift"
          title="You don't have a registry yet"
          message="Save it as a gift idea instead. Only you see gift ideas. Or create a registry first."
          action={
            <View style={{ width: "100%", maxWidth: 320, gap: spacing.sm }}>
              <Button title="Save as a gift idea" icon="sparkles" onPress={saveAsGiftIdea} />
              <Button title="Create a registry" icon="add" variant="secondary" onPress={() => router.replace("/new-registry")} />
            </View>
          }
        />
      ) : (
        <ItemEditor
          mode="add"
          registryId={registryId}
          // Opened from a registry, the item goes there. Opened from a link, the owner picks.
          registries={params.registryId ? undefined : registries.data}
          onRegistryChange={setChosen}
          // Only offered when the owner picks the list.
          onChooseGiftIdea={params.registryId ? undefined : saveAsGiftIdea}
          initialLink={params.url ?? null}
          initialTitle={params.title ?? null}
          fromChecklist={
            params.checklistEntry
              ? {
                  entry: params.checklistEntry,
                  categoryId: params.categoryId || null,
                  quantity: Math.max(1, Number(params.quantity) || 1),
                  notes: params.notes ?? "",
                }
              : null
          }
          onDone={(result) => {
            if (result.type === "added") rememberRegistry(result.registryId);
            router.back();
          }}
        />
      )}
    </View>
  );
}
