// Picking a photo on the phone and uploading it, for an item's picture or a
// list's photo. It works the same way as the website's upload
// (src/lib/upload-registry-photo.ts): shrunk to 1200px on the longer side,
// saved as a JPEG, and uploaded as the signed-in user to the list's folder in
// the registry-photos bucket, which only the list's managers can write to.

import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { REGISTRY_PHOTOS_BUCKET } from "@shared/registry-photos";

import { ApiError } from "@/lib/api";
import { isDemo } from "@/lib/demo";
import { supabase } from "@/lib/supabase";

const MAX_SIDE = 1200;

/** Opens the photo library. Null when the person cancels. */
export async function pickPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  // The system photo picker needs no permission to choose a photo.
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  return result.canceled ? null : (result.assets?.[0] ?? null);
}

async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  // Only shrink: a smaller photo stays its own size.
  const longest = Math.max(asset.width, asset.height);
  if (longest > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}

/** A name nobody else's upload will have. It doesn't need to be secret: the bucket is public. */
function fileName() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}.jpg`;
}

/**
 * Uploads a picked photo to a list's folder and returns its public URL. In the
 * demo nothing is uploaded, and the photo stays on the phone.
 */
export async function uploadListPhoto(registryId: string, asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const uri = await shrink(asset);
  if (isDemo()) return uri;

  const body = await (await fetch(uri)).arrayBuffer();
  const path = `${registryId}/${fileName()}`;
  const { error } = await supabase.storage
    .from(REGISTRY_PHOTOS_BUCKET)
    .upload(path, body, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) {
    // The same messages as the website's upload.
    const { data: allowed } = await supabase.rpc("can_upload_photo");
    if (allowed === false) {
      throw new ApiError("You've uploaded as many photos as an account can. Paste a link to an image instead.");
    }
    throw new ApiError("The photo didn't upload. Try again, or paste a link to an image.");
  }
  return supabase.storage.from(REGISTRY_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}
