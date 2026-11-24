-- ============================================================================
-- A public note on profiles
-- ============================================================================
-- profiles.public_note: a few lines someone writes about themselves, shown
-- under their name on their profile page to anyone who opens it.
--
-- It's separate from profiles.gift_profile (sizes, likes and the rest), which
-- from this change shows only to the person and to people they follow who
-- follow them back. The note is the one part of a profile, besides the name
-- and photo, that everyone with the link sees. src/lib/gift-profile.ts cleans
-- it and holds the length limit, which the check below matches.
--
-- Signed-in sessions can't update this column: 011_public_profiles.sql took
-- away update on profiles and gave back only full_name. The app writes it
-- with the service-role client, after checking who's asking and refusing
-- guest sessions (saveProfile in src/lib/actions/profile.ts).
--
-- It only adds a column, so the code that's deployed now keeps working. Run
-- it BEFORE deploying the code that reads the column.

alter table public.profiles
  add column public_note text
    constraint profiles_public_note_length check (char_length(public_note) <= 500);
