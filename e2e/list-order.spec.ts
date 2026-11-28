// The order of a person's lists. The My registries tab shows the lists they
// own and the ones they help manage together, in an order they choose, and a
// shared list shows the other managers. Their profile shows its lists in
// another order they choose. Both orders stay after a reload.

import { expect, test, type Page } from "@playwright/test";
import { createAccount, createWishlist, db, signIn } from "./fixtures";

async function cardTitles(page: Page) {
  return page.getByRole("region", { name: "Your lists" }).getByRole("heading", { level: 3 }).allTextContents();
}

test("someone puts their own lists and the ones shared with them in their own order", async ({ page }) => {
  const me = await createAccount("Mira Order");
  const friend = await createAccount("Fern Friend");
  const { registry: mine } = await createWishlist(me.id);
  const { registry: shared } = await createWishlist(friend.id);
  const { error } = await db.from("registry_managers").insert({ registry_id: shared.id, user_id: me.id, role: "manager" });
  if (error) throw error;

  await signIn(page, me);
  await page.goto("/dashboard");

  // Newest first, until they choose an order. The shared list shows its owner.
  await expect.poll(() => cardTitles(page)).toEqual([shared.title, mine.title]);
  await expect(page.getByTitle("Shared with Fern Friend")).toBeVisible();

  await page.getByRole("button", { name: "Reorder" }).click();
  await page.getByRole("button", { name: `Move ${shared.title} down` }).click();
  await expect(page.getByRole("button", { name: `Move ${shared.title} down` })).toBeDisabled();
  await page.getByRole("button", { name: "Done" }).click();
  await expect.poll(() => cardTitles(page)).toEqual([mine.title, shared.title]);

  // Saved, so it stays after a reload.
  await expect
    .poll(async () => (await db.from("profiles").select("list_order").eq("id", me.id).single()).data?.list_order)
    .toEqual([mine.id, shared.id]);
  await page.reload();
  await expect.poll(() => cardTitles(page)).toEqual([mine.title, shared.title]);
});

test("someone puts the lists on their profile in order", async ({ page, browser }) => {
  const me = await createAccount("Pia Profile");
  const lists = [(await createWishlist(me.id)).registry, (await createWishlist(me.id)).registry];
  const { error } = await db
    .from("registries")
    .update({ listed_on_profile: true, profile_audience: "everyone", is_public: true })
    .in(
      "id",
      lists.map((list) => list.id),
    );
  if (error) throw error;
  const { data: profile } = await db.from("profiles").select("public_id").eq("id", me.id).single();

  await signIn(page, me);
  await page.goto("/dashboard/account");
  const section = page.locator("#profile-registries");
  await section.getByRole("button", { name: "Reorder" }).click();
  const rows = section.getByRole("row");
  const before = await rows.allTextContents();
  const first = lists.find((list) => before[0].includes(list.title))!;
  const second = lists.find((list) => list !== first)!;
  await section.getByRole("button", { name: `Move ${first.title} down` }).click();
  await expect(rows.first()).toContainText(second.title);

  await expect
    .poll(async () => (await db.from("profiles").select("profile_list_order").eq("id", me.id).single()).data?.profile_list_order)
    .toEqual([second.id, first.id]);

  // Anyone who opens the profile sees the new order.
  const stranger = await browser.newContext();
  const visitor = await stranger.newPage();
  await visitor.goto(`/u/${profile!.public_id}`);
  const titles = visitor.getByText(/^Christmas Wishlist /);
  await expect(titles).toHaveCount(2);
  await expect(titles.first()).toHaveText(second.title);
  await stranger.close();
});
