import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { CategoryField } from "./category-field";

const CATEGORIES = [
  { id: "cat-1", name: "Nursery & Sleep" },
  { id: "cat-2", name: "Feeding" },
];

/** Keeps the categories and the chosen one, as the item dialogs do. */
function Field({ start, chosen }: { start: { id: string; name: string }[]; chosen?: string }) {
  const [categories, setCategories] = useState(start);
  const [value, setValue] = useState(chosen);
  return (
    <div className="w-64">
      <CategoryField
        categories={categories}
        value={value}
        onChange={setValue}
        onCreate={async (name) => {
          const made = { id: `new-${name}`, name };
          setCategories((before) => [...before, made]);
          setValue(made.id);
          return null;
        }}
      />
    </div>
  );
}

const meta: Meta<typeof Field> = {
  title: "Components/CategoryField",
  component: Field,
  parameters: { layout: "centered" },
  args: { start: CATEGORIES, chosen: "cat-2" },
};
export default meta;
type Story = StoryObj<typeof Field>;

export const Chosen: Story = {};

// A click opens the list of categories, with the chosen one checked.
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("combobox", { name: "Category" }));
    await expect(await within(document.body).findByRole("option", { name: "Nursery & Sleep" })).toBeVisible();
  },
};

// A list with no categories still takes a name. Typing one offers to add it,
// and choosing that puts the item in the new category.
export const AddingTheFirst: Story = {
  args: { start: [], chosen: undefined },
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByRole("combobox", { name: "Category" });
    await userEvent.click(field);
    await userEvent.type(field, "Kitchen", { skipClick: true });
    await userEvent.click(await within(document.body).findByRole("option", { name: "Add “Kitchen”" }));
    await expect(field).toHaveValue("Kitchen");
  },
};
