import { Suspense } from "react";
import { DashboardTabs } from "@/components/dashboard-tabs";
import { getViewer } from "@/lib/viewer";

// getViewer counts guests (anonymous sessions) as signed out, and guests
// can't plan events or follow anyone. The top bar calls it too, and it's
// cached per request.
async function Tabs() {
  const viewer = await getViewer();
  return <DashboardTabs hasAccount={Boolean(viewer)} />;
}

// /dashboard, /dashboard/events and /dashboard/following share this layout, so the tabs stay on
// screen while you switch between them. Each tab keeps its own loading.tsx in
// its own folder. A loading.tsx here would show one tab's skeleton for both.
export default function DashboardTabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* The layout itself waits on nothing, so coming here from another page
          shows the tabs and the tab's skeleton at once. Until the viewer is
          known the tabs show as they do for an account, which nearly every
          viewer has. A guest's extra tabs go away a moment later. */}
      <Suspense fallback={<DashboardTabs hasAccount />}>
        <Tabs />
      </Suspense>
      {children}
    </>
  );
}
