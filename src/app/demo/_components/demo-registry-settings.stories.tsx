import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DemoRegistrySettings } from "./demo-registry-settings";
import { demoPageParameters, withDemoToday } from "../story-today";
import { DESKTOP_MODES, PHONE_MODES } from "@/stories/viewports";

/** Puts a section's #fragment in the URL, as a link from another page does. */
const withSectionInUrl = (section: string) => () => {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${section}`);
};

const meta: Meta<typeof DemoRegistrySettings> = {
  title: "Pages/Registry Settings",
  component: DemoRegistrySettings,
  parameters: demoPageParameters("/demo/dashboard/registry/baby/settings"),
  decorators: [withDemoToday],
  // The section navigation goes to the section in the URL's #fragment.
  // Storybook keeps the URL between stories, so each starts without one.
  beforeEach: () => {
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  },
};
export default meta;
type Story = StoryObj<typeof DemoRegistrySettings>;

// Every section, with store registries and a co-manager, and the sections
// listed on the left like the Account page.
export const Default: Story = {
  args: { registryId: "baby" },
  parameters: { chromatic: { modes: DESKTOP_MODES } },
  globals: { viewport: { value: "desktop" } },
};

/**
 * The add-item dialog's "Link registry" links to #store-registries. The page
 * opens there, with that section current and focus on its title.
 */
export const LandingOnStoreRegistries: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { registryId: "baby" },
  globals: { viewport: { value: "desktop" } },
  beforeEach: withSectionInUrl("store-registries"),
  play: async ({ canvas }) => {
    const nav = within(canvas.getByRole("navigation", { name: "Registry settings sections" }));
    await waitFor(() => expect(canvas.getByRole("heading", { name: "Your store registries" })).toHaveFocus());
    await expect(nav.getByRole("link", { name: "Your store registries" })).toHaveAttribute("aria-current", "location");
    // The section starts under the top bar, not behind it.
    const top = document.getElementById("store-registries")!.getBoundingClientRect().top;
    await expect(top).toBeGreaterThanOrEqual(64);
  },
};

/**
 * On a phone the sections are a row of links under the top bar that scrolls
 * sideways by itself. Following one goes to its section.
 */
export const Phone: Story = {
  args: { registryId: "baby" },
  parameters: { chromatic: { modes: PHONE_MODES } },
  globals: { viewport: { value: "mobile1" } },
  play: async ({ canvas }) => {
    const nav = within(canvas.getByRole("navigation", { name: "Registry settings sections" }));
    await userEvent.click(nav.getByRole("link", { name: "Managers" }));
    await waitFor(() => expect(nav.getByRole("link", { name: "Managers" })).toHaveAttribute("aria-current", "location"));
    await expect(canvas.getByRole("heading", { name: "Managers" })).toHaveFocus();
    // The row scrolls; the page doesn't.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
