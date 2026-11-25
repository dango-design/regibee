import { useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Platform, View } from "react-native";

import { ItemEditor } from "@/components/item-editor";
import { EmptyState, IconButton } from "@/components/ui";
import { keys } from "@/lib/data";
import type { RegistryDetail } from "@/lib/types";
import { useTheme } from "@/lib/theme";

/** Edit an item. The registry screen has already loaded it. */
export default function EditItemScreen() {
  const { id, registryId } = useLocalSearchParams<{ id: string; registryId?: string }>();
  const theme = useTheme();
  const queryClient = useQueryClient();

  // The item as the list it was opened from shows it. An item can be on
  // several lists, each with its own category, and removing it takes it off
  // this list only. Without a list, any loaded list that has it.
  const lists = registryId
    ? [queryClient.getQueryData<RegistryDetail>(keys.registry(registryId))]
    : queryClient.getQueriesData<RegistryDetail>({ queryKey: ["registry"] }).map(([, detail]) => detail);
  const item = lists.flatMap((detail) => detail?.items ?? []).find((i) => i.id === id);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Close" onPress={() => router.back()} />
              : undefined,
          headerRight: item?.external_url
            ? () => (
                <IconButton
                  icon="external"
                  accessibilityLabel="Open store page"
                  onPress={() => WebBrowser.openBrowserAsync(item.external_url!)}
                />
              )
            : undefined,
        }}
      />
      {item ? (
        <ItemEditor mode="edit" registryId={item.registry_id} item={item} onDone={() => router.back()} />
      ) : (
        <EmptyState icon="error" title="This item is gone" message="It may have been deleted on another device." />
      )}
    </View>
  );
}
