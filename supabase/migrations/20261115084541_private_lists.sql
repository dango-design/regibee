-- ============================================================================
-- Private lists
-- ============================================================================
-- A list can now be private: only its owner and co-managers can open it. Its
-- link doesn't work for anyone else, and it can't be on the owner's profile.
--
-- Who can open a list is now one of three choices (src/lib/list-access.ts):
--   private: is_private
--   anyone with the link: neither column set
--   public: is_public
--
-- New lists start as "anyone with the link", so is_public now defaults to
-- false. The website and the phone app always send both columns anyway.
--
-- The list page (src/app/r/[slug]/page.tsx) refuses private lists to everyone
-- but managers. The database does the rest:
-- 1. Making a list private takes it off every event, every group it's shared
--    with, and every Secret Santa wish list it's on. Guests of those found
--    the list there, so they'd otherwise still see its name and link.
-- 2. A private list can't be added to an event or shared with a group.
-- 3. Only the list's managers can give a gift on a private list. Guests
--    reserve gifts through security definer functions that anyone with the
--    anon key can call, so this has to be checked here, not in the website.
--
-- Run it before deploying the code. The website and the phone app read
-- is_private, so they break until it exists. Running it first is safe: no
-- list is private until someone chooses it, and the deployed code always
-- sends is_public.

begin;

-- --------------------------------------------------------------------------
-- The column
-- --------------------------------------------------------------------------

alter table public.registries
  add column is_private boolean not null default false,
  add constraint registries_private_not_public
    check (not (is_private and is_public)),
  add constraint registries_private_not_listed
    check (not (is_private and listed_on_profile));

alter table public.registries
  alter column is_public set default false;

-- --------------------------------------------------------------------------
-- 1. Making a list private takes it off events, groups and wish lists
-- --------------------------------------------------------------------------

-- Security definer, because the manager making the change can't write these
-- tables themselves: only the server can (see their migrations).
create or replace function public.unshare_private_registry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.event_registries where registry_id = new.id;
  delete from public.registry_groups where registry_id = new.id;
  update public.event_guests
     set wishlist_registry_id = null,
         wishlist_url = null
   where wishlist_registry_id = new.id;
  return new;
end;
$$;

create trigger unshare_private_registry
  after update of is_private on public.registries
  for each row
  when (new.is_private and not old.is_private)
  execute function public.unshare_private_registry();

-- --------------------------------------------------------------------------
-- 2. A private list can't be added to an event or a group
-- --------------------------------------------------------------------------

create or replace function public.refuse_private_registry_share()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.registries where id = new.registry_id and is_private) then
    raise exception 'A private list can''t be shared'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger refuse_private_registry_share
  before insert or update of registry_id on public.event_registries
  for each row execute function public.refuse_private_registry_share();

create trigger refuse_private_registry_share
  before insert or update of registry_id on public.registry_groups
  for each row execute function public.refuse_private_registry_share();

-- --------------------------------------------------------------------------
-- 3. Only managers give gifts on a private list
-- --------------------------------------------------------------------------

-- An item can be on several of its owner's lists (registry_item_placements).
-- A gift goes through when any list the item is on is open to the giver: not
-- private, or the giver manages it. The server's own inserts use the service
-- role, after their own checks.
create or replace function public.refuse_gifts_on_private_registries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registry_ids uuid[];
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if new.registry_item_id is not null then
    select array_agg(lists.registry_id)
      into v_registry_ids
      from (
        select registry_id from public.registry_items where id = new.registry_item_id
        union
        select registry_id from public.registry_item_placements where item_id = new.registry_item_id
      ) as lists;
  elsif new.cash_fund_id is not null then
    select array_agg(registry_id)
      into v_registry_ids
      from public.cash_funds
     where id = new.cash_fund_id;
  else
    return new;
  end if;

  if exists (
    select 1
      from public.registries
     where id = any(v_registry_ids)
       and (not is_private or public.is_registry_manager(id, auth.uid()))
  ) then
    return new;
  end if;

  raise exception 'This list is private'
    using errcode = '42501';
end;
$$;

create trigger refuse_gifts_on_private_registries
  before insert on public.purchases
  for each row execute function public.refuse_gifts_on_private_registries();

commit;
