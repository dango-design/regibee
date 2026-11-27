import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
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

const picker = (title: string, header = listHeader(), occasion: "baby" | null = null) => (
  <ListHeaderPicker
    registryId="reg-1"
    title={title}
    header={header}
    occasion={occasion}
    saveAction={fn(async () => ({ error: null }))}
  />
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
    access: { visibility: "link", audience: "friends", href: "#settings" },
    sharePath: "/r/dorothys-wishlist-k2m9x4p7q1zw",
    links: { preview: "/r/dorothys-wishlist-k2m9x4p7q1zw", settings: "#settings", plan: "#plan" },
    customize: picker("Dorothy's Wishlist"),
    progress: { total: 6, toBuy: 5, boughtByYou: 0, gifted: 1, covered: 0 },
    events: [],
    unlinkAction: fn(async () => ({ error: null })),
    dismissAction: fn(async () => ({ error: null })),
  },
};
export default meta;
type Story = StoryObj<typeof OwnerListTop>;

/** A wishlist with one event the owner hosts. The card is only as wide as that one part. */
export const Wishlist: Story = {
  args: {
    events: [{ id: "e1", title: "Dorothy's 60th", event_date: "2026-12-14", event_type: "birthday", canManage: true }],
  },
};

/**
 * Gifts hidden from the owner: no progress, and a grayed, crossed-out gift
 * among the band's tools. A click explains it.
 */
export const HiddenGifts: Story = {
  args: {
    progress: null,
    hidden: {
      revealed: 0,
      href: "?tab=purchases",
      settingsHref: "#reservations",
      next: { date: "Dec 15", eventTitle: "Dorothy's 60th" },
    },
    events: [{ id: "e1", title: "Dorothy's 60th", event_date: "2026-12-14", event_type: "birthday", canManage: true }],
  },
};

export const HiddenGiftsExplained: Story = {
  ...HiddenGifts,
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Gifts hidden from you" }));
    // The panel opens outside the story.
    const body = within(document.body);
    await expect(await body.findByRole("heading", { name: "What's been reserved is hidden from you" })).toBeVisible();
    await expect(body.getByText("Gifts reserved before Dorothy's 60th show on Dec 15.")).toBeVisible();
    await expect(body.getByRole("link", { name: "Gift activity" })).toHaveAttribute("href", "?tab=purchases");
  },
};

/** Share copies the link and says who can open the list. */
export const ShareOpen: Story = {
  ...Wishlist,
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Share" }));
    const dialog = within(await within(document.body).findByRole("dialog", { name: "Share" }));
    await expect(dialog.getByText("Anyone with the link")).toBeVisible();
    await expect(dialog.getByText("Friends")).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "List link" })).toHaveValue(
      `${window.location.origin}/r/dorothys-wishlist-k2m9x4p7q1zw`,
    );
  },
};

/** A private list has no link to hand out, so Share says so. */
export const SharePrivate: Story = {
  args: { access: { visibility: "private", audience: "hidden", href: "#settings" } },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Share" }));
    const dialog = within(await within(document.body).findByRole("dialog", { name: "Share" }));
    await expect(dialog.getByText("This list is private")).toBeVisible();
    await expect(dialog.queryByRole("textbox")).not.toBeInTheDocument();
  },
};

/** Preview, Plan an event and Settings live in the ⋯ menu. */
export const MoreMenu: Story = {
  ...Wishlist,
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "More" }));
    const menu = within(await within(document.body).findByRole("menu"));
    // The menu fades in, so check what the items open, not that they're visible yet.
    await expect(menu.getByRole("menuitem", { name: "Preview as a guest" })).toHaveAttribute(
      "href",
      "/r/dorothys-wishlist-k2m9x4p7q1zw",
    );
    await expect(menu.getByRole("menuitem", { name: "Plan an event" })).toHaveAttribute("href", "#plan");
    await expect(menu.getByRole("menuitem", { name: "Settings" })).toHaveAttribute("href", "#settings");
  },
};

/**
 * Items in every place: gifted by guests, covered by guests after the owner
 * bought them, bought by the owner, and still to buy. Only gifted ones count
 * toward "items gifted".
 */
export const BoughtAndCovered: Story = {
  args: {
    itemCount: 12,
    progress: { total: 12, toBuy: 5, boughtByYou: 2, gifted: 5, covered: 1 },
  },
};

export const BoughtAndCoveredDark: Story = {
  ...BoughtAndCovered,
  parameters: { theme: "dark", chromatic: { disableSnapshot: true } },
};

/**
 * Every part at once: gifts revealed after an event (hidden, so no
 * progress), an event the owner hosts, one someone else hosts with an Unlink
 * button, and the checklist.
 */
export const EverythingShowing: Story = {
  args: {
    title: "Remi & Max's Baby Registry",
    occasion: "Baby registry",
    itemCount: 32,
    dateLabel: "Due date: February 4, 2027",
    access: { visibility: "public", audience: "everyone", href: "#settings" },
    customize: picker("Remi & Max's Baby Registry", listHeader(), "baby"),
    progress: null,
    hidden: { revealed: 2, href: "?tab=purchases", settingsHref: "#reservations" },
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
  args: { planPrompt: true, links: { preview: "/r/x", settings: "#settings", plan: null } },
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

/** A baby registry with a header the owner picked. */
export const BabyHeader: Story = {
  args: {
    ...EverythingShowing.args,
    header: listHeader({ color: "blush", pattern: "feet" }),
    customize: picker("Remi & Max's Baby Registry", listHeader({ color: "blush", pattern: "feet" }), "baby"),
  },
};

export const BabyHeaderDark: Story = {
  ...BabyHeader,
  parameters: { theme: "dark" },
};
