import { MINIMAL_VIEWPORTS } from "storybook/viewport";

// Chromatic modes for stories that pick a viewport. See "Visual tests
// (Chromatic)" in CLAUDE.md.
//
// A story picks a viewport with `globals: { viewport: { value: "mobile1" } }`.
// Storybook and the story screenshots then show it at that size, but Chromatic
// still lists it at 1200px. Chromatic uses another width only when the story
// names a mode, so a story that picks a viewport also sets the matching mode:
//
//   parameters: { chromatic: { modes: PHONE_MODES } },
//   globals: { viewport: { value: "mobile1" } },
//
// A story with one mode gets one snapshot, at that width, in place of the
// 1200px one. The story screenshots fail a snapshotted story whose viewport
// and mode don't match.

// Storybook's mobile1, 320px wide.
export const PHONE_MODES = { phone: { viewport: MINIMAL_VIEWPORTS.mobile1.styles.width } };

// Storybook's desktop, 1280px wide.
export const DESKTOP_MODES = { desktop: { viewport: MINIMAL_VIEWPORTS.desktop.styles.width } };
