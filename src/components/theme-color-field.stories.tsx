import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { ThemeColorField } from "./theme-color-field";

// The Color field under the invitation picture in the event form
// (src/components/event-form.tsx).

function Field({ start }: { start: string }) {
  const [value, setValue] = useState(start);
  return (
    <div className="max-w-xl">
      <ThemeColorField value={value} onChange={setValue} />
    </div>
  );
}

const meta: Meta<typeof Field> = {
  title: "Components/ThemeColorField",
  component: Field,
  parameters: { layout: "padded" },
  args: { start: "" },
};
export default meta;
type Story = StoryObj<typeof Field>;

/** No color yet: the occasion's colors, and no fill on the wish lists. Picking one shows how it looks. */
export const NoColor: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Lavender" }));
    await expect(canvas.getByRole("button", { name: "Lavender" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByText("How the gift lists will look")).toBeVisible();
  },
};

/** A color from the browser's picker, shown on the last swatch. */
export const AnyColor: Story = {
  args: { start: "#1b2a4a" },
};
