import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import type { ListVisibility, ProfileAudience } from "@/lib/list-access";
import { NavBar } from "./nav-bar";
import { listHeader } from "@/lib/list-headers";
import { ListHeaderPicker } from "./list-header-picker";
import { OwnerListTop } from "./owner-list-top";
import { PHONE_MODES } from "@/stories/viewports";

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
    shareAction: fn(async (_registryId: string, change: { visibility: ListVisibility; profileAudience?: ProfileAudience }) => ({
      error: null,
      visibility: change.visibility,
      audience: change.visibility === "private" ? ("hidden" as const) : (change.profileAudience ?? ("friends" as const)),
    })),
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

/** Opens Share and returns its panel. */
async function openShare(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole("button", { name: "Share" }));
  const dialog = await within(document.body).findByRole("dialog", { name: "Share" });
  // The panel fades in, so it's in the page a moment before it's visible.
  await waitFor(() => expect(dialog).toBeVisible());
  return within(dialog);
}

/** Opens one of the panel's dropdowns and picks an option. The list opens outside the panel. */
async function choose(panel: ReturnType<typeof within>, field: RegExp, option: string) {
  await userEvent.click(panel.getByRole("button", { name: field }));
  const list = within(document.body);
  // The list fades in, so an option is in the page a moment before it's visible.
  await waitFor(() => expect(list.getByRole("option", { name: option })).toBeVisible());
  await userEvent.click(list.getByRole("option", { name: option }));
}

/** Share copies the link, and says who can open the list and who sees it on the profile. */
export const ShareOpen: Story = {
  ...Wishlist,
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const panel = await openShare(canvasElement);
    await expect(panel.getByRole("button", { name: /Who can open it/ })).toHaveTextContent("Anyone with the link");
    await expect(panel.getByRole("button", { name: /On your profile/ })).toHaveTextContent("Friends");
    await expect(panel.getByRole("textbox", { name: "List link" })).toHaveValue(
      `${window.location.origin}/r/dorothys-wishlist-k2m9x4p7q1zw`,
    );
  },
};

/** Picking who sees it on the profile saves at once, with no warning. */
export const ShareChangeProfile: Story = {
  ...Wishlist,
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement, args }) => {
    const panel = await openShare(canvasElement);
    await choose(panel, /On your profile/, "Followers");
    await expect(args.shareAction).toHaveBeenCalledWith("reg-1", { visibility: "link", profileAudience: "followers" });
    await expect(await panel.findByText("Saved")).toBeVisible();
    await expect(panel.getByRole("button", { name: /On your profile/ })).toHaveTextContent("Followers");
  },
};

/**
 * Picking Private warns what it breaks, naming the list's events, and saves
 * nothing until it's confirmed.
 */
export const SharePrivateWarning: Story = {
  ...Wishlist,
  play: async ({ canvasElement, args }) => {
    const panel = await openShare(canvasElement);
    await choose(panel, /Who can open it/, "Private");
    await expect(await panel.findByText("Make this list private?")).toBeVisible();
    await expect(panel.getByText(/comes off Dorothy's 60th, your profile and any groups/)).toBeVisible();
    await expect(args.shareAction).not.toHaveBeenCalled();
    await expect(panel.getByRole("button", { name: "Make private" })).toBeVisible();
  },
};

/** Confirming makes it private, and the panel drops the link. */
export const SharePrivateConfirmed: Story = {
  ...Wishlist,
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement, args }) => {
    const panel = await openShare(canvasElement);
    await choose(panel, /Who can open it/, "Private");
    await userEvent.click(await panel.findByRole("button", { name: "Make private" }));
    await expect(args.shareAction).toHaveBeenCalledWith("reg-1", { visibility: "private" });
    await expect(await panel.findByText("This list is private")).toBeVisible();
    await expect(panel.queryByRole("textbox")).not.toBeInTheDocument();
    await expect(panel.queryByRole("button", { name: /On your profile/ })).not.toBeInTheDocument();
  },
};

/** A private list has no link to hand out, so Share says so. */
export const SharePrivate: Story = {
  args: { access: { visibility: "private", audience: "hidden", href: "#settings" } },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const panel = await openShare(canvasElement);
    await expect(panel.getByText("This list is private")).toBeVisible();
    await expect(panel.queryByRole("textbox")).not.toBeInTheDocument();
  },
};

/** A co-manager can change who can open it, and sees who the owner shows it to on their profile. */
export const ShareAsManager: Story = {
  ...Wishlist,
  args: { ...Wishlist.args, manager: true },
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement }) => {
    const panel = await openShare(canvasElement);
    await expect(panel.getByRole("button", { name: /Who can open it/ })).toBeVisible();
    await expect(panel.getByText("On the owner's profile")).toBeVisible();
    await expect(panel.queryByRole("button", { name: /On your profile/ })).not.toBeInTheDocument();
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
  parameters: { ...EverythingShowing.parameters, chromatic: { modes: PHONE_MODES } },
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
