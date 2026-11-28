// The other people who manage a list, as a row of overlapping faces, like the
// website's ManagerAvatars (src/components/manager-avatars.tsx on the
// website). It shows on a list's card on the home screen and in the reorder
// list, so a list shared with someone is easy to spot.

import { View } from "react-native";

import type { DashboardManager } from "@shared/dashboard-page-types";

import { ProfileAvatar } from "@/components/profile-avatar";
import { Text } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** Up to this many faces, then "+2". */
const MAX_FACES = 3;
const SIZE = 26;

/** "Shared with Ana", "Shared with Ana and Ben", "Shared with Ana, Ben and Cy". */
export function sharedWithLabel(managers: DashboardManager[]): string {
  const names = managers.map((manager) => manager.name);
  const list = names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Shared with ${list}`;
}

/** Nothing when only the viewer manages the list. Screen readers get sharedWithLabel from the card. */
export function ManagerFaces({ managers }: { managers: DashboardManager[] }) {
  const theme = useTheme();
  if (managers.length === 0) return null;
  const faces = managers.slice(0, MAX_FACES);
  const more = managers.length - faces.length;
  const ring = { borderWidth: 2, borderColor: theme.surface, borderRadius: (SIZE + 4) / 2 };

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center" }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {faces.map((manager, index) => (
        <View key={index} style={[ring, { marginLeft: index === 0 ? 0 : -8 }]}>
          <ProfileAvatar name={manager.name} photoUrl={manager.photoUrl} size={SIZE} />
        </View>
      ))}
      {more > 0 ? (
        <View
          style={[
            ring,
            {
              marginLeft: -8,
              width: SIZE + 4,
              height: SIZE + 4,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.surfaceAlt,
            },
          ]}
        >
          <Text variant="caption" tone="secondary" style={{ fontWeight: "700", fontSize: 11 }}>
            +{more}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
