// Finding someone to follow by their email address, on the Following tab
// (src/components/people-search.tsx). A whole address finds the account
// behind it when its owner lets people find them by email, and the result
// has a Follow button. The request waits on the other person's Account page
// until they approve it. Otherwise the search offers an invite, and looks the
// same whether or not the address has an account.

import { expect, test, type Page } from "@playwright/test";
import { createAccount, createRegistryWithItem, db, reserveGift, signIn, uniqueEmail, waitForReact } from "./fixtures";
import { linkIn, waitForEmail } from "./mailbox";

/**
 * Whether people can find the account by its email. Every account can be
 * found unless its owner switched it off (20261120213206_email_search_for_everyone.sql),
 * but accounts made here start with it off, so tests set it.
 */
async function findableByEmail(userId: string, findable = true) {
  const { error } = await db.from("profiles").update({ findable_by_email: findable }).eq("id", userId);
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

/** Types into Find people and presses Enter, which looks up an email address. */
async function lookUp(page: Page, text: string) {
  const box = page.getByRole("searchbox", { name: "Find people" });
  // Before React takes over, Enter would submit the form as a page load.
  await waitForReact(box);
  await box.fill(text);
  await box.press("Enter");
}

/**
 * One person in the search's results. Once someone asks to follow, the
 * Following page lists them again further down, so this stays in the results.
 */
function searchResult(page: Page, name: string) {
  return page.getByRole("list", { name: "Search results" }).getByRole("listitem").filter({ hasText: name });
}

test("someone types a friend's exact email, asks to follow, and the friend approves it", async ({ page, browser }) => {
  const sid = await createAccount("Sid Searcher");
  const fran = await createAccount("Fran Findable");
  await findableByEmail(fran.id);

  await signIn(page, sid);
  await page.goto("/dashboard/following");

  // Capitals and spaces around the address don't matter.
  await lookUp(page, `  ${fran.email.toUpperCase()} `);
  const result = searchResult(page, "Fran Findable");
  await expect(result).toBeVisible();
  await expect(result).toContainText("Approves every follower");
  // The result shows the name, never the address.
  await expect(result).not.toContainText(fran.email, { ignoreCase: true });

  await result.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(result.getByRole("button", { name: "Requested" })).toBeVisible();
  await expect(result).toContainText("Waiting for approval");
  await expect.poll(() => followStatus(sid.id, fran.id)).toBe("pending");

  // Fran gets an email about it, with a link to the follow requests on her Account page.
  const email = await waitForEmail(fran.email, "Sid Searcher wants to follow you on Regibee");
  const reviewLink = linkIn(email, /\/dashboard\/account#follow-requests$/);

  // Looking her up again shows the request still waiting.
  await page.reload();
  await lookUp(page, fran.email);
  await expect(result.getByRole("button", { name: "Requested" })).toBeVisible();

  // Fran sees it waiting on her Account page, and approves it.
  const franContext = await browser.newContext();
  const franPage = await franContext.newPage();
  await signIn(franPage, fran);
  await franPage.goto(reviewLink);
  const requests = franPage.locator("#follow-requests");
  await expect(requests).toContainText("Sid Searcher");
  // A click before React takes over the page does nothing.
  const approve = requests.getByRole("button", { name: "Approve" });
  await waitForReact(approve);
  await approve.click();
  await expect.poll(() => followStatus(sid.id, fran.id)).toBe("approved");
  await franContext.close();

  // Now the search says Sid follows her.
  await page.reload();
  await lookUp(page, fran.email);
  await expect(result.getByRole("button", { name: "Following" })).toBeVisible();
});

test("an address that isn't findable offers an invite, the same whether or not it has an account", async ({ page }) => {
  const sid = await createAccount("Sid Inviter");
  // Hal has an account but switched off being found by email.
  const hal = await createAccount("Hal Hidden");
  await findableByEmail(hal.id, false);
  const nobody = uniqueEmail("nobody");

  await signIn(page, sid);
  await page.goto("/dashboard/following");

  for (const address of [hal.email, nobody]) {
    await lookUp(page, address);
    await expect(page.getByText(`No one has made their account findable with ${address}.`)).toBeVisible();
    await expect(page.getByText("Hal Hidden")).toHaveCount(0);
    await page.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText(`Invite sent to ${address}.`)).toBeVisible();

    // The email asks them to let Sid follow them, from a link anyone can open.
    const invite = await waitForEmail(address, "Sid Inviter wants to follow you on Regibee");
    expect(linkIn(invite, /\/follow-invite\/[\w-]+$/)).toBeTruthy();
  }

  // Nothing waits on Hal's Account page and no follow exists until he says yes.
  expect(await followStatus(sid.id, hal.id)).toBeNull();

  // Both invites count against Sid's daily emails, since he typed the addresses.
  const { data: sends } = await db.from("email_sends").select("kind, emails").eq("user_id", sid.id);
  expect(sends).toEqual([
    { kind: "follow_invite", emails: 1 },
    { kind: "follow_invite", emails: 1 },
  ]);
});

test("searching your own email shows you, without a Follow button", async ({ page }) => {
  const sid = await createAccount("Sid Self");
  await findableByEmail(sid.id);

  await signIn(page, sid);
  await page.goto("/dashboard/following");
  await lookUp(page, sid.email);
  const result = searchResult(page, "Sid Self");
  await expect(result).toContainText("That's you");
  await expect(result.getByRole("button")).toHaveCount(0);
});

test("a guest who reserved a gift is sent to make an account before finding people", async ({ page }) => {
  const { registry } = await createRegistryWithItem();
  await reserveGift(page, { slug: registry.slug, name: "Gus Guest", email: uniqueEmail("gus") });

  await page.goto("/dashboard/following");
  await page.waitForURL(/\/signup\?redirect=(\/|%2F)dashboard(\/|%2F)following$/);
});
