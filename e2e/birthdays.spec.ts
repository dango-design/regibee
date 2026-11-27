// Gift profiles, birthdays and Follow back. Until someone chooses otherwise,
// their sizes and likes show only to friends, and their birthday only to them
// and the followers they approved. Those followers see it coming up on their
// Following page, and get one email 10 days before it. Each part can show to
// only them, friends, followers or everyone instead. A follower is one tap
// from following back, and two people who follow each other show as Friends.

import { expect, test, type Page } from "@playwright/test";
import { chooseOption, createAccount, createWishlist, CRON_SECRET, db, waitForReact } from "./fixtures";
import { emailsTo, linkIn, waitForEmail } from "./mailbox";
import { addDays, formatBirthday, MONTH_OPTIONS } from "../src/lib/gift-profile";
import { profilePath } from "../src/lib/profile-link";

/** Today in UTC, the same as the server. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A month and day this many days from today. */
function birthdayIn(days: number) {
  const date = addDays(today(), days);
  return { month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)) };
}

async function follow(followerId: string, followeeId: string, status: "pending" | "approved") {
  const { error } = await db.from("follows").insert({
    follower_id: followerId,
    followee_id: followeeId,
    status,
    approved_at: status === "approved" ? new Date().toISOString() : null,
  });
  if (error) throw error;
}

/**
 * Someone with a birthday, sizes, likes and a public note, and one wishlist on
 * their profile. `audience` is who they show each part to.
 */
async function personWithBirthday(
  name: string,
  birthday: { month: number; day: number },
  audience?: Record<string, string>,
) {
  const person = await createAccount(name);
  const { error } = await db
    .from("profiles")
    .update({
      gift_profile: {
        birthday,
        sizes: { tops: "M" },
        likes: ["Bubble tea"],
        skip: ["Candles"],
        ...(audience ? { audience } : {}),
      },
      public_note: "Ask me about my garden.",
    })
    .eq("id", person.id);
  if (error) throw error;
  const { registry } = await createWishlist(person.id);
  await db.from("registries").update({ listed_on_profile: true }).eq("id", registry.id);
  const { data: profile } = await db.from("profiles").select("public_id, full_name").eq("id", person.id).single();
  return { ...person, registry, path: profilePath(profile!) };
}

