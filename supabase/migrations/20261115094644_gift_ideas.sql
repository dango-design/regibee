-- ============================================================================
-- Gift ideas: private notes of things to give other people
-- ============================================================================
-- Someone sees a good gift for their mom and saves it to think about before
-- her next birthday. Mom must never see it. So a gift idea is not a list item:
-- it has no list, no link and no reservations, and only the account that
-- saved it can read it.
--
-- What this adds:
--
-- 1. gift_ideas: one row per idea. `recipient` is who it's for, as the owner
--    typed it ("Mom"). The page groups ideas by that name, ignoring case.
--    `bought_at` is set when the owner marks the idea as bought.
--
-- Unlike groups and events, this table has access rules for signed-in
-- accounts, so the website, the browser extension and the phone app can all
-- read and write it as the signed-in user. Each rule only lets an account
-- reach its own rows. Guests' anonymous sessions can't save any.
--
-- It only adds things, so it can run before or after the code that uses it
-- is deployed. Run it before, so the page works as soon as it ships.

begin;

create table public.gift_ideas (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  recipient    text not null check (char_length(btrim(recipient)) between 1 and 80),
  title        text not null check (char_length(btrim(title)) between 1 and 300),
  external_url text check (char_length(external_url) <= 2048 and external_url ~* '^https?://'),
  image_url    text check (char_length(image_url) <= 2048 and image_url ~* '^https?://'),
  price        numeric(12, 2) check (price >= 0),
  notes        text check (char_length(notes) <= 1000),
  bought_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Every read is "this account's ideas, newest first".
create index idx_gift_ideas_owner_created on public.gift_ideas(owner_id, created_at desc);

create trigger set_gift_ideas_updated_at
  before update on public.gift_ideas
  for each row execute function public.set_updated_at();

alter table public.gift_ideas enable row level security;

-- Signed-out visitors get nothing. Signed-in accounts get the four plain
-- operations, limited to their own rows by the rules below.
revoke all on public.gift_ideas from anon, authenticated;
grant select, insert, update, delete on public.gift_ideas to authenticated;

create policy "Owners can read their gift ideas"
  on public.gift_ideas for select
  to authenticated
  using ((select auth.uid()) = owner_id);

-- Guests who reserved a gift have an anonymous session. That isn't an account.
create policy "Accounts can save gift ideas"
  on public.gift_ideas for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  );

create policy "Owners can change their gift ideas"
  on public.gift_ideas for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their gift ideas"
  on public.gift_ideas for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

commit;
