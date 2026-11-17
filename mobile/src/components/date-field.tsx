// A date or time, picked with the phone's own picker. Dates are kept as
// YYYY-MM-DD and times as HH:MM, the way the website stores them.

import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { Icon } from "@/components/icon";
import { haptic, Text } from "@/components/ui";
import { formatEventDate, toYmd } from "@/lib/format";
import { radius, spacing, useTheme } from "@/lib/theme";

function fromYmd(ymd: string | null) {
  if (!ymd) return new Date();
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function fromTime(time: string | null) {
  const now = new Date();
  if (!time) {
    now.setHours(18, 0, 0, 0);
    return now;
  }
  const [h, m] = time.split(":").map(Number);
  now.setHours(h || 0, m || 0, 0, 0);
  return now;
}

function toTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** "6:30 PM" from "18:30". */
export function formatTime(time: string | null) {
  if (!time) return null;
  return fromTime(time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  placeholder,
  hint,
  clearable = true,
}: {
  label: string;
  /** YYYY-MM-DD for a date, HH:MM for a time, or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  mode?: "date" | "time";
  placeholder?: string;
  hint?: string;
  clearable?: boolean;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const shown = mode === "date" ? formatEventDate(value) : formatTime(value);
  const current = mode === "date" ? fromYmd(value) : fromTime(value);

  return (
    <View style={{ gap: 6 }}>
      <Text variant="footnote" tone="secondary" style={{ fontWeight: "600" }}>
        {label}
      </Text>
      <View style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown ?? "not set"}`}
          onPress={() => {
            haptic();
            if (!value) onChange(mode === "date" ? toYmd(current) : toTime(current));
            setOpen((o) => !o);
          }}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48 }}
        >
          <Icon name={mode === "date" ? "calendar" : "clock"} size={17} color={theme.tint} />
          <Text variant="body" style={{ color: shown ? theme.text : theme.placeholder }}>
            {shown ?? placeholder ?? (mode === "date" ? "Pick a date" : "Pick a time")}
          </Text>
        </Pressable>
        {value && clearable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            hitSlop={8}
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <Icon name="close" size={15} color={theme.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <View style={{ alignItems: Platform.OS === "ios" ? "center" : "flex-start" }}>
          <DateTimePicker
            value={current}
            mode={mode}
            display={Platform.OS === "ios" ? (mode === "date" ? "inline" : "spinner") : "default"}
            accentColor={theme.tint}
            themeVariant={theme.dark ? "dark" : "light"}
            onChange={(event, next) => {
              if (Platform.OS === "android") setOpen(false);
              if (event.type === "set" && next) onChange(mode === "date" ? toYmd(next) : toTime(next));
            }}
          />
        </View>
      ) : null}
      {hint ? (
        <Text variant="footnote" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
});
