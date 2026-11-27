import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { checklistStatus, countedEntry } from "@/lib/checklist-matching";
import type { ChecklistPageData } from "@/lib/checklist-page-types";
import { BABY_DEFAULT_CATEGORIES } from "@/lib/registry-create";
import { ChecklistManager } from "./checklist-manager";

const categories = BABY_DEFAULT_CATEGORIES.map((name, i) => ({ id: `cat-${i}`, name }));

/** A list's checklist with these things on the list, worked out as the loader does. */
function pageWith(
  things: { id: string; kind: "item" | "fund"; title: string; checklist_entry?: string | null }[],
  dismissed: string[] = [],
): ChecklistPageData {
  const status = checklistStatus(things, dismissed);
  return {
    registry: { id: "reg-1", title: "Baby Rivera" },
    categories,
    paymentMethods: null,
    things: things.map((thing) => ({
      id: thing.id,
      kind: thing.kind,
      title: thing.title,
      image_url: null,
      placed: false,
      entry: countedEntry(thing).key,
      chosen: countedEntry(thing).chosen,
    })),
    dismissed: status.dismissed,
    done: status.done,
    total: status.total,
    essentialsDone: status.essentialsDone,
    essentialsTotal: status.essentialsTotal,
  };
}

const actions = {
  addItem: fn(async () => ({ success: true as const, id: "new" })),
  setEntry: fn(async () => ({ error: null })),
  toggleDismissed: fn(async () => ({ success: true })),
};

const meta: Meta<typeof ChecklistManager> = {
  title: "Components/ChecklistManager",
  component: ChecklistManager,
  parameters: { layout: "fullscreen", nextjs: { appDirectory: true } },
  args: { actions },
};
export default meta;
type Story = StoryObj<typeof ChecklistManager>;

/** A list with a few things on it: one matched by name, one chosen, one that counts for nothing. */
export const Default: Story = {
  args: {
    data: pageWith(
      [
        { id: "i1", kind: "item", title: "Babyletto Hudson 3-in-1 Convertible Crib" },
        { id: "i2", kind: "item", title: "Newton Baby Crib Mattress", checklist_entry: "crib-mattress" },
        { id: "i3", kind: "item", title: "Pampers Swaddlers Diapers Size 1" },
        { id: "i4", kind: "item", title: "Linen Lamp" },
      ],
      ["bassinet"],
    ),
  },
};

/** A new registry: nothing added yet. */
export const Empty: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { data: pageWith([]) },
};

/** "Add to registry" asks whether the owner has a particular one in mind. */
export const AskingWhichOne: Story = {
  args: { data: pageWith([]) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click((await canvas.findAllByRole("button", { name: /Add to registry/ }))[0]);
    const body = within(document.body);
    const heading = await body.findByRole("heading", { name: "Have a specific crib in mind?" });
    // The dialog fades in from opacity 0, so wait for it to finish instead of
    // checking once. A single check failed whenever it landed mid-fade.
    await waitFor(() => expect(heading).toBeVisible());
    await waitFor(() => expect(body.getByRole("button", { name: "No, guests can choose" })).toBeVisible());
  },
};
