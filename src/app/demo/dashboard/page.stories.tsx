import type { Meta, StoryObj } from "@storybook/react";
import DemoDashboardPage from "./page";
import { demoPageParameters, withDemoToday } from "../story-today";

const meta: Meta<typeof DemoDashboardPage> = {
  title: "Pages/Dashboard",
  component: DemoDashboardPage,
  parameters: demoPageParameters("/demo/dashboard"),
  decorators: [withDemoToday],
};
export default meta;
type Story = StoryObj<typeof DemoDashboardPage>;

// The My registries tab: the demo's guide, a follow request, the events
// coming up in a column at the right, and the baby registry and birthday
// wishlist.
export const Default: Story = {};

// The dashboard in dark mode.
export const Dark: Story = { parameters: { theme: "dark" } };

// A phone-sized screen: the events come before the lists.
export const Phone: Story = { globals: { viewport: { value: "mobile1" } } };
