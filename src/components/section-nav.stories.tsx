import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  SECTION_NAV_GRID,
  SECTION_SCROLL_MARGIN,
  SectionNav,
  SectionTitle,
  type PageSection,
} from "./section-nav";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const SECTIONS: PageSection[] = [
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

/**
 * The navigation beside stand-in sections, laid out like the Account page,
 * under a stand-in top bar. The edit event page has the same navigation: see
 * the EventForm stories.
 */
function SectionNavOnPage(props: React.ComponentProps<typeof SectionNav>) {
  return (
    <>
      <div className="sticky top-0 z-50 h-16 border-b border-secondary bg-primary" />
      <div className="container mx-auto max-w-2xl px-4 py-8 lg:max-w-5xl">
        <div className={SECTION_NAV_GRID}>
          <SectionNav {...props} />
          <div className="space-y-6">
            {props.sections.map((section) => (
              <Card key={section.id} id={section.id} className={SECTION_SCROLL_MARGIN}>
                <CardHeader>
                  <SectionTitle sectionId={section.id}>{section.label}</SectionTitle>
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

const meta: Meta<typeof SectionNav> = {
  title: "Components/SectionNav",
  component: SectionNav,
  parameters: { layout: "fullscreen" },
  decorators: [withoutSectionInUrl],
  args: { sections: SECTIONS, label: "Account sections" },
  render: (args) => <SectionNavOnPage {...args} />,
};
export default meta;
type Story = StoryObj<typeof SectionNav>;

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
