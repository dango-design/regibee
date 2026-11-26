import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "@/components/ui/button";
import { NavBar } from "./nav-bar";
import { listHeader } from "@/lib/list-headers";
import { ListHeaderPicker } from "./list-header-picker";
import { OwnerListTop } from "./owner-list-top";

/**
 * The site's top bar above it and a few item rows under it, so a snapshot
 * shows how much of the first screen the top takes.
 */
const withListPage: Decorator = (Story) => (
  <div className="min-h-screen bg-primary">
    <NavBar account={null} returnTo="/dashboard" />
    <Story />
    <div className="container mx-auto flex flex-col gap-3 px-4 py-8">
      <h3 className="font-display text-lg font-semibold">Kitchen</h3>
      {["Enameled Dutch Oven", "Bread Knife", "Linen Apron"].map((title) => (
        <div key={title} className="flex items-center gap-4 rounded-2xl border border-secondary p-4">
          <div className="size-16 rounded-xl bg-secondary" />
          <p className="font-medium">{title}</p>
        </div>
      ))}
    </div>
  </div>
);

const actions = (
  <>
    <Button variant="outline">Share Link</Button>
    <Button variant="outline">Preview</Button>
    <Button variant="outline">Settings</Button>
  </>
);

const meta: Meta<typeof OwnerListTop> = {
  title: "Components/OwnerListTop",
  component: OwnerListTop,
  decorators: [withListPage],
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  args: {
    registryId: "reg-1",
    title: "Dorothy's Wishlist",
    occasion: "Wishlist",
    itemCount: 6,
    access: { visibility: "link", label: "Link only · friends see it on your profile", href: "#settings" },
    actions,
    progress: { gifted: 1, total: 6 },
    events: [],
    unlinkAction: fn(async () => ({ error: null })),
    dismissAction: fn(async () => ({ error: null })),
  },
};
export default meta;
type Story = StoryObj<typeof OwnerListTop>;

/** A wishlist with one event the owner hosts. */
export const Wishlist: Story = {
  args: {
    events: [{ id: "e1", title: "Dorothy's 60th", event_date: "2026-12-14", event_type: "birthday", canManage: true }],
  },
};

/**
 * Every part at once: hidden gifts (so no progress), an event the owner
 * hosts, one someone else hosts with an Unlink button, and the checklist.
 */
export const EverythingShowing: Story = {
  args: {
    title: "Remi & Max's Baby Registry",
    occasion: "Baby registry",
    itemCount: 32,
    dateLabel: "Due date: February 4, 2027",
    access: { visibility: "public", label: "Public · anyone sees it on your profile", href: "#settings" },
    progress: null,
    hidden: { revealed: 2, href: "?tab=purchases" },
    events: [
      { id: "e2", title: "Baby Shower", event_date: "2026-12-05", event_type: "baby_shower", canManage: true },
      {
        id: "e3",
        slug: "sip-and-see-k2m",
        title: "Sip and See",
        event_date: null,
        event_type: "other",
        canManage: false,
      },
    ],
    checklist: { matched: 25, total: 100, href: "#checklist" },
  },
};

export const OnPhone: Story = {
  ...EverythingShowing,
  globals: { viewport: { value: "mobile1" } },
};

/** No events yet: a small "Planning a party?" part that goes away when dismissed. */
export const PlanPrompt: Story = {
  args: { planPrompt: true },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Planning a party?")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(args.dismissAction).toHaveBeenCalledWith("reg-1");
    await expect(canvas.queryByText("Planning a party?")).not.toBeInTheDocument();
  },
};

export const Dark: Story = {
  ...EverythingShowing,
  parameters: { theme: "dark", chromatic: { disableSnapshot: true } },
};

/** A baby registry with a header the owner picked, and the Header button in its corner. */
export const BabyHeader: Story = {
  args: {
    ...EverythingShowing.args,
    header: listHeader({ color: "blush", pattern: "feet" }),
    customize: (
      <ListHeaderPicker
        registryId="reg-1"
        title="Remi & Max's Baby Registry"
        header={listHeader({ color: "blush", pattern: "feet" })}
        occasion="baby"
        saveAction={fn(async () => ({ error: null }))}
      />
    ),
  },
};

export const BabyHeaderDark: Story = {
  ...BabyHeader,
  parameters: { theme: "dark" },
};
