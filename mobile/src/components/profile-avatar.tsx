// An account's profile photo in a circle, or the name's initials when there's
// no photo, as the website's ProfileAvatar shows it
// (src/components/profile-avatar.tsx on the website).

import { Image } from "expo-image";
import { View } from "react-native";

import { Text } from "@/components/ui";
import { initials } from "@/lib/format";
import { useTheme } from "@/lib/theme";

export function ProfileAvatar({ name, photoUrl, size = 60 }: { name: string; photoUrl?: string | null; size?: number }) {
  const theme = useTheme();
  const circle = { width: size, height: size, borderRadius: size / 2 };
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[circle, { backgroundColor: theme.surfaceAlt }]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
        // The name is next to it, so the photo adds nothing for a screen reader.
        accessible={false}
      />
    );
  }
  return (
    <View style={[circle, { backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }]}>
      <Text variant="title" style={{ color: theme.onAccentSoft, fontSize: Math.round(size * 0.37) }}>
        {initials(name)}
      </Text>
    </View>
  );
}
