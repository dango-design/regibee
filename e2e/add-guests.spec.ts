// Adding guests to an event's list by typing them in: "Add another guest"
// gives the form another row, so a host adds several people at once without
// pasting a list. A row left blank is skipped, and an email already on the
// list isn't added twice.

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createAccount, db, signIn, uniqueEmail, uniqueId, waitForReact } from "./fixtures";

test("a host adds several guests at once, one row each", async ({ page }) => {
  const host = await createAccount("Hana Host");
  const { data: event, error } = await db
    .from("events")
    .insert({ owner_id: host.id, slug: `e2e-guests-${uniqueId()}`, title: `Game night ${uniqueId()}`, event_type: "other" })
    .select("id")
    .single();
  if (error) throw error;
  const glinda = uniqueEmail("glinda");
  const fiyero = uniqueEmail("fiyero");
  const { error: guestError } = await db
    .from("event_guests")
    .insert({ event_id: event.id, name: "Glinda Upland", email: glinda, token: randomUUID().replace(/-/g, "") });
  if (guestError) throw guestError;

  await signIn(page, host);
  await page.goto(`/dashboard/events/${event.id}`);
  const another = page.getByRole("button", { name: "Add another guest" });
  await waitForReact(another);

  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Fiyero Tigelaar");
  await page.getByRole("textbox", { name: "Email (optional)" }).fill(fiyero);
  await another.click();
  await page.getByRole("textbox", { name: "Guest 2 name" }).fill("Boq Woodsman");
  await another.click();
  // Glinda's already on the list: the same email in capitals doesn't add her again.
  await page.getByRole("textbox", { name: "Guest 3 name" }).fill("Glinda again");
  await page.getByRole("textbox", { name: "Guest 3 email" }).fill(glinda.toUpperCase());
  await another.click();
  await page.getByRole("button", { name: "Add 3 guests" }).click();

  await expect(page.getByText("Added 2 guests. 1 already on the list.")).toBeVisible();
  await expect(page.getByText("Fiyero Tigelaar", { exact: true })).toBeVisible();
  await expect(page.getByText("Boq Woodsman", { exact: true })).toBeVisible();
  // The form goes back to one empty row for the next guest.
  await expect(page.getByRole("textbox", { name: "Guest 2 name" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("");

  const { data: guests } = await db.from("event_guests").select("name, email").eq("event_id", event.id).order("name");
  expect(guests).toEqual([
    { name: "Boq Woodsman", email: null },
    { name: "Fiyero Tigelaar", email: fiyero },
    { name: "Glinda Upland", email: glinda },
  ]);
});
