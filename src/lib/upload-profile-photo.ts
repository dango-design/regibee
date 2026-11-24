import { PROFILE_PHOTOS_BUCKET, shrinkSteps } from "@/lib/profile-photos";
import type { PhotoUploadResult } from "@/lib/upload-registry-photo";

// A profile photo shows at most 80px wide, on the profile page. A 320px square
// stays sharp there on screens with 3 pixels to the point, and as a JPEG it's
// usually 15 to 40 KB. Phone photos are often 5 MB or more.
export const PROFILE_PHOTO_SIDE = 320;
const QUALITY = 0.85;

// The bucket refuses anything bigger (20261121210131_profile_photos.sql).
const MAX_BYTES = 256 * 1024;

/**
 * Crops a photo to the square in its middle, since it shows in a circle, and
 * shrinks it to 320px as a JPEG. Null when the browser can't read the photo.
 */
export async function squareProfilePhoto(file: Blob, side = PROFILE_PHOTO_SIDE): Promise<Blob | null> {
  // Turned the way the camera held it, from the photo's orientation tag.
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;

  const crop = Math.min(bitmap.width, bitmap.height);
  let source: CanvasImageSource = bitmap;
  let sourceX = (bitmap.width - crop) / 2;
  let sourceY = (bitmap.height - crop) / 2;
  let sourceSide = crop;
  let canvas: HTMLCanvasElement | null = null;

  for (const size of shrinkSteps(crop, side)) {
    const next = document.createElement("canvas");
    next.width = size;
    next.height = size;
    const context = next.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    // JPEG has no transparency, so see-through PNGs get a white background
    // instead of black.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, sourceX, sourceY, sourceSide, sourceSide, 0, 0, size, size);
    canvas = next;
    source = next;
    sourceX = 0;
    sourceY = 0;
    sourceSide = size;
  }
  bitmap.close();
  if (!canvas) return null;

  const done = canvas;
  return new Promise((resolve) => done.toBlob((blob) => resolve(blob), "image/jpeg", QUALITY));
}

/**
 * Uploads a profile photo to the account's folder and returns its public URL.
 * Runs in the browser as the signed-in user, so it can only go in their own
 * folder (see the bucket's rule in 20261121210131_profile_photos.sql). Saving
 * it on the profile is setProfilePhoto's job.
 */
export async function uploadProfilePhoto(publicId: string, file: File): Promise<PhotoUploadResult> {
  if (!file.type.startsWith("image/")) {
    return { error: "That file isn't a photo. Choose a JPEG, PNG or WebP image." };
  }
  const photo = await squareProfilePhoto(file);
  if (!photo || photo.type !== "image/jpeg") {
    return { error: "That photo's format isn't supported. Choose a JPEG, PNG or WebP image." };
  }
  if (photo.size > MAX_BYTES) {
    return { error: "That photo is too big to upload. Try a different one." };
  }

  // Loaded here rather than imported at the top, so the Account page doesn't
  // download the Supabase client until someone uploads.
  const { createClient } = await import("@/utils/supabase/client");
  const supabase = createClient();
  const path = `${publicId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(path, photo, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) {
    return { error: "The photo didn't upload. Try again." };
  }
  const { data } = supabase.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
