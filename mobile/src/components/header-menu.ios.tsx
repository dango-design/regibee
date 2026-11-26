// The "…" button in a screen's header on iPhone. It opens the system's
// pull-down menu under the button, as Mail and Files do. A tap anywhere else
// closes it.

import { Button, Host, Menu } from "@expo/ui/swift-ui";
import { accessibilityLabel, imageScale, labelStyle, tint } from "@expo/ui/swift-ui/modifiers";
import type { SFSymbol } from "sf-symbols-typescript";

import { sfSymbol } from "@/components/icon";
import { useTheme } from "@/lib/theme";

import type { HeaderMenuProps } from "./header-menu-types";

export type { HeaderMenuChoice } from "./header-menu-types";

export function HeaderMenu({ accessibilityLabel: label, choices }: HeaderMenuProps) {
  const theme = useTheme();
  return (
    <Host matchContents>
      <Menu
        label={label}
        systemImage="ellipsis.circle"
        modifiers={[labelStyle("iconOnly"), imageScale("large"), tint(theme.tint), accessibilityLabel(label)]}
      >
        {choices.map((choice) => (
          <Button
            key={choice.label}
            label={choice.label}
            systemImage={choice.icon ? (sfSymbol(choice.icon) as SFSymbol) : undefined}
            role={choice.destructive ? "destructive" : undefined}
            onPress={choice.onPress}
          />
        ))}
      </Menu>
    </Host>
  );
}
