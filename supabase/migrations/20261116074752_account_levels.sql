-- ============================================================================
-- Account levels: basic and star
-- ============================================================================
-- Every account is "basic" unless its email address is in star_emails. Then
-- it is "star". Star is for people we know, like testers. Both levels can do
-- everything. Star only gets higher limits on the two things that cost money
-- or reach people who never signed up:
--
-- 1. Emails to addresses someone typed in: event invitations and reminders,
--    messages to guests, notices that an event changed, gift exchange draws,
--    co-host and list-manager invites, and asking someone to make a list.
--    The website logs each send in email_sends and checks the day's total
--    with reserve_emails. The limits are in src/lib/account-levels.ts.
-- 2. Photo uploads. The upload rules on storage.objects call
--    can_upload_photo, which holds those limits.
--
-- Nobody can buy star, and the site never shows anyone their level.
--
-- star_emails is filled in by hand in the SQL Editor. The repo is public, so
-- never put a tester's address in a migration or any other file here. See
-- "Account levels" in CLAUDE.md.
--
-- The website needs this file before its code that calls reserve_emails is
-- deployed. Without it, every one of those emails is refused.
--
-- Safe to run more than once.

-- ----------------------------------------------------------------------------
-- 1. Star accounts
-- ----------------------------------------------------------------------------

create table if not exists public.star_emails (
  -- Lowercase, so it matches however the address was typed at sign-up.
  email    text primary key check (email = lower(btrim(email)) and email <> ''),
  added_at timestamptz not null default now()
);

-- Server only: no API role can read or change who is a star.
alter table public.star_emails enable row level security;
revoke all on public.star_emails from anon, authenticated;

-- 'star' when the account's confirmed email is in star_emails, else 'basic'.
-- An email change only counts once the new address is confirmed, so nobody
-- can become a star by typing in a tester's address.
create or replace function public.account_level(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
        from auth.users u
        join public.star_emails s on s.email = lower(u.email)
       where u.id = p_user
         and u.email_confirmed_at is not null
    ) then 'star'
    else 'basic'
  end;
$$;

revoke execute on function public.account_level(uuid) from public, anon, authenticated;
grant execute on function public.account_level(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 2. Emails to typed-in addresses
-- ----------------------------------------------------------------------------

-- One row per send: who sent it, their level then, what kind and how many
-- emails. Not who they went to.
create table if not exists public.email_sends (
  id       bigint generated always as identity primary key,
  -- Null once the account is deleted. The row stays, so deleting an account
  -- doesn't free up the day's shared allowance for basic accounts.
  user_id  uuid references public.profiles(id) on delete set null,
  level    text not null check (level in ('basic', 'star')),
  kind     text not null,
  emails   integer not null check (emails > 0),
  sent_at  timestamptz not null default now()
);

create index if not exists idx_email_sends_user on public.email_sends(user_id, sent_at);
create index if not exists idx_email_sends_level on public.email_sends(level, sent_at);

alter table public.email_sends enable row level security;
revoke all on public.email_sends from anon, authenticated;

-- Takes up to p_wanted emails from the account's allowance for the last 24
-- hours, and logs them as one send. Basic accounts also share a site-wide
-- allowance, so many new accounts can't use up the day's sending between
-- them. With p_all_or_nothing, it takes all p_wanted or none.
--
-- Returns the new row's id (null when nothing was taken), how many emails
-- were taken, whether the account is a star, and how many it had left before
-- this send. The website lowers the row afterwards if fewer went out.
create or replace function public.reserve_emails(
  p_user uuid,
  p_kind text,
  p_wanted integer,
  p_all_or_nothing boolean,
  p_basic_daily integer,
  p_star_daily integer,
  p_basic_site_daily integer
)
returns table (reservation bigint, granted integer, star boolean, emails_left integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level text := public.account_level(p_user);
  v_since timestamptz := now() - interval '1 day';
  v_left integer;
  v_granted integer;
  v_id bigint;
begin
  -- One send at a time per account, and one at a time across basic accounts,
  -- so two sends at once can't both take the last of an allowance. The locks
  -- are always taken in this order, so two sends can't wait on each other.
  perform pg_advisory_xact_lock(hashtextextended('email_sends:' || p_user::text, 0));
  if v_level = 'basic' then
    perform pg_advisory_xact_lock(hashtextextended('email_sends:basic', 0));
  end if;

  select (case when v_level = 'star' then p_star_daily else p_basic_daily end) - coalesce(sum(s.emails), 0)
    into v_left
    from public.email_sends s
   where s.user_id = p_user
     and s.sent_at > v_since;

  if v_level = 'basic' then
    v_left := least(v_left, p_basic_site_daily - (
      select coalesce(sum(s.emails), 0)
        from public.email_sends s
       where s.level = 'basic'
         and s.sent_at > v_since
    ));
  end if;
  v_left := greatest(v_left, 0);

  v_granted := greatest(least(p_wanted, v_left), 0);
  if p_all_or_nothing and v_granted < p_wanted then
    v_granted := 0;
  end if;

  if v_granted > 0 then
    insert into public.email_sends (user_id, level, kind, emails)
    values (p_user, v_level, p_kind, v_granted)
    returning id into v_id;
  end if;

  return query select v_id, v_granted, v_level = 'star', v_left;
end;
$$;

revoke execute on function public.reserve_emails(uuid, text, integer, boolean, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_emails(uuid, text, integer, boolean, integer, integer, integer)
  to service_role;

-- ----------------------------------------------------------------------------
-- 3. Photo uploads
-- ----------------------------------------------------------------------------

-- Whether the signed-in account can upload another photo: fewer than 50 in
-- the photo buckets for basic, fewer than 500 for star. The site shrinks
-- photos to about 300 KB, but the buckets take up to 5 MB, so 50 is at most
-- 250 MB per basic account. The site never deletes a replaced photo, so
-- replacing one still counts.
--
-- The upload rules below call it, and the site calls it after a refused
-- upload to say why. It only tells the caller about themselves.
create or replace function public.can_upload_photo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < case public.account_level((select auth.uid())) when 'star' then 500 else 50 end
    from storage.objects
   where owner_id = (select auth.uid())::text
     and bucket_id in ('registry-photos', 'event-images');
$$;

revoke execute on function public.can_upload_photo() from public, anon;
grant execute on function public.can_upload_photo() to authenticated;

-- The same rules as 014_registry_photos.sql and 015_events.sql, with the
-- limit added.
drop policy if exists "Managers can upload registry photos" on storage.objects;
create policy "Managers can upload registry photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'registry-photos'
    and public.is_registry_manager(
      -- The first folder is the registry id. The case turns anything that
      -- isn't a uuid into null, which no registry matches, instead of a cast
      -- error.
      case
        when (storage.foldername(name))[1]
          ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ((storage.foldername(name))[1])::uuid
      end,
      (select auth.uid())
    )
    and public.can_upload_photo()
  );

drop policy if exists "Event managers can upload event images" on storage.objects;
create policy "Event managers can upload event images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-images'
    and public.can_manage_event(
      -- The first folder is the event id. The case turns anything that isn't
      -- a uuid into null, which no event matches, instead of a cast error.
      case
        when (storage.foldername(name))[1]
          ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then ((storage.foldername(name))[1])::uuid
      end
    )
    and public.can_upload_photo()
  );
