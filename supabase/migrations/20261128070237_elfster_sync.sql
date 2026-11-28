-- ============================================================================
-- Keeping a list in sync with an Elfster wishlist
-- ============================================================================
-- Some people keep an Elfster wishlist because their family uses Elfster, and
-- a Regibee list as well. A gift bought on one site doesn't show on the other,
-- so two people can buy the same thing. The browser extension can now keep a
-- Regibee list in sync with the owner's Elfster wishlist: each time the owner
-- opens the extension on that wishlist, it sends how many of each wish have
-- been bought or received on Elfster, and Regibee's guests see those as taken
-- (src/lib/wishlist-import.ts).
--
-- Elfster never shows a wishlist's owner what's been bought for them, so
-- neither does Regibee: only guests see these. The list's managers never do,
-- on any screen.
--
-- What this adds:
--
-- 1. elfster_wishlists: which Elfster wishlist each list is kept in sync with.
--    A row is added when a manager imports from the wishlist with "Keep in
--    sync" on, and removed when they stop.
--
-- 2. elfster_wishes: which Elfster wish each item came from, and how many of
--    it have been bought or received on Elfster (`given`). The guest list
--    page counts `given` as taken (src/lib/public-list-page.ts).
--
-- 3. reserve_registry_item counts `given` too, so a guest can't reserve an
--    item that's been bought on Elfster, even from a page that was open
--    before the sync. Its arguments and result don't change.
--
-- Only the website's server reads and writes the two tables, with the
-- service-role key, after checking that the person manages the list. No API
-- role can read them, so a manager's own session can't see what's been
-- bought on Elfster either.
--
-- The tables link only to registries (elfster_wishlists) or only to
-- registry_items (elfster_wishes), never to both, so they add no second route
-- between those two tables for Supabase's API (see "Database changes" in
-- CLAUDE.md).
--
-- A row goes when its list or item does.
--
-- Run this before merging the PR that adds it. Until it runs, the guest page
-- and the extension's import still work, but turning on the sync fails with
-- an error.
--
-- Safe to run more than once.

begin;

create table if not exists public.elfster_wishlists (
  registry_id uuid not null references public.registries(id) on delete cascade,
  -- The id in the wishlist's address on elfster.com.
  wishlist_id uuid not null,
  linked_by   uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  synced_at   timestamptz not null default now(),
  primary key (registry_id, wishlist_id)
);

create table if not exists public.elfster_wishes (
  item_id     uuid primary key references public.registry_items(id) on delete cascade,
  wishlist_id uuid not null,
  -- Elfster's id for the wish.
  wish_id     text not null check (length(wish_id) between 1 and 100),
  -- How many have been bought or received on Elfster.
  given       int not null default 0 check (given between 0 and 99),
  synced_at   timestamptz not null default now()
);

create index if not exists elfster_wishes_wishlist_id_idx on public.elfster_wishes(wishlist_id);

alter table public.elfster_wishlists enable row level security;
alter table public.elfster_wishes enable row level security;
revoke all on public.elfster_wishlists from anon, authenticated;
revoke all on public.elfster_wishes from anon, authenticated;

-- The same as 015_gift_reservations.sql, except that what's been given on
-- Elfster counts as taken.
create or replace function public.reserve_registry_item(
  p_item_id       uuid,
  p_buyer_name    text,
  p_buyer_email   text default null,
  p_quantity      int  default 1,
  p_message       text default null,
  p_hold_days     int  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available   int;
  v_purchase_id uuid;
begin
  -- Anyone can call this function, so a zero or negative quantity must not
  -- lower the item's fulfilled count.
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  if p_hold_days is not null and (p_hold_days < 1 or p_hold_days > 30) then
    raise exception 'A reservation is held for 1 to 30 days';
  end if;

  -- Lock the row to prevent concurrent over-reservation
  select (ri.quantity_needed - ri.quantity_fulfilled - coalesce(ew.given, 0))
    into v_available
    from public.registry_items ri
    left join public.elfster_wishes ew on ew.item_id = ri.id
   where ri.id = p_item_id
   for update of ri;

  if v_available is null then
    raise exception 'Registry item not found';
  end if;

  if p_quantity > v_available then
    raise exception 'Not enough quantity available. Requested: %, Available: %', p_quantity, greatest(v_available, 0);
  end if;

  update public.registry_items
     set quantity_fulfilled = quantity_fulfilled + p_quantity,
         version = version + 1,
         updated_at = now()
   where id = p_item_id;

  insert into public.purchases
    (registry_item_id, buyer_name, buyer_email, quantity, status, message, reserved_until)
  values
    (p_item_id, p_buyer_name, p_buyer_email, p_quantity, 'reserved', p_message,
     case when p_hold_days is null then null else now() + make_interval(days => p_hold_days) end)
  returning id into v_purchase_id;

  return v_purchase_id;
end;
$$;

commit;
