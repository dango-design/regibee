// Profile photos live in a public Supabase Storage bucket, in a folder named
// for the profile's public id. 20261121210131_profile_photos.sql makes the
// bucket and lets each account upload to its own folder. profiles.avatar_url
// holds the photo's URL.
//
// No imports, so the unit tests can load it.

export const PROFILE_PHOTOS_BUCKET = "profile-photos";

/** The start of every public URL for a profile's photos. */
export function profilePhotoUrlPrefix(publicId: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${PROFILE_PHOTOS_BUCKET}/${publicId}/`;
}

/**
 * A profile's photo, or null when it has none. avatar_url counts only when
 * it's a photo in the profile's own folder. Sign-up copies whatever
 * avatar_url the sign-up request sends (handle_new_user), and that mustn't put
 * an image from anywhere on the web, or someone else's photo, on a profile.
 */
export function profilePhotoUrl(profile: { public_id: string; avatar_url?: string | null }): string | null {
  const url = profile.avatar_url;
  if (typeof url !== "string" || !profile.public_id) return null;
  const prefix = profilePhotoUrlPrefix(profile.public_id);
  if (!url.startsWith(prefix)) return null;
  // Just a file name: no more folders, and no query.
  return /^[A-Za-z0-9-]+\.jpg$/.test(url.slice(prefix.length)) ? url : null;
}

/** The photo's file name in the profile's folder, when profilePhotoUrl accepts it. */
export function profilePhotoFileName(profile: { public_id: string; avatar_url?: string | null }): string | null {
  const url = profilePhotoUrl(profile);
  return url ? url.slice(profilePhotoUrlPrefix(profile.public_id).length) : null;
}

/**
 * The sizes to draw a photo at on the way down to `target` pixels, from a
 * square `side` pixels wide. Each step at most halves it, after a first step
 * of at most 2048px: drawing a big photo much smaller in one go leaves jagged
 * edges in some browsers, and phones refuse very large canvases. A photo
 * already smaller than the target keeps its size.
 */
export function shrinkSteps(side: number, target: number): number[] {
  const goal = Math.max(1, Math.min(side, target));
  const steps: number[] = [];
  let size = side;
  do {
    size = Math.max(goal, Math.min(Math.round(size / 2), 2048));
    steps.push(size);
  } while (size > goal);
  return steps;
}
