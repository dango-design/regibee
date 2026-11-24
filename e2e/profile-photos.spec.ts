// Profile photos: adding one on the Account page, where it shows, how small
// it's stored, and that replaced and removed photos are deleted
// (src/lib/upload-profile-photo.ts and setProfilePhoto in
// src/lib/actions/profile.ts).

import { expect, test, type Page } from "@playwright/test";
import { createAccount, db, signIn, waitForReact } from "./fixtures";

const BUCKET = "profile-photos";

/** A photo like a phone's: a noisy JPEG, `width` by `height`, made in the browser. */
async function makePhoto(page: Page, width: number, height: number, type = "image/jpeg") {
  const base64 = await page.evaluate(
    async ({ width, height, type }) => {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d")!;
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#f6c445");
      gradient.addColorStop(1, "#3b82f6");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      // Noise, so the file is big like a real photo.
      const image = context.getImageData(0, 0, width, height);
      for (let i = 0; i < image.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 80;
        image.data[i] += n;
        image.data[i + 1] += n;
        image.data[i + 2] += n;
      }
      context.putImageData(image, 0, 0);
      const blob = await canvas.convertToBlob({ type, quality: 0.95 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    },
    { width, height, type },
  );
  return Buffer.from(base64, "base64");
}

/** The Account page's photo picker, once React has taken it over. */
async function photoPicker(page: Page) {
  const input = page.locator('#profile input[type="file"]');
  await waitForReact(input);
  return input;
}

/** The files in the account's photo folder. */
async function storedPhotos(publicId: string) {
  const { data, error } = await db.storage.from(BUCKET).list(publicId);
  if (error) throw error;
  return (data ?? []).filter((file) => file.id);
}

/** The width, height and size in bytes of the image at `url`. */
async function imageFacts(page: Page, url: string) {
  return page.evaluate(async (url) => {
    const blob = await (await fetch(url)).blob();
    const bitmap = await createImageBitmap(blob);
    return { width: bitmap.width, height: bitmap.height, bytes: blob.size, type: blob.type };
  }, url);
}

test("adding, changing and removing a profile photo", async ({ page }) => {
  const account = await createAccount("Remi Photo");
  const { data: profile } = await db.from("profiles").select("public_id").eq("id", account.id).single();
  const publicId = profile!.public_id as string;

  await signIn(page, account);
  await page.goto("/dashboard/account");
  const card = page.locator("#profile");
  await expect(card.getByText("RP", { exact: true })).toBeVisible();

  // A big landscape photo, as a phone takes them.
  const big = await makePhoto(page, 4000, 3000);
  expect(big.length).toBeGreaterThan(1_000_000);
  await (await photoPicker(page)).setInputFiles({ name: "big.jpg", mimeType: "image/jpeg", buffer: big });
  await expect(card.getByRole("button", { name: "Change photo" })).toBeVisible();

  // It's stored as a small square JPEG, and saved on the profile.
  const photo = card.locator("img");
  await expect(photo).toHaveAttribute("src", new RegExp(`/storage/v1/object/public/${BUCKET}/${publicId}/[0-9a-f-]+\\.jpg$`));
  const firstUrl = (await photo.getAttribute("src"))!;
  const facts = await imageFacts(page, firstUrl);
  expect(facts).toMatchObject({ width: 320, height: 320, type: "image/jpeg" });
  expect(facts.bytes).toBeLessThan(80 * 1024);
  const { data: saved } = await db.from("profiles").select("avatar_url").eq("id", account.id).single();
  expect(saved?.avatar_url).toBe(firstUrl);
  expect(await storedPhotos(publicId)).toHaveLength(1);

  // The menu at the top shows it too, and so does the profile page.
  await expect(page.getByRole("button", { name: /Account menu/ }).locator("img")).toHaveAttribute("src", firstUrl);
  await page.goto(`/u/${publicId}`);
  await expect(page.getByRole("heading", { name: "Remi Photo" })).toBeVisible();
  await expect(page.locator("main img").first()).toHaveAttribute("src", firstUrl);

  // A small PNG replaces it. It's cropped to a square, not enlarged, and the
  // old photo is deleted.
  await page.goto("/dashboard/account");
  const small = await makePhoto(page, 200, 120, "image/png");
  await (await photoPicker(page)).setInputFiles({ name: "small.png", mimeType: "image/png", buffer: small });
  await expect(photo).not.toHaveAttribute("src", firstUrl);
  const secondUrl = (await photo.getAttribute("src"))!;
  expect(await imageFacts(page, secondUrl)).toMatchObject({ width: 120, height: 120, type: "image/jpeg" });
  const files = await storedPhotos(publicId);
  expect(files.map((file) => file.name)).toEqual([secondUrl.split("/").pop()]);

  // Removing it goes back to initials and deletes the file.
  await card.getByRole("button", { name: "Remove" }).click();
  await expect(card.getByRole("button", { name: "Upload photo" })).toBeVisible();
  await expect(card.getByText("RP", { exact: true })).toBeVisible();
  await expect.poll(async () => (await storedPhotos(publicId)).length).toBe(0);
  const { data: removed } = await db.from("profiles").select("avatar_url").eq("id", account.id).single();
  expect(removed?.avatar_url).toBeNull();
});

test("a file that isn't a photo is refused", async ({ page }) => {
  const account = await createAccount("Remi Notaphoto");
  await signIn(page, account);
  await page.goto("/dashboard/account");
  const card = page.locator("#profile");
  await (await photoPicker(page)).setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a photo"),
  });
  await expect(card.getByText("That file isn't a photo. Choose a JPEG, PNG or WebP image.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Upload photo" })).toBeVisible();
});

test("deleting an account deletes its profile photo", async ({ page }) => {
  const account = await createAccount("Remi Leaving");
  const { data: profile } = await db.from("profiles").select("public_id").eq("id", account.id).single();
  const publicId = profile!.public_id as string;

  await signIn(page, account);
  await page.goto("/dashboard/account");
  const card = page.locator("#profile");
  const photo = await makePhoto(page, 800, 800);
  await (await photoPicker(page)).setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(card.getByRole("button", { name: "Change photo" })).toBeVisible();
  expect(await storedPhotos(publicId)).toHaveLength(1);

  await page.getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Type “delete” to confirm").fill("delete");
  await dialog.getByRole("button", { name: "Delete account" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  await expect.poll(async () => (await storedPhotos(publicId)).length).toBe(0);
});
