import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CategoryField } from "./category-field";

const CATEGORIES = [
  { id: "cat-1", name: "Nursery & Sleep" },
  { id: "cat-2", name: "Feeding" },
];

/** Keeps the categories and the chosen one, as the item dialogs do. */
function Field({ start, chosen, hint }: { start: { id: string; name: string }[]; chosen?: string; hint?: string }) {
  const [categories, setCategories] = useState(start);
  const [value, setValue] = useState(chosen);
  return (
    <div className="w-64">
      <CategoryField
        categories={categories}
        value={value}
        onChange={setValue}
        hint={hint}
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

// The edit item dialog's stories already show the field like this.
export const Chosen: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
};

// A click opens the list of categories, with the chosen one checked.
export const Open: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("combobox", { name: "Category" }));
    // The list fades in, so wait for it instead of checking once.
    await waitFor(() => expect(within(document.body).getByRole("option", { name: "Nursery & Sleep" })).toBeVisible());
  },
};

// A list with no categories still takes a name. Typing one offers to add it,
// and choosing that puts the item in the new category.
export const AddingTheFirst: Story = {
  args: { start: [], chosen: undefined },
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByRole("combobox", { name: "Category" });
    await userEvent.click(field);
    // A frame after focus, the field selects its text, so a new name replaces
    // the old one. Typing before that frame, as a busy test machine sometimes
    // did, got the first letters selected and replaced. Wait one frame: the
    // field asked for its frame first, so it runs first.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await userEvent.type(field, "Kitchen", { skipClick: true });
    await userEvent.click(await within(document.body).findByRole("option", { name: "Add “Kitchen”" }));
    await expect(field).toHaveValue("Kitchen");
  },
};

// A guessed category the list doesn't have yet, as the add item dialog shows
// it. It's added to the list when the item is saved.
export const GuessedNewCategory: Story = {
  args: {
    start: [...CATEGORIES, { id: "__new_category__", name: "Food & Drink" }],
    chosen: "__new_category__",
    hint: "A new category. It's added to the list when you save.",
  },
};
