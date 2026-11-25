// The phone app shows other people's lists, profiles and invitations as
// website pages in its own web view. /api/app/open signs that web view in as
// the app's user from the app's access token, then sends it to the page
// (src/app/api/app/open/route.ts).

import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { createAccount, createWishlist, db, signIn } from "./fixtures";
import { localSupabase } from "./local-supabase";

/** An access token for the account, as the app has after signing in. */
async function appAccessToken(account: { email: string; password: string }): Promise<string> {
  const { apiUrl, anonKey } = localSupabase();
  const app = createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await app.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error || !data.session) throw error ?? new Error("No session");
  return data.session.access_token;
}

/** Opens a page the way the app's web view does: the token goes only on the first request. */
async function openFromApp(page: Page, path: string, token: string | null) {
  await page.route("**/api/app/open?**", (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-regibee-app": "1", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    }),
  );
  return page.goto(`/api/app/open?next=${encodeURIComponent(path)}`);
}

test("a page opened from the app is signed in as the app's user", async ({ browser }) => {
  const owner = await createAccount("Wren Owner");
  const { registry } = await createWishlist(owner.id);
  // Private, so the list opens only for its owner.
  const { error } = await db.from("registries").update({ is_private: true, is_public: false }).eq("id", registry.id);
  if (error) throw error;

  const page = await (await browser.newContext()).newPage();
  const response = await openFromApp(page, `/r/${registry.slug}`, await appAccessToken(owner));
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/r/${registry.slug}$`));
  await expect(page.getByRole("heading", { name: registry.title })).toBeVisible();
  // The app has its own tabs, so the website's top bar is left out.
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  await expect(page.locator("header.sticky")).toHaveCount(0);

  // Opened again with no token, as when the app is signed out, the web view
  // is signed out too: the private list is gone.
  const signedOut = await openFromApp(page, `/r/${registry.slug}`, null);
  expect(signedOut?.status()).toBe(404);
});

test("the app's web view is only sent to pages on this site", async ({ browser }) => {
  const account = await createAccount("Odie Opener");
  const token = await appAccessToken(account);
  const page = await (await browser.newContext()).newPage();
  await openFromApp(page, "//example.com/r/x", token);
  expect(new URL(page.url()).pathname).not.toContain("example.com");
  expect(new URL(page.url()).host).toBe("localhost:3100");

  // A token that isn't a session's gets nothing.
  const other = await (await browser.newContext()).newPage();
  const refused = await openFromApp(other, "/dashboard", "not-a-token");
  expect(refused?.status()).toBe(401);
});

test("a link to the route from another site changes nothing", async ({ browser }) => {
  const owner = await createAccount("Lina Linked");
  const { registry } = await createWishlist(owner.id);
  const { error } = await db.from("registries").update({ is_private: true, is_public: false }).eq("id", registry.id);
  if (error) throw error;

  // Signed in to the website as usual, in a browser.
  const page = await (await browser.newContext()).newPage();
  await signIn(page, owner);
  expect((await page.goto(`/r/${registry.slug}`))?.status()).toBe(200);

  // Following a plain link to the route, with no app header and no token,
  // only goes on to the page: still signed in, and the top bar still shows.
  const response = await page.goto(`/api/app/open?next=${encodeURIComponent(`/r/${registry.slug}`)}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: registry.title })).toBeVisible();
  await expect(page.locator("header.sticky")).toHaveCount(1);
  expect((await page.context().cookies()).some((c) => c.name === "regibee_in_app")).toBe(false);
});

test("the website lets the Android app open its links", async ({ request }) => {
  // Android fetches this to check that com.regibee.app may open links to
  // www.regibee.com (Android App Links, intentFilters in mobile/app.config.ts).
  // It must answer 200 with JSON, with no redirect.
  const response = await request.get("/.well-known/assetlinks.json", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  const statements = await response.json();
  const app = statements.find((s: { target: { package_name?: string } }) => s.target.package_name === "com.regibee.app");
  expect(app.relation).toContain("delegate_permission/common.handle_all_urls");
  expect(app.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
  for (const fingerprint of app.target.sha256_cert_fingerprints) expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
});
