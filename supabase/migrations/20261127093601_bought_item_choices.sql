-- ============================================================================
-- Choices for an item a list's manager bought themselves
-- ============================================================================
-- A manager can mark an item as bought by them (is_parent_purchased). Until
-- now, guests could always cover it, by sending its price. Two new columns let
-- the manager choose what happens next, and change it at any time:
--
-- - guests_can_cover: guests can cover the item. On by default, which is how
--   it worked before, so items already marked keep working the same way.
-- - marked_gifted: the manager says the item counts as gifted, such as when
--   someone paid them back outside Regibee. Guests can't cover it then.
--
-- Both only mean something while is_parent_purchased is on. Unmarking it puts
-- them back to their defaults, so marking it again starts fresh. The website
-- and the phone app both change is_parent_purchased, so the existing trigger
-- does this.
--
-- cover_parent_item now refuses an item guests can't cover. Gifts already
-- saved stay as they are.
--
-- Run it before deploying the code: the dashboard reads both columns.
-- Safe to run more than once.

begin;

alter table public.registry_items
  add column if not exists guests_can_cover boolean not null default true,
  add column if not exists marked_gifted boolean not null default false;

comment on column public.registry_items.guests_can_cover is
  'For an item its manager bought (is_parent_purchased): guests can cover it by sending its price.';
comment on column public.registry_items.marked_gifted is
  'For an item its manager bought (is_parent_purchased): the manager counts it as gifted. Guests can''t cover it.';

-- ============================================================================
-- Unmarking "bought it myself" resets the choices
-- ============================================================================

-- The same as 20261113213004_gift_counts.sql, plus the reset.
create or replace function public.recount_when_bought_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_given bigint;
begin
  if new.is_parent_purchased then
    new.quantity_fulfilled := new.quantity_needed;
  else
    select coalesce(sum(p.quantity), 0)
      into v_given
      from public.purchases p
     where p.registry_item_id = new.id
       and p.status in ('reserved', 'purchased');

    new.quantity_fulfilled := least(new.quantity_needed, v_given)::int;
    new.guests_can_cover := true;
    new.marked_gifted := false;
  end if;

  return new;
end;
$$;

revoke execute on function public.recount_when_bought_changes() from public, anon, authenticated;

-- ============================================================================
-- Covering checks the manager's choice
-- ============================================================================

-- The same as 20261113213004_gift_counts.sql, plus the check.
create or replace function public.cover_parent_item(
  p_item_id      uuid,
  p_buyer_name   text,
  p_buyer_email  text default null,
  p_quantity     int  default 1,
  p_message      text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item            record;
  v_already_covered int;
  v_purchase_id     uuid;
begin
  -- Anyone can call this function, so a zero or negative quantity must not
  -- lower the item's covered count.
  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select ri.*
    into v_item
    from public.registry_items ri
   where ri.id = p_item_id
     and ri.is_parent_purchased = true
   for update;

  if not found then
    raise exception 'Item not found or not marked as parent-purchased';
  end if;

  if not v_item.guests_can_cover or v_item.marked_gifted then
    raise exception 'This item isn''t open to gifts';
  end if;

  -- From 008_cover_item_quantity_cap.sql: guests can't cover more than the
  -- owners bought.
  select coalesce(sum(p.quantity), 0)
    into v_already_covered
    from public.purchases p
   where p.registry_item_id = p_item_id
     and p.status <> 'cancelled';

  if p_quantity > (v_item.quantity_needed - v_already_covered) then
    raise exception 'Not enough items available to gift. % of % available.',
      greatest(0, v_item.quantity_needed - v_already_covered), v_item.quantity_needed;
  end if;

  -- Covering doesn't change quantity_fulfilled.
  insert into public.purchases (registry_item_id, buyer_name, buyer_email, quantity, status, message)
  values (p_item_id, p_buyer_name, p_buyer_email, p_quantity, 'reserved', p_message)
  returning id into v_purchase_id;

  return v_purchase_id;
end;
$$;

commit;
