import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ListAccessField } from "./list-access-field";
import { ShareLinkField } from "./share-link-field";

const meta: Meta<typeof ShareLinkField> = {
  title: "Components/ShareLinkField",
  component: ShareLinkField,
  decorators: [(Story) => <div className="mx-auto max-w-xl p-4"><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof ShareLinkField>;

const path = "/r/maya-s-birthday-wishlist-k7m2p9qx4tab";
const replace = async () => ({ path: "/r/maya-s-birthday-wishlist-wd3hn8ec6ryu" });

// The sharing part of a list's Settings: who can open it, the link, and the
// question "Get a new link" asks first.
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {/* Separate forms, so the two sets of choices don't act as one. */}
      <form>
        <ListAccessField visibility="link" onChange={() => {}} />
      </form>
      <form>
        <ListAccessField visibility="private" onChange={() => {}} />
      </form>
      <ShareLinkField path={path} onReplace={replace} />
      <ShareLinkField path={path} onReplace={replace} startConfirming />
    </div>
  ),
};

// Confirming swaps in the new link and says the old one is off.
export const Replaced: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { path, onReplace: replace },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Get a new link" }));
    await userEvent.click(canvas.getByRole("button", { name: "Turn off this link and get a new one" }));
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent("The old link no longer works"));
    await expect(canvas.getByText(/wd3hn8ec6ryu/)).toBeVisible();
  },
};

// When the server says no, the question stays open with the reason.
export const Refused: Story = {
  args: {
    path,
    onReplace: async () => ({ error: "Getting a new link isn't ready yet. Try again later." }),
    startConfirming: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Turn off this link and get a new one" }));
    await waitFor(() => expect(canvas.getByRole("alert")).toBeVisible());
  },
};
