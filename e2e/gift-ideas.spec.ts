// Gift ideas: things someone might give another person, saved where only
// they can see them. An owner saves one by hand and one shared from a phone,
// marks one as bought, edits and deletes. Another account can't read any of
// it, even with the anon key that ships in the browser.

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { createAccount, createWishlist, db, signIn, waitForReact } from "./fixtures";
import { localSupabase } from "./local-supabase";

test("an owner saves gift ideas, and nobody else can see them", async ({ page }) => {
  const owner = await createAccount("Remi Owner");
  // Owners with a registry used to skip the share screen. It now asks where
  // the product goes.
  await createWishlist(owner.id);
  await signIn(page, owner);

  // ── An empty view says how to save one ──
  await page.goto("/dashboard/saved/ideas");
  await expect(page.getByRole("link", { name: "Saved", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Gift ideas" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "No gift ideas yet" })).toBeVisible();

  // ── Save one by hand ──
  const saveButton = page.getByRole("button", { name: "Save a gift idea" });
  await waitForReact(saveButton);
  await saveButton.click();
  let dialog = page.getByRole("dialog", { name: "Save a gift idea" });
  await expect(dialog.getByText("Only you can see your gift ideas.")).toBeVisible();
  await dialog.getByRole("button", { name: "Save idea" }).click();
  // The browser asks for who it's for before anything is sent.
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Who's it for?").fill("Mom");
  await dialog.getByLabel("What is it?").fill("Wool scarf in green");
  await dialog.getByLabel("Price (optional)").fill("48");
  await dialog.getByLabel("Note (optional)").fill("She liked the green one at the market.");
  await dialog.getByRole("button", { name: "Save idea" }).click();
  await expect(dialog).toBeHidden();

  const mom = page.getByRole("region", { name: "For Mom" });
  await expect(page.getByText("Saved “Wool scarf in green” for Mom.")).toBeVisible();
  await expect(mom.getByRole("heading", { name: "Wool scarf in green" })).toBeVisible();
  await expect(mom.getByText("$48.00")).toBeVisible();
  await expect(mom.getByText("She liked the green one at the market.")).toBeVisible();

  // ── Share one from a phone ──
  // .invalid never resolves, so reading the link fails at once and the test
  // doesn't depend on any real shop.
  const shared = new URLSearchParams({ title: "Pour-over coffee set", url: "https://shop.invalid/coffee-set" });
  await page.goto(`/share?${shared}`);
  await expect(page.getByRole("heading", { name: "Where should this go?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Christmas Wishlist/ })).toBeVisible();
  await page.getByRole("link", { name: /Save as a gift idea/ }).click();

  await page.waitForURL(/\/dashboard\/saved\/ideas$/);
  dialog = page.getByRole("dialog", { name: "Save a gift idea" });
  await expect(dialog.getByLabel("Product link")).toHaveValue("https://shop.invalid/coffee-set");
  await expect(dialog.getByLabel("What is it?")).toHaveValue("Pour-over coffee set");
  await expect(dialog.getByText("We couldn't read that page. Your link and name are kept.")).toBeVisible();
  // People already saved for are one tap away.
  await dialog.getByRole("button", { name: "Mom" }).click();
  await expect(dialog.getByLabel("Who's it for?")).toHaveValue("Mom");
  await dialog.getByRole("button", { name: "Save idea" }).click();
  await expect(dialog).toBeHidden();
  await expect(mom.getByRole("link", { name: /Pour-over coffee set/ })).toHaveAttribute(
    "href",
    "https://shop.invalid/coffee-set",
  );
  await expect(mom.getByText("2 ideas")).toBeVisible();

  // ── A second person, and filtering by person ──
  await page.getByRole("button", { name: "Save a gift idea" }).click();
  dialog = page.getByRole("dialog", { name: "Save a gift idea" });
  await dialog.getByLabel("Who's it for?").fill("Sam");
  await dialog.getByLabel("What is it?").fill("Climbing chalk bag");
  await dialog.getByRole("button", { name: "Save idea" }).click();
  await expect(dialog).toBeHidden();
  const sam = page.getByRole("region", { name: "For Sam" });
  await expect(sam).toBeVisible();
  await page.getByRole("radiogroup", { name: "Whose ideas to show" }).getByRole("radio", { name: /Mom/ }).click();
  await expect(sam).toBeHidden();
  await expect(mom).toBeVisible();

  // ── Bought it ──
  // React Aria's checkbox hides its input, so click the label beside it.
  const scarf = mom.getByRole("listitem").filter({ hasText: "Wool scarf in green" });
  await scarf.getByText(/^Bought it/).click();
  await expect(scarf.getByRole("checkbox", { name: /Bought it/ })).toBeChecked();
  await expect(mom.getByText("1 idea · 1 bought")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "For Mom" }).getByRole("checkbox", { name: /Bought it\W+Wool scarf in green/ })).toBeChecked();

  // ── Edit, then delete ──
  // Reopening an idea after saving it shows what was saved.
  await page.getByRole("button", { name: "Edit Wool scarf in green" }).click();
  dialog = page.getByRole("dialog", { name: "Edit gift idea" });
  await dialog.getByLabel("Price (optional)").fill("52");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("region", { name: "For Mom" }).getByText("$52.00")).toBeVisible();
  await page.getByRole("button", { name: "Edit Wool scarf in green" }).click();
  await expect(dialog.getByLabel("Price (optional)")).toHaveValue("52.00");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Edit Pour-over coffee set" }).click();
  dialog = page.getByRole("dialog", { name: "Edit gift idea" });
  await dialog.getByLabel("Who's it for?").fill("Dad");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  const dad = page.getByRole("region", { name: "For Dad" });
  await expect(dad.getByRole("link", { name: /Pour-over coffee set/ })).toBeVisible();

  await dad.getByRole("button", { name: "Edit Pour-over coffee set" }).click();
  dialog = page.getByRole("dialog", { name: "Edit gift idea" });
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete it" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Deleted “Pour-over coffee set”.")).toBeVisible();
  await expect(dad).toBeHidden();

  const { data: rows } = await db.from("gift_ideas").select("recipient, title, bought_at").eq("owner_id", owner.id);
  expect(rows?.map((r) => [r.recipient, r.title, Boolean(r.bought_at)]).sort()).toEqual([
    ["Mom", "Wool scarf in green", true],
    ["Sam", "Climbing chalk bag", false],
  ]);

  // ── Nobody else can read them, with the key the browser has ──
  const other = await createAccount("Nosy Neighbor");
  const asOther = createClient(localSupabase().apiUrl, localSupabase().anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await asOther.auth.signInWithPassword({ email: other.email, password: other.password });
  expect(signInError).toBeNull();
  const { data: seen, error: readError } = await asOther.from("gift_ideas").select("id").eq("owner_id", owner.id);
  expect(readError).toBeNull();
  expect(seen).toEqual([]);
  const signedOut = createClient(localSupabase().apiUrl, localSupabase().anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: anonError } = await signedOut.from("gift_ideas").select("id");
  expect(anonError).not.toBeNull();
});
