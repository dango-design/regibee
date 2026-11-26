import type { IconName } from "@/components/icon";

export interface HeaderMenuChoice {
  label: string;
  /** Shown next to the label on iPhone. Android menus show text only. */
  icon?: IconName;
  /** Shown in red, for a choice that deletes something. */
  destructive?: boolean;
  onPress: () => void;
}

export interface HeaderMenuProps {
  /** Read by VoiceOver and TalkBack for the "…" button. */
  accessibilityLabel: string;
  /** Shown above the choices where the menu falls back to a sheet (the web preview). */
  title: string;
  choices: HeaderMenuChoice[];
}
