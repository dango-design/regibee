import type { Meta, StoryObj } from "@storybook/react";
import { NavBar } from "./nav-bar";

const account = {
  name: "Remi & Max",
  profilePath: "/u/remi-max-k7m2p9qx4t",
  email: "remi@example.com",
  followRequestCount: 0,
};

const meta: Meta<typeof NavBar> = {
  title: "Components/NavBar",
  component: NavBar,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
  },
  args: { account },
};
export default meta;
type Story = StoryObj<typeof NavBar>;

export const SignedIn: Story = {};

// The menu button shows the profile photo instead of initials.
export const SignedInWithPhoto: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { account: { ...account, photoUrl: "/hero/panda.svg" } },
};

export const WithFollowRequests: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { account: { ...account, followRequestCount: 3 } },
};

export const SignedOut: Story = {
  args: { account: null },
};

export const Phone: Story = {
  args: { account: { ...account, followRequestCount: 1 } },
  globals: { viewport: { value: "mobile1" } },
};
