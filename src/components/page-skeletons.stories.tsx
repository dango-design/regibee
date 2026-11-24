import type { Meta, StoryObj } from "@storybook/react";
import {
  AccountSkeleton,
  EventPageSkeleton,
  FormPageSkeleton,
  GroupSkeleton,
  ListPageSkeleton,
  PageSkeleton,
  PlanPickerSkeleton,
} from "./page-skeletons";

// The dashboard and Following skeletons show under the dashboard tabs, so
// their stories are in dashboard-tabs.stories.tsx.
const meta: Meta = {
  title: "Components/PageSkeletons",
  parameters: {
    layout: "fullscreen",
  },
};
export default meta;
type Story = StoryObj;

export const Account: Story = {
  render: () => <AccountSkeleton />,
};

export const List: Story = {
  render: () => <ListPageSkeleton />,
};

export const Event: Story = {
  render: () => <EventPageSkeleton />,
};

export const EditEvent: Story = {
  render: () => <FormPageSkeleton title="Edit event" message="Loading your event" wide />,
};

export const NewEvent: Story = {
  render: () => <FormPageSkeleton title="Plan an event" message="Loading" />,
};

export const StartSomethingNew: Story = {
  render: () => <PlanPickerSkeleton />,
};

export const Group: Story = {
  render: () => <GroupSkeleton />,
};

export const OtherPage: Story = {
  render: () => <PageSkeleton />,
};
