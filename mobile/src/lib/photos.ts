// Taking or picking a photo on the phone and uploading it, for an item's
// picture, a list's photo, an invitation or a profile. It works the same way as the website's upload
// (src/lib/upload-registry-photo.ts): shrunk to 1200px on the longer side,
// saved as a JPEG, and uploaded as the signed-in user to the list's folder in
// the registry-photos bucket, which only the list's managers can write to.

import * as Device from "expo-device";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Platform } from "react-native";

import { EVENT_IMAGES_BUCKET } from "@shared/event-images";
import { PROFILE_PHOTOS_BUCKET } from "@shared/profile-photos";
import { REGISTRY_PHOTOS_BUCKET } from "@shared/registry-photos";

import { ApiError } from "@/lib/api";
import { isDemo } from "@/lib/demo";
import { supabase } from "@/lib/supabase";

const MAX_SIDE = 1200;

type Source = "camera" | "library";

/** Asks whether to take a photo or choose one. Null when the person cancels. */
function askSource(): Promise<Source | null> {
  // Three buttons at most: Android's alert drops the rest.
  return new Promise((resolve) => {
    Alert.alert(
      "Add a photo",
      undefined,
      [
        { text: "Take photo", onPress: () => resolve("camera") },
        { text: "Choose from library", onPress: () => resolve("library") },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ],
      // Android closes the alert on a tap outside it.
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}

async function takePhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  // The iPhone simulator has no camera, and opening it there crashes the app.
  // The Android emulator has a pretend one, so it can open.
  if (Platform.OS === "ios" && !Device.isDevice) {
    Alert.alert("No camera", "This device has no camera. Choose a photo from the library instead.");
    return null;
  }
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    // Once someone says no, the system won't ask again. Only Settings can change it.
    Alert.alert(
      "Regibee can't use the camera",
      "To take a photo, allow Regibee to use the camera in Settings.",
      permission.canAskAgain
        ? [{ text: "OK" }]
        : [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ]
    );
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  return result.canceled ? null : (result.assets?.[0] ?? null);
}

/**
 * Asks whether to take a photo or choose one from the library, then opens the
 * camera or the photo picker. Null when the person cancels.
 */
export async function pickPhoto(): Promise<ImagePicker.ImagePickerAsset | null> {
  const source = await askSource();
  if (source === "camera") return takePhoto();
  if (source !== "library") return null;
  // The system photo picker needs no permission to choose a photo.
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  return result.canceled ? null : (result.assets?.[0] ?? null);
}

async function shrink(asset: ImagePicker.ImagePickerAsset, maxSide = MAX_SIDE): Promise<string> {
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  // Only shrink: a smaller photo stays its own size.
  const longest = Math.max(asset.width, asset.height);
  if (longest > maxSide) {
    context.resize(asset.width >= asset.height ? { width: maxSide } : { height: maxSide });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 });
  return saved.uri;
}

/** A name nobody else's upload will have. It doesn't need to be secret: the bucket is public. */
function fileName() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}.jpg`;
}

async function upload(bucket: string, folder: string, uri: string, limitMessage: string, failMessage: string) {
  const body = await (await fetch(uri)).arrayBuffer();
  const path = `${folder}/${fileName()}`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) {
    // The same messages as the website's uploads.
    const { data: allowed } = await supabase.rpc("can_upload_photo");
    throw new ApiError(allowed === false ? limitMessage : failMessage);
  }
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Uploads an invitation picture to an event's folder, as the website does
 * (src/lib/upload-event-image.ts): 1600px on the longer side, since
 * invitations are read up close. Only the event's hosts can upload there.
 */
export async function uploadEventImage(eventId: string, asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const uri = await shrink(asset, 1600);
  if (isDemo()) return uri;
  return upload(EVENT_IMAGES_BUCKET, eventId, uri, "You've uploaded as many pictures as an account can.", "The picture didn't upload. Try again.");
}

/**
 * Uploads a picked photo to a list's folder and returns its public URL. In the
 * demo nothing is uploaded, and the photo stays on the phone.
 */
export async function uploadListPhoto(registryId: string, asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const uri = await shrink(asset);
  if (isDemo()) return uri;

  return upload(
    REGISTRY_PHOTOS_BUCKET,
    registryId,
    uri,
    "You've uploaded as many photos as an account can. Paste a link to an image instead.",
    "The photo didn't upload. Try again, or paste a link to an image."
  );
}

// The website's limits for a profile photo (src/lib/upload-profile-photo.ts):
// a 320px square, and the bucket refuses anything over 256 KB.
const PROFILE_PHOTO_SIDE = 320;
const PROFILE_PHOTO_MAX_BYTES = 256 * 1024;

/**
 * Uploads a profile photo to the account's folder and returns its public URL,
 * as the website does (src/lib/upload-profile-photo.ts): cropped to the square
 * in its middle, since it shows in a circle, shrunk to 320px and saved as a
 * JPEG. The folder is named for the profile's public id, and an account can
 * only upload to its own. Saving the photo on the profile is the
 * profile.setProfilePhoto action's job.
 */
export async function uploadProfilePhoto(publicId: string, asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (isDemo()) throw new ApiError("Make an account to add a profile photo.");
  const side = Math.min(asset.width, asset.height);
  if (!side) throw new ApiError("That photo's format isn't supported. Choose a JPEG, PNG or WebP image.");

  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  context.crop({
    originX: Math.floor((asset.width - side) / 2),
    originY: Math.floor((asset.height - side) / 2),
    width: side,
    height: side,
  });
  // Only shrink: a smaller photo stays its own size.
  if (side > PROFILE_PHOTO_SIDE) context.resize({ width: PROFILE_PHOTO_SIDE, height: PROFILE_PHOTO_SIDE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 });

  const body = await (await fetch(saved.uri)).arrayBuffer();
  if (body.byteLength > PROFILE_PHOTO_MAX_BYTES) throw new ApiError("That photo is too big to upload. Try a different one.");

  const path = `${publicId}/${fileName()}`;
  const { error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(path, body, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new ApiError("The photo didn't upload. Try again.");
  return supabase.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}
