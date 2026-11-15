// The account emails Supabase sends itself, from the templates in
// supabase/templates/. Local Supabase doesn't ask new accounts to confirm
// their email address, so only the password reset email is tested here. Both
// templates are installed the same way.

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { AUTH_EMAILS } from "../src/lib/auth-email-templates";
import { createAccount, signIn, waitForReact } from "./fixtures";
import { linkIn, waitForEmail } from "./mailbox";

test("the password reset email is Regibee's, and its link sets a new password", async ({ page }) => {
  const account = await createAccount("Rita Reset");

  await page.goto("/forgot-password");
  await waitForReact(page, "form");
  await page.getByRole("textbox", { name: "Email" }).fill(account.email);
  await page.getByRole("button", { name: "Send reset link" }).click();

  const email = await waitForEmail(account.email, AUTH_EMAILS.recovery.subject);
  expect(email.html).toContain("Choose a new password");
  const link = linkIn(email, /\/auth\/v1\/verify\?/);
  // The button and the link to copy are the same link.
  expect(email.html.replaceAll("&amp;", "&").split(link)).toHaveLength(3);

  await page.goto(link);
  await page.waitForURL(/\/reset-password/);
  await waitForReact(page, "form");
  const newPassword = `pw-${randomUUID()}`;
  const passwords = page.locator('input[type="password"]');
  await passwords.nth(0).fill(newPassword);
  await passwords.nth(1).fill(newPassword);
  await page.getByRole("button", { name: "Update password" }).click();
  await page.waitForURL(/\/dashboard/);

  // The new password works.
  await page.context().clearCookies();
  await signIn(page, { email: account.email, password: newPassword });
});
