import { redirect } from "next/navigation";
import { DashboardHome } from "@/components/dashboard-home";
import { loadDashboard } from "@/lib/dashboard-page";

export default async function DashboardPage() {
  // The phone app loads the same data (src/lib/dashboard-page.ts).
  const data = await loadDashboard();

  if (!data) {
    redirect("/login");
  }

  // The markup is in a plain component, so Storybook and the demo can draw it.
  return <DashboardHome {...data} lists={data.lists ?? [...data.owned, ...data.shared]} />;
}
