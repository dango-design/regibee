-- ============================================================================
-- Support view
-- ============================================================================
-- Lets Regibee's support team open any account and any list on the website,
-- at /support, to help when someone has a problem. See "Support view" in
-- CLAUDE.md.
--
-- An account is on the support team when its confirmed email address is in
-- support_emails. That table is filled in by hand in the SQL Editor. The repo
-- is public, so never put an address in a migration or any other file here.
--
-- Everything here is for the website's server only. No API role can read
-- these tables or run these functions, so the support team's own sessions
-- can't read anything more from the browser, the phone app or the extension
-- than anyone else's can. The website checks is_support, then reads with the
-- service-role key.
--
-- Run this before merging the PR that adds /support. Without it, /support
-- shows the not-found page to everyone, which is safe.
--
-- Safe to run more than once.

-- ----------------------------------------------------------------------------
-- 1. Who is on the support team
-- ----------------------------------------------------------------------------

create table if not exists public.support_emails (
  -- Lowercase, so it matches however the address was typed at sign-up.
  email    text primary key check (email = lower(btrim(email)) and email <> ''),
  added_at timestamptz not null default now()
);

alter table public.support_emails enable row level security;
revoke all on public.support_emails from anon, authenticated;

-- True when the account's confirmed email is in support_emails. An email
-- change only counts once the new address is confirmed, so nobody can get in
-- by typing a support address at sign-up. Same rule as account_level.
create or replace function public.is_support(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from auth.users u
      join public.support_emails s on s.email = lower(u.email)
     where u.id = p_user
       and u.email_confirmed_at is not null
       and not u.is_anonymous
  );
$$;

revoke execute on function public.is_support(uuid) from public, anon, authenticated;
grant execute on function public.is_support(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 2. A record of what the support team opened
-- ----------------------------------------------------------------------------
-- One row each time someone on the support team opens an account or a list,
-- or shows the gifts a list's owner hid from themselves. Only people with
-- access to the Supabase project can read it, in the SQL Editor:
--
--   select v.viewed_at, u.email as support, v.what
--     from public.support_views v
--     left join auth.users u on u.id = v.support_user_id
--    where v.registry_id = '<list id>'
--    order by v.viewed_at desc;

create table if not exists public.support_views (
  id              bigint generated always as identity primary key,
  -- Null once that support account is deleted. The row stays.
  support_user_id uuid references public.profiles(id) on delete set null,
  -- 'account': an account's page. 'list': a list's page. 'hidden_gifts': the
  -- list's page with the gifts its owner hid from themselves.
  what            text not null check (what in ('account', 'list', 'hidden_gifts')),
  -- The account looked at, or the list's owner. The row goes when that
  -- account is deleted, with the rest of its data.
  account_id      uuid not null references public.profiles(id) on delete cascade,
  -- The list looked at. Null for an account's page, and once the list is
  -- deleted.
  registry_id     uuid references public.registries(id) on delete set null,
  viewed_at       timestamptz not null default now()
);

create index if not exists idx_support_views_account on public.support_views(account_id, viewed_at);
create index if not exists idx_support_views_registry on public.support_views(registry_id, viewed_at);
create index if not exists idx_support_views_support_user on public.support_views(support_user_id);

alter table public.support_views enable row level security;
revoke all on public.support_views from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Search
-- ----------------------------------------------------------------------------
-- Both match part of what was typed, ignoring case. strpos, not LIKE, so a
-- % or _ in the search is matched as itself.

-- Accounts whose email address or name contains the search. Includes
-- accounts that haven't confirmed their email yet, since that's often the
-- problem. Leaves out guests' anonymous sessions.
create or replace function public.support_find_accounts(p_query text)
returns table (
  id                 uuid,
  email              text,
  full_name          text,
  email_confirmed_at timestamptz,
  created_at         timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, p.full_name, u.email_confirmed_at, u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
   where not u.is_anonymous
     and char_length(btrim(p_query)) >= 2
     and (
       strpos(lower(coalesce(u.email, '')), lower(btrim(p_query))) > 0
       or strpos(lower(coalesce(p.full_name, '')), lower(btrim(p_query))) > 0
     )
   order by u.created_at desc
   limit 25;
$$;

revoke execute on function public.support_find_accounts(text) from public, anon, authenticated;
grant execute on function public.support_find_accounts(text) to service_role;

-- Lists whose title contains the search, or whose link is the search: its
-- current slug or one it had before (registry_old_links).
create or replace function public.support_find_lists(p_query text)
returns table (
  id         uuid,
  title      text,
  slug       text,
  owner_id   uuid,
  owner_name text,
  is_private boolean,
  is_public  boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.title, r.slug, r.owner_id, p.full_name, r.is_private, r.is_public, r.created_at
    from public.registries r
    left join public.profiles p on p.id = r.owner_id
   where char_length(btrim(p_query)) >= 2
     and (
       strpos(lower(r.title), lower(btrim(p_query))) > 0
       or r.slug = btrim(p_query)
       or exists (
         select 1 from public.registry_old_links o
          where o.registry_id = r.id and o.slug = btrim(p_query)
       )
     )
   order by r.created_at desc
   limit 25;
$$;

revoke execute on function public.support_find_lists(text) from public, anon, authenticated;
grant execute on function public.support_find_lists(text) to service_role;
