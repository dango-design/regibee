// Getting from a follow request to approving it. The My registries tab says
// when someone wants to follow you, and its Review requests button goes to the
// Follow requests section of the Account page (src/components/account-settings.tsx).
// The page shows its loading skeleton first, so the section isn't there when
// Next.js handles the link's #fragment: the page's navigation
// (src/components/section-nav.tsx) goes to it once it is.

import { expect, test, type Page } from "@playwright/test";
import { createAccount, db, signIn, waitForReact } from "./fixtures";

async function askToFollow(followerId: string, followeeId: string) {
  const { error } = await db.from("follows").insert({ follower_id: followerId, followee_id: followeeId, status: "pending" });
  if (error) throw error;
}

async function followStatus(followerId: string, followeeId: string) {
  const { data } = await db
    .from("follows")
    .select("status")
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId)
    .maybeSingle();
  return data?.status ?? null;
}

function sectionsNav(page: Page) {
  return page.getByRole("navigation", { name: "Account sections" });
}

test("someone with a follow request goes from the dashboard straight to it, and approves it", async ({ page }) => {
  const nell = await createAccount("Nell Needs-Approval");
  const otto = await createAccount("Otto Asking");
  await askToFollow(otto.id, nell.id);

  await signIn(page, nell);
  await page.goto("/dashboard");
  await expect(page.getByText("1 person wants to follow you")).toBeVisible();
  await page.getByRole("link", { name: "Review requests" }).click();
  await page.waitForURL(/\/dashboard\/account#follow-requests$/);

  // The section is in view, current in the navigation, and has focus, so
  // Approve and Decline are the next things to Tab to.
  const nav = sectionsNav(page);
  await expect(nav.getByRole("link", { name: "Follow requests 1 waiting" })).toHaveAttribute("aria-current", "location");
  await expect(nav.locator("[aria-current]")).toHaveCount(1);
  const title = page.getByRole("heading", { name: "Follow requests" });
  await expect(title).toBeFocused();
  await expect(title).toBeInViewport();

  const requests = page.locator("#follow-requests");
  await expect(requests).toContainText("Otto Asking");
  await expect(requests.getByRole("button", { name: "Decline" })).toBeVisible();
  await requests.getByRole("button", { name: "Approve" }).click();
  await expect(requests).toContainText("Approved");
  await expect.poll(() => followStatus(otto.id, nell.id)).toBe("approved");
  // Nothing is waiting now, so the navigation drops the number.
  await expect(nav.getByRole("link", { name: "Follow requests", exact: true })).toBeVisible();

  // Coming back with nothing waiting, the section says so.
  await page.reload();
  await expect(requests).toContainText("No follow requests right now.");
  await expect(page.locator("#followers")).toContainText("Otto Asking");

  // The navigation follows the page as it scrolls, and goes to a section when
  // picked. Before React takes over the page, the link still scrolls there,
  // but nothing moves focus to the section.
  const deleteAccount = nav.getByRole("link", { name: "Delete account" });
  await waitForReact(deleteAccount);
  await deleteAccount.click();
  await expect(page.getByRole("heading", { name: "Delete account" })).toBeFocused();
  await expect(nav.getByRole("link", { name: "Delete account" })).toHaveAttribute("aria-current", "location");
  await expect(page).toHaveURL(/#delete-account$/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(nav.getByRole("link", { name: "Your profile", exact: true })).toHaveAttribute("aria-current", "location");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("a link from an older follow request email still lands on the requests, and the page doesn't scroll sideways", async ({
    page,
  }) => {
    const pia = await createAccount("Pia Phone");
    const quin = await createAccount("Quin Asking");
    await askToFollow(quin.id, pia.id);

    await signIn(page, pia);
    // Follow request emails sent before the sections had their own ids link to #follows.
    await page.goto("/dashboard/account#follows");
    await page.waitForURL(/#follow-requests$/);

    const nav = sectionsNav(page);
    const current = nav.getByRole("link", { name: "Follow requests 1 waiting" });
    await expect(current).toHaveAttribute("aria-current", "location");
    // The row of links scrolls by itself to show the current one.
    await expect(current).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("heading", { name: "Follow requests" })).toBeFocused();

    const requests = page.locator("#follow-requests");
    await expect(requests.getByRole("button", { name: "Approve" })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    await requests.getByRole("button", { name: "Approve" }).click();
    await expect.poll(() => followStatus(quin.id, pia.id)).toBe("approved");
  });
});
