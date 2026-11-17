// The page loaders the phone app can call through /api/app/data. Each one is
// what a website page loads, shared with that page, so the app shows the
// same thing. Each checks who's asking, as the page does: they run as the
// app's user (src/lib/app-request.ts). Return null for "not found".

import { loadDashboard } from "@/lib/dashboard-page";
import { loadListPage } from "@/lib/list-page";

export const APP_LOADERS = {
  dashboard: () => loadDashboard(),
  listPage: (registryId: unknown) => (typeof registryId === "string" ? loadListPage(registryId) : null),
};
