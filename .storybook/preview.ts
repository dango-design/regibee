import type { Decorator, Preview } from "@storybook/react";
import { MINIMAL_VIEWPORTS } from "storybook/viewport";
import { fontVariables } from "../src/app/fonts";
import "../src/app/globals.css";

// Match the root layout (src/app/layout.tsx): font variables on <html>, body
// font on <body>. Then stories, and the dialogs they open in portals, use the
// site's fonts.
document.documentElement.classList.add(...fontVariables.split(" "));
document.body.classList.add("font-sans", "antialiased");

// The site follows the device's light or dark setting (src/app/globals.css).
// Stories don't: each one shows in light, even on a computer set to dark, so
// Chromatic and the story screenshots always see the same thing. A story with
// `parameters: { theme: "dark" }` shows in dark. The Theme menu in the
// toolbar shows any story in dark while you work, without a snapshot.
const withTheme: Decorator = (Story, context) => {
  const dark = (context.parameters.theme ?? context.globals.theme) === "dark";
  document.documentElement.classList.toggle("dark-mode", dark);
  document.documentElement.classList.toggle("light-mode", !dark);
  return Story();
};

const preview: Preview = {
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    // The viewports a story can pick with `globals: { viewport: { value: "mobile1" } }`.
    // Storybook's toolbar offers these even without this line. The story
    // screenshots (story-screenshots/) read each viewport's size from here.
    // Chromatic doesn't use a story's viewport at all: the story also needs a
    // mode from src/stories/viewports.ts.
    viewport: { options: MINIMAL_VIEWPORTS },
  },
  globalTypes: {
    theme: {
      description: "Light or dark mode",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [withTheme],
};

export default preview;
