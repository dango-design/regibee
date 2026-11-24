"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAccount } from "@/lib/require-account";
import { PROFILE_PHOTOS_BUCKET, profilePhotoFileName } from "@/lib/profile-photos";

const MAX_NAME_LENGTH = 80;

function revalidateProfilePages() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/account");
  revalidatePath("/u/[profile]", "page");
}

export async function saveProfile(formData: FormData) {
  const { user, error: authError } = await requireAccount();
  if (!user) return { error: authError };

  const fullName = ((formData.get("fullName") as string) || "").trim();

  if (!fullName) {
    return { error: "Add the name you'd like people to see." };
  }
  if (fullName.length > MAX_NAME_LENGTH) {
    return { error: `Names can be up to ${MAX_NAME_LENGTH} characters.` };
  }

  const update: Record<string, string | boolean> = { full_name: fullName };
  if (formData.has("discoverable")) {
    update.discoverable = formData.get("discoverable") === "true";
  }
  if (formData.has("findableByEmail")) {
    update.findable_by_email = formData.get("findableByEmail") === "true";
  }
  if (formData.has("emailFollowRequests")) {
    update.email_follow_requests = formData.get("emailFollowRequests") === "true";
  }

  // Signed-in sessions can't write these columns directly (see
  // 011_public_profiles.sql), so this goes through the service role.
  const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", user.id);
  if (error) return { error: error.message };

  revalidateProfilePages();
  return { success: true };
}

/**
 * Sets or clears the account's profile photo. The browser uploads the file
 * first (uploadProfilePhoto) and passes its URL here, or null to remove the
 * photo. Every other file in the account's folder is deleted, so a replaced
 * photo, or an upload that was never saved, doesn't stay in storage.
 */
export async function setProfilePhoto(photoUrl: string | null) {
  const { user, error: authError } = await requireAccount();
  if (!user) return { error: authError };
  if (photoUrl !== null && typeof photoUrl !== "string") {
    return { error: "That photo wasn't uploaded to your profile. Upload it again." };
  }

  const { data: profile, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("public_id")
    .eq("id", user.id)
    .single();
  if (readError || !profile?.public_id) return { error: "Your profile didn't load. Try again." };
  const folder = profile.public_id as string;

  const storage = supabaseAdmin.storage.from(PROFILE_PHOTOS_BUCKET);
  const { data: files, error: listError } = await storage.list(folder, { limit: 100 });
  if (listError) return { error: "The photo didn't save. Try again." };
  // Folders have no id. The upload rule keeps them out, but skip any anyway.
  const names = (files ?? []).filter((file) => file.id).map((file) => file.name);

  // Only a photo in this account's folder, so a profile can't show any image
  // on the web, and only one that's really there.
  let keep: string | null = null;
  if (photoUrl !== null) {
    keep = profilePhotoFileName({ public_id: folder, avatar_url: photoUrl });
    if (!keep || !names.includes(keep)) {
      return { error: "That photo wasn't uploaded to your profile. Upload it again." };
    }
  }

  // Signed-in sessions can't write avatar_url directly
  // (20261121210131_profile_photos.sql), so this goes through the service role.
  const { error } = await supabaseAdmin.from("profiles").update({ avatar_url: photoUrl }).eq("id", user.id);
  if (error) return { error: error.message };

  const old = names.filter((name) => name !== keep).map((name) => `${folder}/${name}`);
  if (old.length > 0) {
    // The photo is saved either way. A file left behind goes next time.
    const { error: removeError } = await storage.remove(old);
    if (removeError) console.error(`Removing old profile photos: ${removeError.message}`);
  }

  revalidateProfilePages();
  return { success: true };
}

export async function setRegistryListed(registryId: string, listed: boolean) {
  const { user, supabase, error: authError } = await requireAccount();
  if (!user) return { error: authError };

  // Private lists can't be on a profile. The database refuses it too.
  let update = supabase.from("registries").update({ listed_on_profile: listed }).eq("id", registryId).eq("owner_id", user.id);
  if (listed) update = update.eq("is_private", false);
  const { data, error } = await update.select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Only lists you own, and that aren't private, can be shown on your profile." };
  }

  revalidateProfilePages();
  revalidatePath(`/dashboard/registry/${registryId}`);
  return { success: true };
}
