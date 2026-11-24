// Feedback after a click on a link: the bar across the top of the window
// (src/components/navigation-progress.tsx) and the pages' loading screens.

import { expect, test } from "@playwright/test";
import { createRegistryWithItem, signIn, waitForReact } from "./fixtures";

test("a click on a list shows the progress bar until the list's page arrives", async ({ page }) => {
  const { owner, registry } = await createRegistryWithItem();
  await signIn(page, owner);

  const bar = page.locator(".navigation-progress");
  const listLink = page.getByRole("link", { name: registry.title });
  await waitForReact(listLink);
  await expect(bar).toHaveAttribute("data-state", "idle");

  // Hold the list page's answer back, as a slow connection would.
  await page.route(`**/dashboard/registry/${registry.id}*`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.continue();
  });

  await listLink.click();
  await expect(bar).toHaveAttribute("data-state", "loading");
  // Still on the dashboard: nothing has arrived yet.
  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(page.getByRole("heading", { level: 1, name: registry.title })).toBeVisible();
  await expect(bar).toHaveAttribute("data-state", "idle");
});

test("a link to a part of the same page doesn't start the progress bar", async ({ page }) => {
  await page.goto("/privacy");
  const bar = page.locator(".navigation-progress");
  await expect(bar).toHaveAttribute("data-state", "idle");
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "#main-content";
    link.textContent = "Jump";
    link.id = "jump";
    document.body.append(link);
  });
  await page.locator("#jump").click();
  await page.waitForTimeout(400);
  await expect(bar).toHaveAttribute("data-state", "idle");
});
