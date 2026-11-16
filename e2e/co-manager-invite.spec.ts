// Co-managers. A guest who reserved a gift has an anonymous session, which
// isn't an account, so they're asked to sign in and can't accept an invite
// link. Someone who signs in from the same page can. And an owner can invite
// someone by email.

import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createAccount, createRegistryWithItem, db, reserveGift, signIn, uniqueEmail, waitForReact } from "./fixtures";
import { localSupabase } from "./local-supabase";
import { linkIn, waitForEmail } from "./mailbox";

async function managersOf(registryId: string) {
  const { data, error } = await db.from("registry_managers").select("user_id, role").eq("registry_id", registryId);
  if (error) throw error;
  return data;
}

test("a guest can't accept a co-manager invite, and an account that signs in from it can", async ({ page }) => {
  const { owner, registry } = await createRegistryWithItem();
  const token = randomBytes(24).toString("hex");
  const { error: inviteError } = await db
    .from("registry_invites")
    .insert({ registry_id: registry.id, invited_by: owner.id, token, max_uses: null });
  if (inviteError) throw inviteError;
  const invitePath = `/invite/${token}`;

  // Reserving a gift gives this browser a guest's anonymous session.
  await reserveGift(page, { slug: registry.slug, name: "Glinda Guest", email: uniqueEmail("guest") });

  // The invite page treats the guest as signed out.
  await page.goto(invitePath);
  await expect(page.getByText("Sign in or create an account to accept this invitation.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create Account" })).toHaveAttribute(
    "href",
    `/signup?redirect=${encodeURIComponent(invitePath)}`,
  );
  await expect(page.getByRole("button", { name: "Accept Invitation" })).toHaveCount(0);

  // A guest's session can't accept it by calling the database function
  // straight through the Data API either.
  const guest = createClient(localSupabase().apiUrl, localSupabase().anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: anonymous, error: anonymousError } = await guest.auth.signInAnonymously();
  if (anonymousError || !anonymous.user) throw anonymousError ?? new Error("No anonymous user");
  const { error: rpcError } = await guest.rpc("accept_registry_invite", {
    p_token: token,
    p_user_id: anonymous.user.id,
  });
  expect(rpcError?.message).toBe("Sign in or create an account to accept this invite");
  expect(await managersOf(registry.id)).toEqual([{ user_id: owner.id, role: "owner" }]);

  // Someone with an account signs in from the invite page, comes back to it,
  // and accepts.
  const account = await createAccount("Casey Comanager");
  await page.getByRole("link", { name: "Sign In" }).click();
  await page.waitForURL(/\/login\?redirect=/);
  await waitForReact(page, "form");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(`**${invitePath}`);
  await page.getByRole("button", { name: "Accept Invitation" }).click();
  await page.waitForURL(/\/dashboard/);

  expect(await managersOf(registry.id)).toEqual(
    expect.arrayContaining([
      { user_id: owner.id, role: "owner" },
      { user_id: account.id, role: "manager" },
    ]),
  );
  expect(await managersOf(registry.id)).toHaveLength(2);
});

test("an owner invites a co-parent by email, who signs in from the link and accepts", async ({ page, browser }) => {
  const { owner, registry, item } = await createRegistryWithItem();
  const coparent = await createAccount("Max Coparent");

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}/settings`);
  await page.getByPlaceholder("coparent@example.com").fill(coparent.email);
  await page.getByRole("button", { name: "Send Invite" }).click();
  await expect(page.getByRole("button", { name: "Sent!" })).toBeVisible();

  // Signed with the registry's names, "Remi & Max".
  const invite = await waitForEmail(coparent.email, `Remi & Max invited you to manage "${registry.title}"`);
  const invitePath = new URL(linkIn(invite, /\/invite\/[0-9a-f]+$/)).pathname;

  // The co-parent opens the link in a browser that isn't signed in, signs in
  // from it, comes back to it and accepts.
  const theirs = await browser.newContext();
  const theirPage = await theirs.newPage();
  await theirPage.goto(invitePath);
  await expect(theirPage.getByText(`Remi & Max invited you to help manage ${registry.title}.`)).toBeVisible();
  await theirPage.getByRole("link", { name: "Sign In" }).click();
  await theirPage.waitForURL(/\/login\?redirect=/);
  await waitForReact(theirPage, "form");
  await theirPage.getByLabel("Email").fill(coparent.email);
  await theirPage.getByLabel("Password").fill(coparent.password);
  await theirPage.getByRole("button", { name: "Sign In" }).click();
  await theirPage.waitForURL(`**${invitePath}`);
  await theirPage.getByRole("button", { name: "Accept Invitation" }).click();
  await theirPage.waitForURL(/\/dashboard/);
  expect(await managersOf(registry.id)).toEqual(
    expect.arrayContaining([
      { user_id: owner.id, role: "owner" },
      { user_id: coparent.id, role: "manager" },
    ]),
  );

  // Their dashboard lists it as shared with them, and they can add to it.
  await theirPage.goto("/dashboard");
  await expect(theirPage.getByRole("heading", { name: "Shared with you" })).toBeVisible();
  await expect(theirPage.getByText(registry.title)).toBeVisible();
  await theirPage.goto(`/dashboard/registry/${registry.id}`);
  await expect(theirPage.getByText(item.title)).toBeVisible();
  await expect(theirPage.getByRole("button", { name: "Add Item" }).first()).toBeVisible();
  await theirs.close();
});

test("an emailed invite is accepted as soon as its person opens their dashboard", async ({ page }) => {
  const { owner, registry } = await createRegistryWithItem();
  const coparent = await createAccount("Max Coparent");
  // What "Send Invite" saves (inviteManagerByEmail).
  const { error } = await db.from("registry_invites").insert({
    registry_id: registry.id,
    invited_by: owner.id,
    email: coparent.email,
    token: randomBytes(24).toString("hex"),
    max_uses: 1,
  });
  if (error) throw error;

  // Signing in opens the dashboard, which accepts it without the link.
  await signIn(page, coparent);
  await expect(page.getByRole("heading", { name: "Shared with you" })).toBeVisible();
  await expect(page.getByText(registry.title)).toBeVisible();
  expect(await managersOf(registry.id)).toEqual(
    expect.arrayContaining([{ user_id: coparent.id, role: "manager" }]),
  );
});