async function runBirthdayJob(page: Page) {
  const response = await page.request.get("/api/cron/birthdays", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  return response.json() as Promise<{ birthdays: number; sent: number; failed: number }>;
}

async function signInAs(page: Page, account: { email: string; password: string }) {
  await page.goto("/login");
  await waitForReact(page.locator("form"));
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

const birthdayEmails = async (address: string) =>
  (await emailsTo(address)).filter((email) => email.subject.includes("birthday"));

test("approved followers get one email 10 days before a birthday", async ({ page }) => {
  const glinda = await personWithBirthday("Glinda Upland", birthdayIn(10));
  const max = await createAccount("Max Friend");
  const oz = await createAccount("Oz Waiting");
  const elphaba = await createAccount("Elphaba Quiet");
  await follow(max.id, glinda.id, "approved");
  await follow(oz.id, glinda.id, "pending");
  await follow(elphaba.id, glinda.id, "approved");
  await db.from("profiles").update({ email_birthday_reminders: false }).eq("id", elphaba.id);

  const first = await runBirthdayJob(page);
  expect(first.sent).toBeGreaterThanOrEqual(1);

  const email = await waitForEmail(max.email, "Glinda Upland's birthday is in 10 days");
  expect(linkIn(email, /\/r\//)).toContain(`/r/${glinda.registry.slug}`);
  expect(linkIn(email, /#birthday-emails$/)).toContain("/dashboard/account");

  // Running again the same day sends nothing new.
  await runBirthdayJob(page);
  await page.waitForTimeout(1500);
  expect(await birthdayEmails(max.email)).toHaveLength(1);
  // A follower waiting for approval, and one who turned the emails off, get none.
  expect(await birthdayEmails(oz.email)).toHaveLength(0);
  expect(await birthdayEmails(elphaba.email)).toHaveLength(0);
});

test("followers see a birthday, friends see sizes and likes, and anyone sees the public note", async ({ browser }) => {
  const birthday = birthdayIn(5);
  const glinda = await personWithBirthday("Glinda Bubbles", birthday);
  const max = await createAccount("Max Follower");
  await follow(max.id, glinda.id, "approved");
  const paths = [glinda.path, `/r/${glinda.registry.slug}`];

  const maxContext = await browser.newContext();
  const page = await maxContext.newPage();
  await signInAs(page, max);

  // The Following page lists it.
  await page.goto("/dashboard/following");
  const coming = page.getByRole("region", { name: "Birthdays coming up" });
  await expect(coming.getByText("Glinda Bubbles")).toBeVisible();
  await expect(coming.getByText("In 5 days")).toBeVisible();

  // Glinda doesn't follow Max back, so he sees her birthday and her public
  // note, but not her sizes and likes, on her profile or her wishlist.
  await page.goto(glinda.path);
  await expect(page.getByText("Ask me about my garden.")).toBeVisible();
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByText(formatBirthday(birthday), { exact: true })).toBeVisible();
    await expect(page.getByText("Bubble tea")).toHaveCount(0);
    await expect(page.getByText("Tops: M")).toHaveCount(0);
    await expect(page.getByText("Candles")).toHaveCount(0);
  }

  // Once she follows him back, he sees them in both places.
  await follow(glinda.id, max.id, "approved");
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByText(formatBirthday(birthday), { exact: true })).toBeVisible();
    await expect(page.getByText("Bubble tea")).toBeVisible();
    await expect(page.getByText("Tops: M")).toBeVisible();
  }
  await page.goto(glinda.path);
  await expect(page.getByRole("heading", { name: "About Glinda Bubbles" })).toBeVisible();
  await maxContext.close();

  // Someone with only the links sees the public note on her profile, and no
  // sizes, likes or birthday anywhere.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  for (const path of paths) {
    await visitorPage.goto(path);
    await expect(visitorPage.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(visitorPage.getByText("Bubble tea")).toHaveCount(0);
    await expect(visitorPage.getByText("Tops: M")).toHaveCount(0);
    await expect(visitorPage.getByText("Candles")).toHaveCount(0);
    await expect(visitorPage.getByText(formatBirthday(birthday), { exact: true })).toHaveCount(0);
    await expect(visitorPage.getByText("Birthday", { exact: true })).toHaveCount(0);
    await expect(visitorPage.getByRole("heading", { name: "About Glinda Bubbles" })).toHaveCount(0);
  }
  await visitorPage.goto(glinda.path);
  await expect(visitorPage.getByText("Ask me about my garden.")).toBeVisible();
  await visitor.close();
});

test("each part of a gift profile shows to the people its owner chose", async ({ browser, page }) => {
  const birthday = birthdayIn(10);
  // Sizes to everyone, likes to followers, and the birthday only to friends.
  const glinda = await personWithBirthday("Glinda Choosy", birthday, {
    birthday: "friends",
    sizes: "everyone",
    likes: "followers",
  });
  const max = await createAccount("Max Follower Only");
  const friend = await createAccount("Fiyero Friend");
  await follow(max.id, glinda.id, "approved");
  await follow(friend.id, glinda.id, "approved");
  await follow(glinda.id, friend.id, "approved");
  const paths = [glinda.path, `/r/${glinda.registry.slug}`];

  // Anyone with the links sees her sizes, and nothing else.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  for (const path of paths) {
    await visitorPage.goto(path);
    await expect(visitorPage.getByText("Tops: M")).toBeVisible();
    await expect(visitorPage.getByText("Bubble tea")).toHaveCount(0);
    await expect(visitorPage.getByText(formatBirthday(birthday), { exact: true })).toHaveCount(0);
  }
  await visitor.close();

  // A follower who isn't a friend sees her likes too, but not her birthday,
  // and it isn't on his Following page.
  const maxContext = await browser.newContext();
  const maxPage = await maxContext.newPage();
  await signInAs(maxPage, max);
  for (const path of paths) {
    await maxPage.goto(path);
    await expect(maxPage.getByText("Bubble tea")).toBeVisible();
    await expect(maxPage.getByText(formatBirthday(birthday), { exact: true })).toHaveCount(0);
  }
  await maxPage.goto("/dashboard/following");
  await expect(maxPage.getByRole("region", { name: "Birthdays coming up" }).getByText("Glinda Choosy")).toHaveCount(0);
  await maxContext.close();

  // Her friend sees the birthday, and only he gets the email about it.
  const friendContext = await browser.newContext();
  const friendPage = await friendContext.newPage();
  await signInAs(friendPage, friend);
  await friendPage.goto(glinda.path);
  await expect(friendPage.getByText(formatBirthday(birthday), { exact: true })).toBeVisible();
  await friendContext.close();

  await runBirthdayJob(page);
  await waitForEmail(friend.email, "Glinda Choosy's birthday is in 10 days");
  await page.waitForTimeout(1500);
  expect((await birthdayEmails(max.email)).filter((e) => e.subject.includes("Glinda Choosy"))).toHaveLength(0);

  // Kept to herself, the birthday shows to nobody else and is in no email.
  await db
    .from("profiles")
    .update({
      gift_profile: {
        birthday,
        sizes: { tops: "M" },
        audience: { birthday: "private", sizes: "private", likes: "private" },
      },
    })
    .eq("id", glinda.id);
  const friendAgain = await browser.newContext();
  const friendAgainPage = await friendAgain.newPage();
  await signInAs(friendAgainPage, friend);
  await friendAgainPage.goto(glinda.path);
  await expect(friendAgainPage.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(friendAgainPage.getByText(formatBirthday(birthday), { exact: true })).toHaveCount(0);
  await expect(friendAgainPage.getByText("Tops: M")).toHaveCount(0);
  await friendAgainPage.goto("/dashboard/following");
  await expect(
    friendAgainPage.getByRole("region", { name: "Birthdays coming up" }).getByText("Glinda Choosy"),
  ).toHaveCount(0);
  await friendAgain.close();
});

test("a follower is one tap from following back, and approving offers it too", async ({ page }) => {
  const glinda = await createAccount("Glinda Host");
  const max = await createAccount("Max Mutual");
  const oz = await createAccount("Oz Asking");
  await follow(max.id, glinda.id, "approved");
  await follow(oz.id, glinda.id, "pending");

  await signInAs(page, glinda);
  await page.goto("/dashboard/account");

  // Max already follows Glinda: one tap sends a request back. The page
  // compiles on first visit, so wait until React handles the button.
  const followBack = page.getByRole("button", { name: "Follow back Max Mutual" });
  await waitForReact(followBack);
  await followBack.click();
  await expect(page.getByText("Requested").first()).toBeVisible();
  await expect
    .poll(async () => {
      const { data } = await db
        .from("follows")
        .select("status")
        .eq("follower_id", glinda.id)
        .eq("followee_id", max.id)
        .maybeSingle();
      return data?.status;
    })
    .toBe("pending");

  // Approving Oz's request offers to follow Oz back right there.
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("button", { name: "Follow back Oz Asking" }).first()).toBeVisible();

  // Once Max approves Glinda, they follow each other, so Max shows as Friends
  // in both Followers and Following.
  await db
    .from("follows")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("follower_id", glinda.id)
    .eq("followee_id", max.id);
  await page.reload();
  // The gift profile's "Who sees" menus say Friends too, so look only here.
  for (const section of ["#followers", "#following"]) {
    await expect(page.locator(section).getByText("Friends", { exact: true })).toHaveCount(1);
  }
});

test("someone fills in their gift profile on the Account page", async ({ page }) => {
  const maya = await createAccount("Maya Profile");
  await signInAs(page, maya);
  await page.goto("/dashboard/account");

  const form = page.locator("#gift-profile");
  await chooseOption(form, "Birthday: month", "February");
  await chooseOption(form, "Birthday: day", "29");
  await form.getByLabel("Tops").fill("L");
  const likes = form.getByRole("textbox", { name: "Likes" });
  await likes.fill("Puzzles");
  await likes.press("Enter");
  await likes.fill("Tea, hiking,");
  await chooseOption(form, /Who sees your birthday/, "Everyone");
  await chooseOption(form, /Who sees your sizes/, "Only me");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved")).toBeVisible();

  await expect
    .poll(async () => {
      const { data } = await db.from("profiles").select("gift_profile").eq("id", maya.id).single();
      return data?.gift_profile;
    })
    .toEqual({
      birthday: { month: 2, day: 29 },
      sizes: { tops: "L" },
      likes: ["Puzzles", "Tea", "hiking"],
      audience: { birthday: "everyone", sizes: "private", likes: "friends" },
    });

  // Birthday emails are on until she turns them off, which saves at once.
  const emails = page.getByRole("checkbox", { name: /Email me before birthdays/ });
  await expect(emails).toBeChecked();
  await emails.click({ force: true });
  await expect
    .poll(async () => {
      const { data } = await db.from("profiles").select("email_birthday_reminders").eq("id", maya.id).single();
      return data?.email_birthday_reminders;
    })
    .toBe(false);
});

test("someone writes a public note on the Account page, and anyone sees it on their profile", async ({ page, browser }) => {
  const maya = await createAccount("Maya Note");
  await signInAs(page, maya);
  await page.goto("/dashboard/account");

  const card = page.locator("#profile");
  await waitForReact(card.locator("form"));
  await card.getByRole("textbox", { name: "Public note" }).fill("Saving up for a kiln.\nNo candles, please!");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText("Saved")).toBeVisible();

  const { data: profile } = await db.from("profiles").select("public_id, full_name, public_note").eq("id", maya.id).single();
  expect(profile?.public_note).toBe("Saving up for a kiln.\nNo candles, please!");

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(profilePath(profile!));
  await expect(visitorPage.getByText("Saving up for a kiln.")).toBeVisible();
  await visitor.close();
});

