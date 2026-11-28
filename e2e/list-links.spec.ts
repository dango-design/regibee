// A list opens only for people with its link. Its owner can make it link
// only, and get a new link that turns the old one off. Guests' gift emails
// still lead to their gifts (src/lib/list-links.ts).

import { expect, test } from "@playwright/test";
import {
  createAccount,
  createExchangeEvent,
  createWishlist,
  db,
  joinExchange,
  reserveGift,
  SHIPPING_ADDRESS,
  signIn,
  SITE_URL,
  uniqueEmail,
  uniqueId,
  waitForReact,
} from "./fixtures";
import { linkIn, waitForEmail } from "./mailbox";

test("the owner gets a new link: the old one stops working, guests' gift emails still do", async ({
  page,
  browser,
}) => {
  const owner = await createAccount("Remi Owner");
  const id = uniqueId();
  // An old-style link, like the ones made before links got 12 random characters.
  const oldSlug = `e2e-links-${id}`;
  const { data: registry, error } = await db
    .from("registries")
    .insert({
      owner_id: owner.id,
      title: `Maya's Wishlist ${id}`,
      slug: oldSlug,
      is_public: true,
      registry_type: "personal",
      event_type: "birthday",
      settings: { shipping_address: SHIPPING_ADDRESS },
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: item, error: itemError } = await db
    .from("registry_items")
    .insert({ registry_id: registry.id, title: `Kite ${id}`, price: 25, quantity_needed: 1 })
    .select("id, title")
    .single();
  if (itemError) throw itemError;

  // A guest reserves the gift, says they bought it, and gets the usual
  // emails, with links to the list's current link.
  const guest = await browser.newContext();
  const guestEmail = uniqueEmail("guest");
  await reserveGift(await guest.newPage(), { slug: oldSlug, name: "Glinda Guest", email: guestEmail });
  const reserved = await waitForEmail(guestEmail, `You reserved "${item.title}". It's held for 2 days`);
  const confirmPage = await guest.newPage();
  await confirmPage.goto(linkIn(reserved, /\/gift\/[0-9a-f-]+\?step=confirm$/));
  const bought = confirmPage.getByRole("dialog").getByRole("button", { name: "Yes, I bought it" });
  await waitForReact(bought);
  await bought.click();
  await expect(confirmPage.getByRole("dialog").getByRole("heading", { name: "Thank you!" })).toBeVisible();
  const confirmed = await waitForEmail(guestEmail, `Your gift is confirmed — "${item.title}"`);
  const undoUrl = linkIn(confirmed, /\/gift\/[0-9a-f-]+\?step=release$/);
  const signedUrl = linkIn(confirmed, /\/r\/[^/?]+\?email=.+&sig=[0-9a-f]+$/);
  expect(undoUrl).toContain(`/r/${oldSlug}/gift/`);
  expect(signedUrl).toContain(`/r/${oldSlug}?`);

  // The owner makes the list link only and turns its link off.
  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}/settings`);
  // The choices are cards: each radio button is hidden inside its label.
  const linkOnly = page.getByRole("radio", { name: /Anyone with the link/ });
  await waitForReact(linkOnly);
  await page.locator("label", { hasText: "Anyone with the link" }).click();
  await expect(linkOnly).toBeChecked();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: "Saved!" })).toBeVisible();
  await expect(page.getByText(`/r/${oldSlug}`)).toBeVisible();
  await page.getByRole("button", { name: "Get a new link" }).click();
  await page.getByRole("button", { name: "Replace link" }).click();
  await expect(page.getByRole("status")).toContainText("The old link no longer works");

  const { data: changed } = await db.from("registries").select("slug, is_public").eq("id", registry.id).single();
  expect(changed?.is_public).toBe(false);
  const newSlug = changed!.slug as string;
  expect(newSlug).toMatch(new RegExp(`^maya-s-wishlist-${id}-[a-kmnp-z2-9]{12}$`));
  await expect(page.getByText(`/r/${newSlug}`)).toBeVisible();

  // Someone with only the old link gets nowhere, and isn't told where it went.
  const stranger = await (await browser.newContext()).newPage();
  const response = await stranger.goto(`/r/${oldSlug}`);
  expect(response?.status()).toBe(404);
  await expect(stranger.getByRole("heading", { name: "This link doesn't open a list" })).toBeVisible();
  // A made-up gift link on the old link doesn't get through either.
  await stranger.goto(`/r/${oldSlug}/gift/00000000-0000-4000-8000-000000000000?step=confirm`);
  await expect(stranger).toHaveURL(new RegExp(`/r/${oldSlug}$`));
  await expect(stranger.getByRole("heading", { name: "This link doesn't open a list" })).toBeVisible();

  // The new link opens the list.
  await stranger.goto(`/r/${newSlug}`);
  await expect(stranger.getByRole("heading", { name: `Maya's Wishlist ${id}` })).toBeVisible();

  // The guest's gift link, from an email app that has never seen the list,
  // goes to the new link with their gift open.
  const emailApp = await (await browser.newContext()).newPage();
  await emailApp.goto(undoUrl);
  await expect(
    emailApp.getByRole("dialog").getByRole("heading", { name: `Undo your gift of the ${item.title}?` }),
  ).toBeVisible();
  // The page drops ?gift= and &step= from the address once the dialog is open.
  await expect(emailApp).toHaveURL(new RegExp(`/r/${newSlug}$`));

  // So does their signed "see your gifts" link.
  const signed = await (await browser.newContext()).newPage();
  await signed.goto(signedUrl);
  await expect(signed).toHaveURL(new RegExp(`/r/${newSlug}\\?email=.+&sig=[0-9a-f]+$`));
  await expect(signed.getByRole("heading", { name: `Maya's Wishlist ${id}` })).toBeVisible();

  // The same link with a forged signature doesn't.
  const forged = signedUrl.replace(/sig=[0-9a-f]+$/, "sig=0000000000000000");
  const forgedResponse = await signed.goto(forged);
  expect(forgedResponse?.status()).toBe(404);
});

test("a gift exchange guest's wishlist link follows the list's new link", async ({ page, browser }) => {
  const owner = await createAccount("Maya Owner");
  const { registry } = await createWishlist(owner.id);
  const { guests } = await createExchangeEvent(owner.id, [{ name: "Maya", email: owner.email }]);

  // Maya adds her wishlist when she RSVPs.
  const rsvp = await (await browser.newContext()).newPage();
  await joinExchange(rsvp, guests[0].rsvpPath, `${SITE_URL}/r/${registry.slug}`);
  const { data: before } = await db.from("event_guests").select("wishlist_registry_id").eq("id", guests[0].id).single();
  expect(before?.wishlist_registry_id).toBe(registry.id);

  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}/settings`);
  const newLink = page.getByRole("button", { name: "Get a new link" });
  await waitForReact(newLink);
  await newLink.click();
  await page.getByRole("button", { name: "Replace link" }).click();
  await expect(page.getByRole("status")).toContainText("The old link no longer works");

  const { data: changed } = await db.from("registries").select("slug").eq("id", registry.id).single();
  expect(changed?.slug).not.toBe(registry.slug);
  const { data: after } = await db.from("event_guests").select("wishlist_url").eq("id", guests[0].id).single();
  expect(after?.wishlist_url).toBe(`${SITE_URL}/r/${changed?.slug}`);
});
