// Gift funds: an owner asks for money toward something, a guest gives some,
// and both hear about it by email.

import { expect, test } from "@playwright/test";
import { createRegistryWithItem, db, signIn, SITE_URL, uniqueEmail, waitForReact } from "./fixtures";
import { waitForEmail } from "./mailbox";

test("an owner adds a gift fund, a guest contributes, and both get an email", async ({ page, browser }) => {
  const { owner, registry } = await createRegistryWithItem();
  await signIn(page, owner);
  await page.goto(`/dashboard/registry/${registry.id}`);

  // A click before React takes over the page does nothing.
  const addFund = page.getByRole("button", { name: "Add Fund" });
  await waitForReact(addFund);
  await addFund.click();
  const create = page.getByRole("dialog");
  await expect(create.getByRole("heading", { name: "Create gift fund" })).toBeVisible();
  await create.getByLabel("Fund Name").fill("College Fund");
  await create.getByLabel("Goal Amount (optional)").fill("500");
  await create.getByRole("button", { name: "Create fund" }).click();
  await expect(create).toBeHidden();
  await expect(page.getByRole("heading", { name: "College Fund" })).toBeVisible();
  const { data: fund } = await db
    .from("cash_funds")
    .select("id, goal_amount, current_amount")
    .eq("registry_id", registry.id)
    .single();
  expect(fund).toMatchObject({ goal_amount: 500, current_amount: 0 });

  // A guest gives $50 from the registry's page, with no account.
  const guestEmail = uniqueEmail("guest");
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(`/r/${registry.slug}`);
  const contribute = guestPage.getByRole("button", { name: "Contribute" });
  await waitForReact(contribute);
  await contribute.click();
  const give = guestPage.getByRole("dialog");
  await expect(give.getByRole("heading", { name: "Contribute to “College Fund”" })).toBeVisible();
  await give.getByRole("spinbutton", { name: /^Amount/ }).fill("50");
  await give.getByLabel("Your Name").fill("Glinda Guest");
  await give.getByLabel("Your Email").fill(guestEmail);
  await give.getByLabel("Message (optional)").fill("For the first textbook!");
  await give.getByRole("button", { name: "Contribute" }).click();
  // A thank-you opens. Behind it, the fund says what this guest gave, and
  // offers to give again instead of looking done.
  await guestPage.getByRole("button", { name: "Done" }).click();
  await expect(guestPage.getByText("You gave $50.00")).toBeVisible();
  await expect(guestPage.getByRole("button", { name: "Give again" })).toBeVisible();

  const { data: after } = await db.from("cash_funds").select("current_amount").eq("id", fund!.id).single();
  expect(after?.current_amount).toBe(50);
  const { data: gift } = await db
    .from("purchases")
    .select("buyer_name, buyer_email, amount, message")
    .eq("cash_fund_id", fund!.id)
    .single();
  expect(gift).toEqual({
    buyer_name: "Glinda Guest",
    buyer_email: guestEmail,
    amount: 50,
    message: "For the first textbook!",
  });

  // The owners hear who gave and how much, with a link to the fund.
  const toOwner = await waitForEmail(owner.email, `💵 Glinda Guest contributed $50.00 to "College Fund"`);
  expect(toOwner.links).toContain(`${SITE_URL}/dashboard/registry/${registry.id}?highlight=${fund!.id}`);
  expect(toOwner.html).toContain("For the first textbook!");
  // The guest gets a receipt that links back to the registry.
  const toGuest = await waitForEmail(guestEmail, `Your contribution is confirmed — "College Fund"`);
  expect(toGuest.links.some((link) => link.startsWith(`${SITE_URL}/r/${registry.slug}`))).toBe(true);

  // The guest gives again. The fund adds it to what they gave before, and so
  // does the page, after a reload too.
  await guestPage.getByRole("button", { name: "Give again" }).click();
  const again = guestPage.getByRole("dialog");
  await again.getByRole("spinbutton", { name: /^Amount/ }).fill("25");
  await again.getByLabel("Your Name").fill("Glinda Guest");
  await again.getByLabel("Your Email").fill(guestEmail);
  await again.getByRole("button", { name: "Contribute" }).click();
  await guestPage.getByRole("button", { name: "Done" }).click();
  await expect(guestPage.getByText("You gave $75.00")).toBeVisible();
  const { data: twice } = await db.from("cash_funds").select("current_amount").eq("id", fund!.id).single();
  expect(twice?.current_amount).toBe(75);
  await guestPage.reload();
  await expect(guestPage.getByText("You gave $75.00")).toBeVisible();
  await guest.close();
});
