import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  ACCOUNT_SECTION_SCROLL_MARGIN,
  AccountNav,
  AccountSectionTitle,
  type AccountSection,
} from "./account-nav";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const SECTIONS: AccountSection[] = [
  { id: "profile", label: "Your profile" },
  { id: "gift-profile", label: "Gift profile" },
  { id: "follow-requests", label: "Follow requests", waiting: 2 },
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
  { id: "birthday-emails", label: "Birthday emails" },
  { id: "profile-registries", label: "Registries on your profile" },
  { id: "delete-account", label: "Delete account" },
];

/**
 * The navigation goes to the section in the URL's #fragment when it first
 * shows. Picking a section puts it there, and Storybook keeps the URL between
 * stories, so each story starts without one.
 */
const withoutSectionInUrl: Decorator = (Story) => {
  if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return <Story />;
};

/** The navigation beside stand-in sections, laid out like the Account page, under a stand-in top bar. */
function AccountNavOnPage({ sections }: { sections: AccountSection[] }) {
  return (
    <>
      <div className="sticky top-0 z-50 h-16 border-b border-secondary bg-primary" />
      <div className="container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl">
        <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          <AccountNav sections={sections} />
          <div className="space-y-6">
            {sections.map((section) => (
              <Card key={section.id} id={section.id} className={ACCOUNT_SECTION_SCROLL_MARGIN}>
                <CardHeader>
                  <AccountSectionTitle sectionId={section.id}>{section.label}</AccountSectionTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-40 rounded-lg bg-secondary" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const meta: Meta<typeof AccountNav> = {
  title: "Components/AccountNav",
  component: AccountNav,
  parameters: { layout: "fullscreen" },
  decorators: [withoutSectionInUrl],
  args: { sections: SECTIONS },
  render: (args) => <AccountNavOnPage {...args} />,
};
export default meta;
type Story = StoryObj<typeof AccountNav>;

// On a wide screen: a column on the left, with two follow requests waiting.
export const Default: Story = {
  globals: { viewport: { value: "desktop" } },
};

// Picking a section scrolls to it, marks it current and moves focus to its title.
export const PickingASection: Story = {
  globals: { viewport: { value: "desktop" } },
  play: async ({ canvas }) => {
    const nav = within(canvas.getByRole("navigation", { name: "Account sections" }));
    await expect(nav.getByRole("link", { name: "Your profile" })).toHaveAttribute("aria-current", "location");

    await userEvent.click(nav.getByRole("link", { name: "Followers" }));
    await waitFor(() => expect(nav.getByRole("link", { name: "Followers" })).toHaveAttribute("aria-current", "location"));
    await expect(nav.getByRole("link", { name: "Your profile" })).not.toHaveAttribute("aria-current");
    await expect(canvas.getByRole("heading", { name: "Followers" })).toHaveFocus();
  },
};

// Nothing waiting: Follow requests has no number.
export const NoRequests: Story = {
  globals: { viewport: { value: "desktop" } },
  args: { sections: SECTIONS.map(({ waiting: _, ...section }) => section) },
};

// On a phone: a row of links under the top bar that scrolls sideways by
// itself. Following a link brings it into view in the row.
export const Phone: Story = {
  globals: { viewport: { value: "mobile1" } },
  play: async ({ canvas }) => {
    const nav = within(canvas.getByRole("navigation", { name: "Account sections" }));
    await userEvent.click(nav.getByRole("link", { name: /^Follow requests/ }));
    await waitFor(() =>
      expect(nav.getByRole("link", { name: /^Follow requests/ })).toHaveAttribute("aria-current", "location"),
    );
    await expect(canvas.getByRole("heading", { name: "Follow requests" })).toHaveFocus();
    // The row scrolls; the page doesn't.
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};
