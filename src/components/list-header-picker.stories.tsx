import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { listHeader } from "@/lib/list-headers";
import { ListHeaderPicker } from "./list-header-picker";

const meta: Meta<typeof ListHeaderPicker> = {
  title: "Components/ListHeaderPicker",
  component: ListHeaderPicker,
  parameters: { nextjs: { appDirectory: true } },
  args: {
    registryId: "reg-1",
    title: "Remi & Max's Baby Registry",
    header: listHeader(),
    occasion: "baby",
    saveAction: fn(async () => ({ error: null })),
  },
};
export default meta;
type Story = StoryObj<typeof ListHeaderPicker>;

/** The dialog open on a baby registry: baby patterns come first. */
export const Open: Story = {
  args: { defaultOpen: true },
};

/** Picking a color and a pattern, then saving. */
export const PickAndSave: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Header" }));
    // The dialog opens outside the story.
    const dialog = within(document.body);
    await userEvent.click(await dialog.findByRole("radio", { name: "Lavender" }));
    await userEvent.click(dialog.getByRole("radio", { name: "Moon and stars" }));
    await expect(dialog.getByRole("radio", { name: "Moon and stars" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(dialog.getByRole("button", { name: "Save" }));
    await expect(args.saveAction).toHaveBeenCalledWith("reg-1", { color: "lavender", pattern: "dreams" });
  },
};
