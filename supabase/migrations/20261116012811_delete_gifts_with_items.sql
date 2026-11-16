-- ============================================================================
-- Guests' gifts go with the item or gift fund they were for
-- ============================================================================
-- purchases.registry_item_id and purchases.cash_fund_id are "on delete set
-- null". So deleting an item, a gift fund or a whole list left the guests'
-- gift records behind, with their names, emails and messages, pointing at
-- nothing. Nobody could see them any more, since the access rules and every
-- page reach a gift through its item or fund, but they stayed in the
-- database. Only deleting the owner's account removed them
-- (src/lib/account-deletion.ts).
--
-- What this changes:
--
-- 1. Deleting an item deletes its gifts, whoever deletes it: the website
--    (src/lib/item-placements.ts), the phone app and the browser extension,
--    which delete rows directly, and the database, when it deletes a list's
--    items with the list. An item that only moves to another list it's on
--    (keep_placed_item_on_delete, in 20261112062733_item_placements.sql)
--    isn't deleted, so it keeps its gifts.
-- 2. Deleting a gift fund deletes its gifts, the same way.
-- 3. Except a group gift's reservation. The group gift page reads whether the
--    group gift is open, bought or called off from it, and the organizer can
--    still call it off once the item is gone (callOffGroupGift in
--    src/lib/actions/group-gifts.ts). It goes when its group gift does: when
--    the list is deleted, or the organizer deletes their account.
-- 4. Deletes the gifts already left behind, except the reservations of group
--    gifts that are still there.
--
-- Deleting a gift deletes its Secret Santa giver row too (secret_givers
-- cascades).
--
-- Before running it on production, look at what step 4 will delete:
--
--   select count(*)
--     from public.purchases p
--    where p.registry_item_id is null
--      and p.cash_fund_id is null
--      and not exists (select 1 from public.group_gifts g where g.purchase_id = p.id);
--
-- and check that keep_placed_item_on_delete is still the only other trigger
-- that runs before an item is deleted (see step 1):
--
--   select tgname from pg_trigger
--    where tgrelid = 'public.registry_items'::regclass and not tgisinternal;
--
-- It needs no code change, so it can run before or after any deploy. Run
-- more than once, it changes nothing new.

begin;

-- --------------------------------------------------------------------------
-- 1. An item's gifts
-- --------------------------------------------------------------------------
-- This can't run after the delete: the foreign key's own trigger runs first
-- and sets registry_item_id to null, so the gifts can't be found by their
-- item any more. So it runs just before.
--
-- Postgres runs an event's triggers in name order, and stops at one that
-- skips the delete. keep_placed_item_on_delete skips it for an item that
-- moves to another list, and "keep..." comes before "remove...", so this
-- only runs for items that really go. Renaming either trigger can break
-- that, and a moved item would lose its gifts. A trigger added later that
-- can skip an item's delete needs a name that comes before
-- remove_gifts_with_item too. e2e/deleted-item-gifts.spec.ts checks it.

create or replace function public.remove_gifts_with_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.purchases p
   where p.registry_item_id = old.id
     and not exists (select 1 from public.group_gifts g where g.purchase_id = p.id);
  return old;
end;
$$;

-- Only the trigger calls it.
revoke execute on function public.remove_gifts_with_item() from public, anon, authenticated;

drop trigger if exists remove_gifts_with_item on public.registry_items;
create trigger remove_gifts_with_item
  before delete on public.registry_items
  for each row execute function public.remove_gifts_with_item();

-- --------------------------------------------------------------------------
-- 2. A gift fund's gifts
-- --------------------------------------------------------------------------
-- Group gifts are only ever on items, so nothing here is kept.

create or replace function public.remove_gifts_with_fund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.purchases where cash_fund_id = old.id;
  return old;
end;
$$;

revoke execute on function public.remove_gifts_with_fund() from public, anon, authenticated;

drop trigger if exists remove_gifts_with_fund on public.cash_funds;
create trigger remove_gifts_with_fund
  before delete on public.cash_funds
  for each row execute function public.remove_gifts_with_fund();

-- --------------------------------------------------------------------------
-- 3. A group gift's reservation, once the item and the group gift are gone
-- --------------------------------------------------------------------------
-- When a list is deleted, its items and its group gifts are deleted in either
-- order. If the item goes first, step 1 keeps the reservation and the
-- foreign key sets its item to null, so it's deleted here. If the group gift
-- goes first, its item is still there, so it's kept here and step 1 deletes
-- it. A group gift that goes while its item stays, when the organizer
-- deletes their account, leaves its reservation as an ordinary one on the
-- item.

create or replace function public.remove_group_gift_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.purchase_id is not null then
    delete from public.purchases
     where id = old.purchase_id
       and registry_item_id is null
       and cash_fund_id is null;
  end if;
  return old;
end;
$$;

revoke execute on function public.remove_group_gift_reservation() from public, anon, authenticated;

drop trigger if exists remove_group_gift_reservation on public.group_gifts;
create trigger remove_group_gift_reservation
  after delete on public.group_gifts
  for each row execute function public.remove_group_gift_reservation();

-- --------------------------------------------------------------------------
-- 4. Gifts already left behind
-- --------------------------------------------------------------------------
-- Every way a gift is made sets its item or its fund, so a gift with neither
-- lost it to a delete.

delete from public.purchases p
 where p.registry_item_id is null
   and p.cash_fund_id is null
   and not exists (select 1 from public.group_gifts g where g.purchase_id = p.id);

commit;