test("a list kept for a child has its own gift profile, and followers see the child's birthday", async ({ browser }) => {
  const dorothy = await createAccount("Dorothy Parent");
  const henry = await createAccount("Henry Uncle");
  const { registry } = await createWishlist(dorothy.id, { settings: { for_child: true } });
  await db.from("registries").update({ listed_on_profile: true, honoree_names: "Toto" }).eq("id", registry.id);
  await follow(henry.id, dorothy.id, "approved");

  // Dorothy fills in Toto's profile on the list's settings page.
  const dorothyContext = await browser.newContext();
  const page = await dorothyContext.newPage();
  await signInAs(page, dorothy);
  await page.goto(`/dashboard/registry/${registry.id}/settings`);
  const form = page.locator("#gift-profile");
  await expect(form.getByText("About Toto")).toBeVisible();
  await waitForReact(form);
  const birthday = birthdayIn(3);
  await chooseOption(form, "Toto's birthday: month", MONTH_OPTIONS[birthday.month - 1].label);
  await chooseOption(form, "Toto's birthday: day", String(birthday.day));
  await form.getByLabel("Shoes").fill("Toddler 9");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByText("Saved")).toBeVisible();
  await dorothyContext.close();

  // The rest of the list's settings stay as they were.
  await expect
    .poll(async () => {
      const { data } = await db.from("registries").select("settings").eq("id", registry.id).single();
      return data?.settings;
    })
    .toMatchObject({ for_child: true, shipping_address: expect.any(String), gift_profile: { birthday, sizes: { shoes: "Toddler 9" } } });

  // Anyone with the link sees Toto's sizes, not the birthday.
  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/r/${registry.slug}`);
  await expect(visitorPage.getByRole("heading", { name: "About Toto" })).toBeVisible();
  await expect(visitorPage.getByText("Shoes: Toddler 9")).toBeVisible();
  await expect(visitorPage.getByText(formatBirthday(birthday), { exact: true })).toHaveCount(0);
  await visitor.close();

  // Henry follows Dorothy, so Toto's birthday is on his Following page.
  const henryContext = await browser.newContext();
  const henryPage = await henryContext.newPage();
  await signInAs(henryPage, henry);
  await henryPage.goto("/dashboard/following");
  const coming = henryPage.getByRole("region", { name: "Birthdays coming up" });
  await expect(coming.getByText("Toto")).toBeVisible();
  await expect(coming.getByText("Dorothy Parent's list")).toBeVisible();
  await henryContext.close();
});
