// The "⋮" button in a screen's header, or at the end of a row, on Android. It opens a Material menu
// that drops down from the button, like other Android apps' overflow menus.
// A tap anywhere else closes it.

import { DropdownMenu, DropdownMenuItem, Host, Icon, IconButton, Text } from "@expo/ui/jetpack-compose";
import { useState } from "react";

import { haptic } from "@/components/ui";
import { useTheme } from "@/lib/theme";

import type { HeaderMenuProps } from "./header-menu-types";

export type { HeaderMenuChoice } from "./header-menu-types";

const moreIcon = require("../../assets/icons/more_vert.xml");

export function HeaderMenu({ accessibilityLabel, choices, size = "large" }: HeaderMenuProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Host matchContents>
      <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)} color={theme.surface}>
        <DropdownMenu.Trigger>
          <IconButton
            onClick={() => {
              haptic();
              setOpen(true);
            }}
          >
            <Icon source={moreIcon} tint={theme.tint} size={size === "small" ? 20 : 24} contentDescription={accessibilityLabel} />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {choices.map((choice) => (
            <DropdownMenuItem
              key={choice.label}
              onClick={() => {
                setOpen(false);
                choice.onPress();
              }}
            >
              <DropdownMenuItem.Text>
                <Text color={choice.destructive ? theme.danger : theme.text}>{choice.label}</Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
