// "Items to check": the notices about a list's items that used to sit above
// them on the list's screen. Filled-in details to review, items missing a
// photo or price, and plain store links. The list's summary card opens it
// while any of them has something to say, and the items themselves carry a
// tag.

import { Stack, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, RefreshControl, ScrollView, View } from "react-native";

import { getStore } from "@shared/retailers";

import { DetailReview, MissingDetailsNotice } from "@/components/list-details";
import { Notice } from "@/components/notice";
import { EmptyState, ErrorState, LoadingState, Text } from "@/components/ui";
import { errorMessage, useHidePlainLinks, useRegistry } from "@/lib/data";
import { usePullToRefresh } from "@/lib/pull-to-refresh";
import { spacing, useTheme } from "@/lib/theme";
import type { RegistryDetail } from "@/lib/types";

export default function ItemsToCheckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const registry = useRegistry(id);
  const pull = usePullToRefresh(registry.refetch);
  const data = registry.data;

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {registry.isError ? (
          <ErrorState message={errorMessage(registry.error)} onRetry={() => registry.refetch()} />
        ) : (
          <LoadingState />
        )}
      </View>
    );
  }

  const nothing = data.detailReview.length + data.missingDetails.length + data.plainLinkGroups.length === 0;

  return (
    <>
      <Stack.Screen options={{ title: "Items to check" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 60 }}
        refreshControl={<RefreshControl {...pull} tintColor={theme.tint} />}
      >
        {/* The website's order: the review, what's missing, then plain links. */}
        <DetailReview registryId={data.registry.id} reviews={data.detailReview} />
        {/* Always here, so it keeps reading while the list reloads after each item. */}
        <MissingDetailsNotice registryId={data.registry.id} items={data.missingDetails} />
        <PlainLinksNotices detail={data} />
        {nothing ? <EmptyState icon="checkCircle" title="Nothing to check" message="Every item has its details." /> : null}
      </ScrollView>
    </>
  );
}

/** The website's plain store links notice (src/components/plain-links-notice.tsx). */
function PlainLinksNotices({ detail }: { detail: RegistryDetail }) {
  const hide = useHidePlainLinks(detail.registry.id);
  return (
    <>
      {detail.plainLinkGroups.map((group) => {
        const store = getStore(group.storeId);
        const count = group.items.length;
        const one = count === 1;
        const linked = detail.linkedRegistries?.find((l) => l.store === group.storeId);
        const openUrl = linked?.url ?? store.registryPage?.openUrl ?? `https://www.${store.domain}`;
        return (
          <Notice
            key={group.storeId}
            icon="error"
            tone="accent"
            title={one ? `1 item has a plain ${store.name} link` : `${count} items have plain ${store.name} links`}
            message={
              one
                ? `Gifts bought through it won't count toward your ${store.name} registry. Add it to your ${store.name} registry, then edit the item and paste its registry link.`
                : `Gifts bought through them won't count toward your ${store.name} registry. Add them to your ${store.name} registry, then edit each item and paste its registry link.`
            }
            action={{ title: `Open my ${store.name} registry`, icon: "external", onPress: () => WebBrowser.openBrowserAsync(openUrl) }}
            secondary={{
              title: "Don't remind me",
              onPress: () =>
                hide.mutate(
                  group.items.map((i) => i.id),
                  { onError: (e) => Alert.alert("Couldn't save that", errorMessage(e)) }
                ),
            }}
          >
            <Text variant="footnote" tone="secondary" style={{ paddingLeft: 46 }}>
              {group.items.map((i) => `• ${i.title}`).join("\n")}
            </Text>
          </Notice>
        );
      })}
    </>
  );
}
