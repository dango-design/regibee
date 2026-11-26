-- ============================================================================
-- Closing the "Start your wishlist" prompt
-- ============================================================================
-- The Saved tab, on the website and in the phone app, asks people to start one
-- main wishlist until they have one. Someone who keeps a birthday wishlist or a
-- Christmas list instead can now close the prompt. This records when they did,
-- so it stays closed on every device.
--
-- Only the server reads and writes it, with the service-role client
-- (dismissWishlistPrompt in src/lib/actions/saved.ts, loadSavedItems in
-- src/lib/saved-items.ts). Signed-in sessions can update only the profile
-- columns granted to them by name (011_public_profiles.sql), so not this one.
--
-- Run it BEFORE merging the PR. Running it first is safe: the deployed code
-- doesn't read the column, and every account starts with null, which shows the
-- prompt as before.

alter table public.profiles
  add column if not exists wishlist_prompt_dismissed_at timestamptz;
