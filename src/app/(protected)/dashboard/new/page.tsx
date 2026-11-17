import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PlanPicker } from "@/components/plan-picker";
import { loadPlanPicker } from "@/lib/events-page";
import { getSessionUser } from "@/lib/viewer";

export const metadata: Metadata = { title: "Start something new | Regibee" };

/**
 * The one New button's page. A gift list on its own goes to the registry
 * form. An event asks what you're planning, who it's for and how gifts work,
 * then makes the event, with a list if you want one.
 */
export default async function NewPlanPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Guests (anonymous sessions) can only make a registry. Events need an account.
  if (user.is_anonymous) redirect("/dashboard/registry/new");

  // The phone app loads the same data (src/lib/events-page.ts).
  const data = await loadPlanPicker();
  if (!data) redirect("/login");
  const { myName: firstName, myLists } = data;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Start something new</h1>
      <p className="mt-1 text-tertiary">
        A gift list on its own, or an event with invitations. You can add the other one later.
      </p>
      <div className="mt-6">
        <PlanPicker myName={firstName} myLists={myLists} />
      </div>
    </div>
  );
}
