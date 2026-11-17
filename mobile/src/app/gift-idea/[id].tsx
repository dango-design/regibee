import { router, Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Platform, View } from "react-native";

import { ItemEditor } from "@/components/item-editor";
import { EmptyState, IconButton, LoadingState } from "@/components/ui";
import { useGiftIdeas } from "@/lib/data";
import { GIFT_IDEAS } from "@/lib/last-registry";
import { useTheme } from "@/lib/theme";

/** Edit a gift idea. The Gift ideas screen has already loaded it. */
export default function EditGiftIdeaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const ideas = useGiftIdeas();
  const idea = ideas.data?.find((i) => i.id === id);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          headerLeft:
            Platform.OS === "ios"
              ? () => <IconButton icon="close" accessibilityLabel="Close" onPress={() => router.back()} />
              : undefined,
          headerRight: idea?.externalUrl
            ? () => (
                <IconButton
                  icon="external"
                  accessibilityLabel="Open store page"
                  onPress={() => WebBrowser.openBrowserAsync(idea.externalUrl!)}
                />
              )
            : undefined,
        }}
      />
      {idea ? (
        <ItemEditor key={idea.id} mode="edit" registryId={GIFT_IDEAS} idea={idea} onDone={() => router.back()} />
      ) : ideas.isPending ? (
        <LoadingState />
      ) : (
        <EmptyState icon="error" title="This gift idea is gone" message="It may have been deleted on another device." />
      )}
    </View>
  );
}
