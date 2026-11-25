-- ============================================================================
-- More than one wishlist for a guest of an everyone-gives-everyone event
-- ============================================================================
-- A guest has one wishlist on an event (event_guests.wishlist_registry_id).
-- A parent also wants their child's list there, beside their own. This adds:
--
-- 1. event_guest_lists: more of a guest's own Regibee lists on the event.
--    The other guests shop them like the guest's wishlist. Like the other
--    event tables, only the server reaches it. It stores the list's id, never
--    its link, since a link can change.
-- 2. gifts_revealed_through() counts these lists as linked to the event, so a
--    list that hides what's been reserved from its owner reveals its gifts
--    the day after.
-- 3. A list that becomes private comes off, and a private list can't be
--    added, as for event_registries.
--
-- event_guests and registries already link through wishlist_registry_id, so
-- this table is a second route between them. No query joins the two through
-- Supabase's API today. One that does must name its link (PGRST201, see
-- CLAUDE.md).
--
-- Run it before merging the code that uses it. It only adds things: the live
-- code never reads the new table, and the two functions it replaces answer
-- the same as before while the table is empty.

begin;

-- --------------------------------------------------------------------------
-- 1. A guest's other lists
-- --------------------------------------------------------------------------

create table public.event_guest_lists (
  guest_id    uuid not null references public.event_guests(id) on delete cascade,
  registry_id uuid not null references public.registries(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (guest_id, registry_id)
);

create index idx_event_guest_lists_registry_id on public.event_guest_lists(registry_id);

alter table public.event_guest_lists enable row level security;
revoke all on public.event_guest_lists from anon, authenticated;

-- --------------------------------------------------------------------------
-- 2. Reveals
-- --------------------------------------------------------------------------

-- The same as in 20261114035445_everyone_gives_everyone.sql, with a guest's
-- other lists among the linked ones.
create or replace function public.gifts_revealed_through(p_registry_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  with linked as (
    select er.event_id from public.event_registries er where er.registry_id = p_registry_id
    union
    select g.event_id from public.event_guests g where g.wishlist_registry_id = p_registry_id
    union
    select g.event_id
      from public.event_guest_lists l
      join public.event_guests g on g.id = l.guest_id
     where l.registry_id = p_registry_id
  ),
  moments as (
    select ((e.event_date + 1)::timestamp + interval '12 hours') at time zone 'UTC' as reveal_at
      from public.events e
      join linked l on l.event_id = e.id
     where e.event_date is not null
    union all
    select r.revealed_at from public.gift_reveals r where r.registry_id = p_registry_id
  )
  select max(m.reveal_at)
    from moments m
   where m.reveal_at <= now()
     and (
       public.is_registry_manager(p_registry_id, (select auth.uid()))
       or (select auth.role()) = 'service_role'
     );
$$;

-- --------------------------------------------------------------------------
-- 3. Private lists
-- --------------------------------------------------------------------------

-- The same as in 20261115084541_private_lists.sql, and it takes the list off
-- guests' other lists too.
create or replace function public.unshare_private_registry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.event_registries where registry_id = new.id;
  delete from public.registry_groups where registry_id = new.id;
  delete from public.event_guest_lists where registry_id = new.id;
  update public.event_guests
     set wishlist_registry_id = null,
         wishlist_url = null
   where wishlist_registry_id = new.id;
  return new;
end;
$$;

create trigger refuse_private_registry_share
  before insert or update of registry_id on public.event_guest_lists
  for each row execute function public.refuse_private_registry_share();

commit;
