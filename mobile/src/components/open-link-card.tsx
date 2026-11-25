// Opens a Regibee link someone sent, such as a list, an invitation or an
// invite to help manage a list, inside the app and signed in. Until links to
// regibee.com open the app by themselves, this is how a link from a text
// message or an email gets here.

import { useState } from "react";
import { View } from "react-native";

import { PasteLinkButton } from "@/components/paste-link-button";
import { Card, Text } from "@/components/ui";
import { spacing } from "@/lib/theme";
import { openSite, sitePathFromLink } from "@/lib/web";

export function OpenLinkCard() {
  const [error, setError] = useState<string | null>(null);

  function open(text: string) {
    // A message can hold more than the link. Take the first link in it.
    const link = text.match(/(https?:\/\/|regibee:\/\/)\S+/i)?.[0] ?? text;
    const path = sitePathFromLink(link);
    if (!path) {
      setError("That isn't a link to a Regibee list, profile or invitation.");
      return;
    }
    setError(null);
    openSite(path);
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="headline">Got a Regibee link?</Text>
          <Text variant="footnote" tone="secondary">
            Copy a link to a list, a profile or an invitation, then paste it to open it here, signed in as you.
          </Text>
        </View>
        <PasteLinkButton onPaste={open} />
      </View>
      {error ? (
        <Text variant="footnote" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </Card>
  );
}
