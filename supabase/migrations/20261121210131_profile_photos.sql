-- ============================================================================
-- Profile photos
-- ============================================================================
-- An account can add a photo to its profile. It shows on the profile page,
-- which anyone with the profile's link can open, and in the account menu.
--
-- Files go in a public bucket, in a folder named for the profile's public id
-- (the random code in its /u/ link, which never changes):
--   profile-photos/<public id>/<random id>.jpg
-- The public id is already in the profile's link, so the folder gives nothing
-- away. The random file names keep photos from being guessed.
--
-- Photos show at most 80px wide, so they're kept small. The browser crops each
-- one to a square and shrinks it to 320px before upload
-- (src/lib/upload-profile-photo.ts), which makes most 15 to 40 KB. The bucket
-- refuses anything that isn't a JPEG or is over 256 KB, so a big photo can't
-- be stored by going around the site.
--
-- The setProfilePhoto server action (src/lib/actions/profile.ts) saves the
-- photo's URL in profiles.avatar_url and deletes every other file in the
-- account's folder, so each account keeps one photo. A folder can hold at
-- most 5 files at once, which caps uploads that never get saved.
--
-- Run this BEFORE merging the code that uploads profile photos. Apart from
-- taking away direct updates of profiles.avatar_url, which nothing uses, it
-- only adds.
--
-- Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  262144, -- 256 KB
  array['image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Whether the signed-in account can upload a profile photo to this folder:
-- it's a real account, not a guest's anonymous session, the folder is its own
-- profile's public id, and it has fewer than 5 files there. It only tells the
-- caller about themselves.
create or replace function public.can_upload_profile_photo(folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
     and exists (
       select 1
         from public.profiles
        where id = (select auth.uid())
          and public_id = folder
     )
     and (
       select count(*)
         from storage.objects
        where bucket_id = 'profile-photos'
          and owner_id = (select auth.uid())::text
     ) < 5;
$$;

revoke execute on function public.can_upload_profile_photo(text) from public, anon;
grant execute on function public.can_upload_profile_photo(text) to authenticated;

-- Uploads go straight into the account's own folder, one level deep. There's
-- no update or delete rule: the site never overwrites a file, and the server
-- action deletes old ones with the service role.
drop policy if exists "Accounts can upload their profile photo" on storage.objects;
create policy "Accounts can upload their profile photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and array_length(storage.foldername(name), 1) = 1
    and public.can_upload_profile_photo((storage.foldername(name))[1])
  );

-- 011_public_profiles.sql let signed-in sessions set avatar_url to any
-- address. Nothing used that. Now setProfilePhoto sets it, through the service
-- role, after checking the photo is in the account's own folder.
revoke update (avatar_url) on public.profiles from authenticated;
