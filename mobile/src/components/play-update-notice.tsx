// The banner at the top of the Registries tab when Google Play has a newer
// build of the app than the one on this phone. See src/lib/play-update.ts.

import { View } from "react-native";

import { Notice } from "@/components/notice";
import { dismissPlayUpdate, installPlayUpdate, usePlayUpdateBanner } from "@/lib/play-update";
import { spacing } from "@/lib/theme";

export function PlayUpdateNotice() {
  const update = usePlayUpdateBanner();
  if (!update) return null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Notice
        icon="update"
        tone="tint"
        title="A new version of Regibee is ready"
        message="The app restarts when it's done."
        action={{ title: "Update", icon: "update", onPress: () => void installPlayUpdate(), loading: update.installing }}
        secondary={{ title: "Not now", onPress: dismissPlayUpdate }}
      />
    </View>
  );
}
