// Who sees a list on its owner's profile: nobody, friends, followers or
// everyone (src/lib/list-access.ts). Friends are people the owner follows who
// follow the owner back, with both follows approved. The choice is only about
// the profile and the Following page: the list's link still opens for anyone.

import { expect, test, type Browser } from "@playwright/test";
import { chooseOption, createAccount, createWishlist, db, signIn, waitForReact } from "./fixtures";
import { profilePath } from "../src/lib/profile-link";

async function follow(followerId: string, followeeId: string) {
  const { error } = await db.from("follows").insert({
    follower_id: followerId,
    followee_id: followeeId,
    status: "approved",
    approved_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function profileOf(accountId: string) {
  const { data, error } = await db.from("profiles").select("public_id, full_name").eq("id", accountId).single();
  if (error) throw error;
  return profilePath(data);
}

/** Opens a page as this account, or signed out, and runs the checks. */
async function as(
  browser: Browser,
  account: { email: string; password: string } | null,
  check: (page: import("@playwright/test").Page) => Promise<void>,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  if (account) {
    await signIn(page, account);
    await page.waitForURL(/\/dashboard/);
  }
  await check(page);
  await context.close();
}

test("a list shown to friends is on the profile for friends only", async ({ page, browser }) => {
  const owner = await createAccount("Fay Owner");
  const friend = await createAccount("Fran Friend");
  const follower = await createAccount("Finn Follower");
  const { registry } = await createWishlist(owner.id);
  const path = await profileOf(owner.id);

  // Fran and Fay follow each other. Finn follows Fay, who doesn't follow back.
  await follow(friend.id, owner.id);
  await follow(owner.id, friend.id);
  await follow(follower.id, owner.id);

  // Fay chooses Friends on the list's Settings page. A public list offers
  // Everyone too.
  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}/settings`);
  const field = page.getByRole("button", { name: /Who sees it on your profile/ });
  await waitForReact(field);
  await expect(field).toContainText("Nobody");
  await field.click();
  await expect(page.getByRole("option", { name: "Everyone", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "Friends", exact: true }).click();
  // The hint says the choice is only about the profile.
  await expect(
    page.getByText("Friends see it on your profile: people you follow who follow you back. Anyone with the link can still open it.").locator("visible=true"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saved!" })).toBeVisible();

  const { data: saved } = await db
    .from("registries")
    .select("listed_on_profile, profile_audience")
    .eq("id", registry.id)
    .single();
  expect(saved).toEqual({ listed_on_profile: true, profile_audience: "friends" });

  // Her friend sees it on her profile and on their Following page.
  await as(browser, friend, async (friendPage) => {
    await friendPage.goto(path);
    await expect(friendPage.getByRole("heading", { name: "Fay Owner" })).toBeVisible();
    await expect(friendPage.getByText(registry.title)).toBeVisible();
    await friendPage.goto("/dashboard/following");
    await expect(friendPage.getByText(registry.title)).toBeVisible();
  });

  // A follower she doesn't follow back sees it in neither place, but the
  // link still opens it.
  await as(browser, follower, async (followerPage) => {
    await followerPage.goto(path);
    await expect(followerPage.getByRole("heading", { name: "Fay Owner" })).toBeVisible();
    await expect(followerPage.getByText(registry.title)).toHaveCount(0);
    await followerPage.goto("/dashboard/following");
    await expect(followerPage.getByText("Fay Owner").first()).toBeVisible();
    await expect(followerPage.getByText(registry.title)).toHaveCount(0);
    await followerPage.goto(`/r/${registry.slug}`);
    await expect(followerPage.getByRole("heading", { name: registry.title })).toBeVisible();
  });

  // Someone signed out doesn't see it on the profile either.
  await as(browser, null, async (visitorPage) => {
    await visitorPage.goto(path);
    await expect(visitorPage.getByRole("heading", { name: "Fay Owner" })).toBeVisible();
    await expect(visitorPage.getByText(registry.title)).toHaveCount(0);
  });

  // Fay sees her own list there.
  await page.goto(path);
  await expect(page.getByText(registry.title)).toBeVisible();
});

test("followers see a list shown to followers, and a link-only list can't show to everyone", async ({
  page,
  browser,
}) => {
  const owner = await createAccount("Lena Owner");
  const follower = await createAccount("Lou Follower");
  const { registry } = await createWishlist(owner.id);
  await db.from("registries").update({ is_public: false }).eq("id", registry.id);
  const path = await profileOf(owner.id);
  await follow(follower.id, owner.id);

  // On the Account page, each list has its own choice. This one is link-only,
  // so Everyone isn't offered.
  await signIn(page, owner);
  await page.goto("/dashboard/account#profile-registries");
  const field = page.getByRole("button", { name: `Who sees ${registry.title} on your profile` });
  await waitForReact(field);
  await field.click();
  await expect(page.getByRole("option", { name: "Friends", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Everyone", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await chooseOption(page, `Who sees ${registry.title} on your profile`, "Followers");
  await expect
    .poll(async () => {
      const { data } = await db
        .from("registries")
        .select("listed_on_profile, profile_audience")
        .eq("id", registry.id)
        .single();
      return data;
    })
    .toEqual({ listed_on_profile: true, profile_audience: "followers" });

  await as(browser, follower, async (followerPage) => {
    await followerPage.goto(path);
    await expect(followerPage.getByText(registry.title)).toBeVisible();
  });
  await as(browser, null, async (visitorPage) => {
    await visitorPage.goto(path);
    await expect(visitorPage.getByRole("heading", { name: "Lena Owner" })).toBeVisible();
    await expect(visitorPage.getByText(registry.title)).toHaveCount(0);
  });
});
