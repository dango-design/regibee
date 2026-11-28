// A list of lists to put in order, each with up and down arrows, like the
// website's ListOrderEditor (src/components/list-order-editor.tsx on the
// website). The home screen uses it for the person's own order, and the
// profile screen for their profile's. The parent saves each move.

import { Pressable, StyleSheet, View } from "react-native";

import type { DashboardManager } from "@shared/dashboard-page-types";
import { moveList } from "@shared/list-order";

import { Icon } from "@/components/icon";
import { ManagerFaces } from "@/components/manager-faces";
import { haptic, Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

export interface OrderableList {
  id: string;
  title: string;
  managers?: DashboardManager[];
}

export function ListOrderRows({
  lists,
  onMove,
}: {
  /** In the order shown. */
  lists: OrderableList[];
  /** Gets the ids in their new order. */
  onMove: (ids: string[]) => void;
}) {
  const theme = useTheme();
  const ids = lists.map((list) => list.id);

  const arrow = (list: OrderableList, by: -1 | 1, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Move ${list.title} ${by < 0 ? "up" : "down"}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => {
        haptic();
        onMove(moveList(ids, list.id, by));
      }}
      style={({ pressed }) => [styles.arrow, { opacity: disabled ? 0.25 : pressed ? 0.5 : 1 }]}
    >
      <Icon name={by < 0 ? "arrowUp" : "arrowDown"} size={18} color={theme.tint} />
    </Pressable>
  );

  return (
    <View style={{ gap: spacing.sm }}>
      {lists.map((list, index) => (
        <View key={list.id} style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text variant="body" numberOfLines={1} style={{ flex: 1, fontWeight: "600" }}>
            {list.title}
          </Text>
          <ManagerFaces managers={list.managers ?? []} />
          {arrow(list, -1, index === 0)}
          {arrow(list, 1, index === lists.length - 1)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  arrow: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
