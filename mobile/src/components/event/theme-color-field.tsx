// The invitation's color, in the event form: none, a few to start from, or
// any color typed as a hex code. A small panel shows how the gift lists will
// look. The website's ThemeColorField (src/components/theme-color-field.tsx),
// with the same presets and rules (@shared/event-colors).
//
// Where the app differs: the website opens the browser's color picker for
// "any color". The app has no color picker, so the host types the code.

import { useState } from "react";
import { Pressable, View } from "react-native";

import { markOn, normalizeThemeColor, THEME_COLOR_PRESETS, themeColors } from "@shared/event-colors";

import { Icon } from "@/components/icon";
import { Chip, Field, haptic, Text } from "@/components/ui";
import { radius, spacing, useTheme } from "@/lib/theme";

/** "#a1b2c3" from what the host typed, with or without the #. Null when it isn't a color yet. */
function readHex(text: string): string | null {
  const trimmed = text.trim();
  return normalizeThemeColor(trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
}

/** The value is "" for none, or "#rrggbb". */
export function ThemeColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const theme = useTheme();
  const color = normalizeThemeColor(value);
  const custom = color !== null && !THEME_COLOR_PRESETS.some((p) => p.color === color);
  const colors = color ? themeColors(color) : null;
  // What's in the hex field. It starts with a color of the host's own.
  const [typed, setTyped] = useState(custom ? color : "");
  const typedIsWrong = typed.trim() !== "" && readHex(typed) === null;

  const choose = (next: string) => {
    setTyped("");
    onChange(next);
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
          Color
        </Text>
        <Text variant="footnote" tone="tertiary">
          Fills the invitation's gift lists and wishlists, and its top when there's no picture. Pick one that goes with your
          invitation.
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
        <Chip label="None" selected={color === null} onPress={() => choose("")} />
        {THEME_COLOR_PRESETS.map((preset) => {
          const selected = color === preset.color;
          return (
            <Pressable
              key={preset.color}
              accessibilityRole="button"
              accessibilityLabel={preset.label}
              accessibilityState={{ selected }}
              hitSlop={4}
              onPress={() => {
                haptic();
                choose(preset.color);
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: preset.color,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.text : theme.border,
              }}
            >
              {selected ? <Icon name="check" size={16} color={markOn(preset.color)} weight="bold" /> : null}
            </Pressable>
          );
        })}
      </View>
      <Field
        label="Or any color"
        value={typed}
        onChangeText={(text) => {
          setTyped(text);
          const next = readHex(text);
          // An unfinished code keeps the color picked before it.
          if (next) onChange(next);
          else if (text.trim() === "" && custom) onChange("");
        }}
        placeholder="#c3e3e8"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={7}
        error={typedIsWrong ? "Type a color code with six letters or numbers, like #c3e3e8." : null}
        leading={
          custom ? (
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color, borderWidth: 1, borderColor: theme.border }} />
          ) : undefined
        }
      />
      {colors ? (
        // Always on a light fill, so the text keeps the website's dark color in dark mode too.
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.fill }}
        >
          <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" }}>
            <Icon name="gift" size={16} color={colors.ink} />
          </View>
          <Text variant="subhead" style={{ fontWeight: "600", color: "#231b18" }}>
            How the gift lists will look
          </Text>
        </View>
      ) : null}
    </View>
  );
}
