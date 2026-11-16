// Making an account and getting back into one. Both emails here come from
// Supabase itself, not from the site's mailer, and local Supabase sends them
// to Mailpit too. Local Supabase asks new accounts to confirm their email, as
// production does (supabase/config.toml). It sends Regibee's templates from
// supabase/templates/, which `npm run auth-emails` writes from
// src/lib/auth-email-templates.ts.

import { expect, test } from "@playwright/test";
import { AUTH_EMAILS } from "../src/lib/auth-email-templates";
import { createAccount, db, uniqueEmail, waitForReact } from "./fixtures";
import { linkIn, waitForEmail, type ReceivedEmail } from "./mailbox";

/** Checks the email is Regibee's template, not Supabase's default. */
function expectRegibeeEmail(email: ReceivedEmail, button: string, link: string) {
  expect(email.html).toContain(`>${button}</a>`);
  // The button and the link to copy under it are the same link.
  expect(email.html.replaceAll("&amp;", "&").split(link)).toHaveLength(3);
}

test("someone signs up, confirms their email, and starts on an empty dashboard", async ({ page }) => {
  const email = uniqueEmail("sam");
  const password = "a-new-password";

  await page.goto("/signup");
  await waitForReact(page.locator("form"));
  await page.getByLabel("Your name").fill("Sam Signup");
  // The "Let friends find me" box mentions email too.
  await page.getByRole("textbox", { name: /^Email/ }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  await expect(page.getByText(`We sent a link to ${email}. Open it to confirm your account`)).toBeVisible();

  // Until they confirm, the account can't sign in.
  const other = await page.context().browser()!.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto("/login");
  await waitForReact(otherPage.locator("form"));
  await otherPage.getByLabel("Email").fill(email);
  await otherPage.getByLabel("Password").fill(password);
  await otherPage.getByRole("button", { name: "Sign in" }).click();
  await expect(otherPage.getByText("Email not confirmed")).toBeVisible();
  await other.close();

  // The link in the email signs them in and opens the dashboard.
  const confirm = await waitForEmail(email, AUTH_EMAILS.confirmation.subject);
  const confirmLink = linkIn(confirm, /\/auth\/v1\/verify\?.*type=signup/);
  expectRegibeeEmail(confirm, "Confirm email address", confirmLink);
  await page.goto(confirmLink);
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
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.waitForURL(/\/forgot-password$/);
  await waitForReact(page.locator("form"));
  await page.getByLabel("Email").fill(account.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(`If there's an account for ${account.email}, we sent it a link to set a new password.`)).toBeVisible();

  const reset = await waitForEmail(account.email, AUTH_EMAILS.recovery.subject);
  const resetLink = linkIn(reset, /\/auth\/v1\/verify\?.*type=recovery/);
  expectRegibeeEmail(reset, "Choose a new password", resetLink);
  await page.goto(resetLink);
  await page.waitForURL(/\/reset-password$/);
  await waitForReact(page.locator("form"));
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
    await waitForReact(freshPage.locator("form"));
    await freshPage.getByLabel("Email").fill(account.email);
    await freshPage.getByLabel("Password").fill(password);
    await freshPage.getByRole("button", { name: "Sign in" }).click();
    if (works) {
      await freshPage.waitForURL(/\/dashboard$/);
    } else {
      await expect(freshPage.getByText("That email and password don't match.")).toBeVisible();
    }
  }
  await fresh.close();
});
