import { View } from "react-native";

import { listProgressParts, type ListProgress, type ListProgressPart } from "@shared/gifts";

import { Text } from "@/components/ui";
import { useTheme, type Theme } from "@/lib/theme";

/**
 * Each part's color. Covered is gifted's color, lighter, since it is gifted
 * too. Bought by you takes the bee's yellow. What's left to buy is the empty
 * track. The website's bar (src/components/list-progress-bar.tsx) uses the
 * same order and meaning.
 */
function partColor(theme: Theme, part: ListProgressPart) {
  if (part === "gifted" || part === "covered") return theme.success;
  if (part === "bought-by-you") return theme.accent;
  return theme.surfaceAlt;
}

/**
 * A list's progress for its owner: what guests gave, what guests covered after
 * the owner bought it, what the owner bought, and what's left to buy
 * (listProgress in @shared/gifts).
 */
export function ListProgressBar({ progress }: { progress: ListProgress }) {
  const theme = useTheme();
  const parts = listProgressParts(progress);
  const percent = progress.total > 0 ? Math.round((progress.gifted / progress.total) * 100) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Items gifted"
      accessibilityValue={{ min: 0, max: 100, now: percent, text: parts.map((p) => p.label).join(", ") }}
      style={{ flexDirection: "row", height: 6, borderRadius: 3, backgroundColor: theme.surfaceAlt, overflow: "hidden" }}
    >
      {parts
        .filter((p) => p.part !== "to-buy")
        .map((p) => (
          <View
            key={p.part}
            style={{
              width: `${(p.count / progress.total) * 100}%`,
              height: "100%",
              backgroundColor: partColor(theme, p.part),
              opacity: p.part === "covered" ? 0.5 : 1,
            }}
          />
        ))}
    </View>
  );
}

/** The key under the bar: "4 gifted · 1 covered · 2 bought by you · 5 to buy". */
export function ListProgressKey({ progress }: { progress: ListProgress }) {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}
    >
      {listProgressParts(progress).map((p) => (
        <View key={p.part} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: partColor(theme, p.part),
              opacity: p.part === "covered" ? 0.5 : 1,
              borderWidth: p.part === "to-buy" ? 1 : 0,
              borderColor: theme.border,
            }}
          />
          <Text variant="footnote" tone="tertiary">
            {p.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
