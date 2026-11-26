// The "…" button in a screen's header. iPhone and Android use the system's own
// menu (header-menu.ios.tsx, header-menu.android.tsx). This file is for the
// web preview, which has no native menu, so it opens the bottom sheet.

import { useState } from "react";

import { ChoiceSheet } from "@/components/choice-sheet";
import { IconButton } from "@/components/ui";

import type { HeaderMenuProps } from "./header-menu-types";

export type { HeaderMenuChoice } from "./header-menu-types";

export function HeaderMenu({ accessibilityLabel, title, choices }: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="more" accessibilityLabel={accessibilityLabel} onPress={() => setOpen(true)} />
      <ChoiceSheet visible={open} onClose={() => setOpen(false)} title={title} choices={choices} />
    </>
  );
}
