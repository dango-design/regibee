-- ============================================================================
-- Who sees a list on its owner's profile
-- ============================================================================
-- Until now a list on a profile (listed_on_profile) showed to everyone when
-- the list was public, and to approved followers when it was link-only. The
-- owner couldn't choose.
--
-- profile_audience lets the owner choose, for a list that is on their profile:
--   'friends'    people the owner follows who also follow the owner, both
--                follows approved
--   'followers'  followers the owner approved
--   'everyone'   anyone who opens the profile. Only a public list can use it.
--                The app treats it as 'followers' on a link-only list, so a
--                profile never hands out a link-only list's link.
--   null         what it was before: everyone for a public list, followers
--                for a link-only one. Every existing list starts here, so
--                nothing changes for them.
--
-- listed_on_profile still says whether the list is on the profile at all.
-- The rules are in src/lib/list-access.ts (profileAudience).
--
-- This only decides who sees the list on the profile. Anyone with a link-only
-- or public list's link can still open it.
--
-- Run it BEFORE deploying the code. The settings pages read the new column,
-- so they fail until it exists. Running it first is safe: the deployed code
-- ignores the column, and null means what that code already does.

begin;

alter table public.registries
  add column profile_audience text
    constraint registries_profile_audience_check
      check (profile_audience in ('friends', 'followers', 'everyone'));

-- A list appears under its owner's name, so only the owner chooses who sees
-- it there. This adds the profile_audience rule to the function from
-- 011_public_profiles.sql. The rest is unchanged.
create or replace function public.guard_registry_owner_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  -- No caller means the service role, which server actions use after making
  -- their own checks. Other sessionless requests can't reach this row, because
  -- the update policy needs a signed-in manager.
  if caller is null then
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Registry ownership cannot be changed'
      using errcode = '42501';
  end if;

  if new.listed_on_profile and not old.listed_on_profile and caller <> old.owner_id then
    raise exception 'Only the registry owner can show it on their profile'
      using errcode = '42501';
  end if;

  if new.profile_audience is distinct from old.profile_audience and caller <> old.owner_id then
    raise exception 'Only the registry owner can choose who sees it on their profile'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

commit;
