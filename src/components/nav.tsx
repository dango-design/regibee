import { NavBar, type NavAccount } from "@/components/nav-bar";
import { countFollowRequests } from "@/lib/follows";
import { profilePath } from "@/lib/profile-link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isSupportAccount } from "@/lib/support";
import { getViewer } from "@/lib/viewer";

// Rendered on the server, so the account side of the bar arrives with the page
// instead of popping in after it loads. A public page passes returnTo, so
// logging in or signing up from it comes back to it.
export async function Nav({ returnTo }: { returnTo?: string } = {}) {
  const viewer = await getViewer();

  let account: NavAccount | null = null;
  if (viewer) {
    const [{ data: profile }, followRequestCount, support] = await Promise.all([
      supabaseAdmin.from("profiles").select("public_id, full_name").eq("id", viewer.id).single(),
      countFollowRequests(viewer.id),
      isSupportAccount(viewer.id),
    ]);

    account = {
      name: profile?.full_name?.trim() || viewer.email || "Your account",
      profilePath: profile ? profilePath(profile) : "/dashboard/account",
      email: viewer.email ?? null,
      followRequestCount,
      support,
    };
  }

  return <NavBar account={account} returnTo={returnTo} />;
}
