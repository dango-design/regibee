import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { DetailReview } from "./detail-review";
import type { ListPageDetailReview } from "@/lib/list-page-types";

const meta: Meta<typeof DetailReview> = {
  title: "Components/DetailReview",
  component: DetailReview,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof DetailReview>;

const PHOTO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' fill='%23d9e7f2'/><circle cx='48' cy='44' r='22' fill='%236b8fb0'/></svg>";

const reviews: ListPageDetailReview[] = [
  {
    itemId: "a1",
    title: "Hatch Rest Baby Sound Machine, Night Light & Time-to-Rise",
    imageUrl: PHOTO,
    changes: [
      {
        field: "title",
        before: "Hatch Rest Sound Machine",
        after: "Hatch Rest Baby Sound Machine, Night Light & Time-to-Rise",
        shown: "after",
      },
      { field: "price", before: null, after: 59.99, shown: "after" },
      { field: "image_url", before: null, after: PHOTO, shown: "after" },
    ],
  },
  {
    itemId: "a2",
    title: "Halo Sleepsack Swaddle",
    imageUrl: null,
    changes: [{ field: "price", before: 20, after: 24.99, shown: "before" }],
  },
  {
    itemId: "a3",
    title: "Dr. Brown's Bottle Brush",
    imageUrl: PHOTO,
    changes: [
      { field: "price", before: null, after: 7.49, shown: "after" },
      { field: "image_url", before: null, after: PHOTO, shown: "after" },
    ],
  },
];

/** Keeps the choices in the story, as the page would after saving them. */
function Interactive({ initial }: { initial: ListPageDetailReview[] }) {
  const [state, setState] = useState(initial);
  return (
    <div className="max-w-2xl">
      <DetailReview
        registryId="demo"
        reviews={state}
        chooseAction={async (_registryId, itemId, field, side) => {
          setState((current) =>
            current.map((review) =>
              review.itemId !== itemId
                ? review
                : {
                    ...review,
                    changes: review.changes.map((c) => (c.field === field ? { ...c, shown: side } : c)),
                  },
            ),
          );
          return {};
        }}
        finishAction={async () => ({})}
      />
    </div>
  );
}

// A name guessed from the link replaced, a price the owner had picked kept,
// and one item that only had blanks filled in, opened to show it.
export const ReplacedAndFilled: Story = {
  render: () => <Interactive initial={reviews} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("See what was filled in on 1 more item"));
    await expect(await canvas.findByText("Dr. Brown's Bottle Brush")).toBeVisible();
  },
};

// Only blanks were filled in, so there's nothing to compare and the list stays folded.
export const OnlyFilled: Story = {
  render: () => <Interactive initial={[reviews[2]]} />,
};

// Prices the list's page checked found changed (PriceCheck). One kept, one switched back.
export const NewPrices: Story = {
  render: () => (
    <Interactive
      initial={[
        {
          itemId: "p1",
          title: "Hatch Rest Baby Sound Machine",
          imageUrl: PHOTO,
          changes: [{ field: "price", before: 69.99, after: 59.99, shown: "after" }],
        },
        {
          itemId: "p2",
          title: "Halo Sleepsack Swaddle",
          imageUrl: PHOTO,
          changes: [{ field: "price", before: 24.99, after: 29.99, shown: "before" }],
        },
      ]}
    />
  ),
};
