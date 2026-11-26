// One section of the home screen: a heading, maybe a link to see more, and
// what's under it.
//
// The home screen is a stack of these, so it can show whatever matters most
// to the person right now. Today that's their events and their lists. Later
// it may add recent updates, such as gifts and new items on lists they
// follow or price changes. A new section is one more of these.

import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui";
import { spacing } from "@/lib/theme";

export function HomeSection({
  title,
  more,
  children,
}: {
  title: string;
  /** A link at the heading's right, like "All events". */
  more?: { title: string; href: Href };
  children: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: spacing.xs }}>
        <Text variant="title" accessibilityRole="header" style={{ fontSize: 20, lineHeight: 26 }}>
          {title}
        </Text>
        {more ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={12}
            onPress={() => router.navigate(more.href)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text variant="subhead" tone="tint" style={{ fontWeight: "600" }}>
              {more.title}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
