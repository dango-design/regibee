import { redirect } from "next/navigation";
import { FollowingFeed } from "@/components/following-feed";
import { loadFollowingTab } from "@/lib/people-page";
import { getSessionUser } from "@/lib/viewer";

export default async function FollowingPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  // Guests have anonymous sessions, which get past the /dashboard middleware
  // check, but only real accounts can follow people.
  if (user.is_anonymous) {
    redirect("/signup?redirect=/dashboard/following");
  }

  // The phone app loads the same data (src/lib/people-page.ts).
  const data = await loadFollowingTab();
  if (!data) redirect("/login");

  return (
    <FollowingFeed
      people={data.people}
      registries={data.registries}
      shared={data.shared}
      birthdays={data.birthdays}
      today={data.today}
    />
  );
}
