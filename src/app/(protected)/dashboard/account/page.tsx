import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/account-settings";
import { loadAccountPage } from "@/lib/people-page";
import { getSessionUser } from "@/lib/viewer";

export default async function AccountPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  // Guests have anonymous sessions, which get past the /dashboard middleware
  // check, but only real accounts have a profile.
  if (user.is_anonymous) {
    redirect("/signup?redirect=/dashboard/account");
  }

  // The phone app loads the same data (src/lib/people-page.ts).
  const data = await loadAccountPage();
  if (!data) redirect("/login");

  return (
    <AccountSettings
      profile={data.profile}
      registries={data.registries}
      follows={data.follows}
      giftProfile={data.giftProfile}
      birthdayEmails={data.birthdayEmails}
      giftEmails={data.giftEmails ?? "instant"}
    />
  );
}
