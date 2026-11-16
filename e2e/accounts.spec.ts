// Making an account and getting back into one. Both emails here come from
// Supabase itself, not from the site's mailer, and local Supabase sends them
// to Mailpit too. Local Supabase asks new accounts to confirm their email, as
// production does (supabase/config.toml).

import { expect, test } from "@playwright/test";
import { createAccount, db, uniqueEmail, waitForReact } from "./fixtures";
import { linkIn, waitForEmail } from "./mailbox";

test("someone signs up, confirms their email, and starts on an empty dashboard", async ({ page }) => {
  const email = uniqueEmail("sam");
  const password = "a-new-password";

  await page.goto("/signup");
  await waitForReact(page, "form");
  await page.getByLabel("Full Name").fill("Sam Signup");
  // The "Let friends find me" box mentions email too.
  await page.getByRole("textbox", { name: /^Email/ }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  await expect(page.getByText(`We sent a confirmation link to ${email}.`)).toBeVisible();

  // Until they confirm, the account can't sign in.
  const other = await page.context().browser()!.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/login");
  await waitForReact(otherPage, "form");
  await otherPage.getByLabel("Email").fill(email);
  await otherPage.getByLabel("Password").fill(password);
  await otherPage.getByRole("button", { name: "Sign In" }).click();
  await expect(otherPage.getByText("Email not confirmed")).toBeVisible();
  await other.close();

  // The link in the email signs them in and opens the dashboard.
  const confirm = await waitForEmail(email, /confirm/i);
  await page.goto(linkIn(confirm, /\/auth\/v1\/verify\?.*type=signup/));
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "No registries yet" })).toBeVisible();

  // Sign-up made their profile from the form, findable by friends unless
  // they untick it.
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const user = users.users.find((u) => u.email === email);
  expect(user?.email_confirmed_at).toBeTruthy();
  const { data: profile } = await db
    .from("profiles")
    .select("full_name, discoverable, findable_by_email")
    .eq("id", user!.id)
    .single();
  expect(profile).toEqual({ full_name: "Sam Signup", discoverable: true, findable_by_email: true });
});

test("someone who forgot their password sets a new one from the email", async ({ page, browser }) => {
  const account = await createAccount("Fern Forgetful");

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.waitForURL(/\/forgot-password$/);
  await waitForReact(page, "form");
  await page.getByLabel("Email").fill(account.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(`We sent a password reset link to ${account.email}`)).toBeVisible();

  const reset = await waitForEmail(account.email, /reset/i);
  await page.goto(linkIn(reset, /\/auth\/v1\/verify\?.*type=recovery/));
  await page.waitForURL(/\/reset-password$/);
  await waitForReact(page, "form");
  await page.getByLabel("New password").fill("brand-new-password");
  await page.getByLabel("Confirm password").fill("brand-new-password");
  await page.getByRole("button", { name: "Update password" }).click();
  await page.waitForURL(/\/dashboard$/);

  // The new password works and the old one doesn't, in a browser that was
  // never signed in.
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  for (const [password, works] of [
    [account.password, false],
    ["brand-new-password", true],
  ] as const) {
    await freshPage.goto("/login");
    await waitForReact(freshPage, "form");
    await freshPage.getByLabel("Email").fill(account.email);
    await freshPage.getByLabel("Password").fill(password);
    await freshPage.getByRole("button", { name: "Sign In" }).click();
    if (works) {
      await freshPage.waitForURL(/\/dashboard$/);
    } else {
      await expect(freshPage.getByText("Invalid login credentials")).toBeVisible();
    }
  }
  await fresh.close();
});
