// Emails that visitors set off (see "Account levels" in CLAUDE.md): a list,
// event or group gift sends only so many a day because of what visitors do
// there, and its owner's level sets how many. Over the limit, the gift still
// saves and only the email is skipped.
//
// Each test starts its list near the limit by logging earlier sends, and
// removes them afterwards. Basic owners' pages share one daily allowance, so
// leftover rows would cut into other runs.

import { expect, test } from "@playwright/test";
import { createRegistryWithItem, db, reserveGift, uniqueEmail } from "./fixtures";
import { emailsTo, waitForEmail } from "./mailbox";
import { DAILY_VISITOR_EMAILS } from "../src/lib/account-levels";

/** Logs that the page already sent this many visitors' emails today. */
async function alreadySentFrom(pageId: string, level: "basic" | "star", emails: number) {
  const { error } = await db.from("visitor_email_sends").insert({ page_id: pageId, level, kind: "gift", emails });
  if (error) throw error;
}

async function sentFrom(pageId: string): Promise<number> {
  const { data, error } = await db.from("visitor_email_sends").select("emails").eq("page_id", pageId);
  if (error) throw error;
  return data.reduce((sum, row) => sum + row.emails, 0);
}

test("a basic owner's list stops emailing visitors at its daily limit, and gifts still save", async ({
  page,
  browser,
}) => {
  const { registry, item } = await createRegistryWithItem({ star: false });
  // Two to give, so a second guest can reserve one too.
  await db.from("registry_items").update({ quantity_needed: 2 }).eq("id", item.id);
  const other = await browser.newContext();
  try {
    await alreadySentFrom(registry.id, "basic", DAILY_VISITOR_EMAILS.basic - 1);

    // The first guest's confirmation takes the list's last email for today.
    const first = uniqueEmail("ada");
    await reserveGift(page, { slug: registry.slug, name: "Ada Guest", email: first });
    await waitForEmail(first, `You reserved "${item.title}". It's held for 2 days`);
    expect(await sentFrom(registry.id)).toBe(DAILY_VISITOR_EMAILS.basic);

    // The second guest's gift saves, but no email goes out.
    const second = uniqueEmail("bo");
    await reserveGift(await other.newPage(), { slug: registry.slug, name: "Bo Guest", email: second });
    const { data: gifts } = await db
      .from("purchases")
      .select("status")
      .eq("registry_item_id", item.id)
      .eq("buyer_email", second);
    expect(gifts).toEqual([{ status: "reserved" }]);

    // The email would go right after the page answers. Give it time to.
    await page.waitForTimeout(3000);
    expect(await emailsTo(second)).toHaveLength(0);
    expect(await sentFrom(registry.id)).toBe(DAILY_VISITOR_EMAILS.basic);
  } finally {
    await other.close();
    await db.from("visitor_email_sends").delete().eq("page_id", registry.id);
  }
});

test("a star owner's list keeps emailing visitors past the basic limit", async ({ page }) => {
  const { registry, item } = await createRegistryWithItem();
  try {
    await alreadySentFrom(registry.id, "star", DAILY_VISITOR_EMAILS.basic);

    const guest = uniqueEmail("cy");
    await reserveGift(page, { slug: registry.slug, name: "Cy Guest", email: guest });
    await waitForEmail(guest, `You reserved "${item.title}". It's held for 2 days`);
    expect(await sentFrom(registry.id)).toBe(DAILY_VISITOR_EMAILS.basic + 1);
  } finally {
    await db.from("visitor_email_sends").delete().eq("page_id", registry.id);
  }
});
