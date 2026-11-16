-- ============================================================================
-- List links that are hard to guess, and getting a new one
-- ============================================================================
-- Anyone with a list's link (/r/<slug>) can open it. That makes the link the
-- only thing keeping a list to the people its owner sent it to, so:
--
-- 1. new_registry_slug(title) makes a link with 12 random characters at the
--    end, from a strong random source. Links used to end in 6 characters from
--    Math.random. The website makes the same shape itself
--    (generateRegistrySlug in src/lib/registry-create.ts). The phone app has
--    no strong random source, so it calls this function.
-- 2. A list's managers can get a new link on its Settings page. The old one
--    stops opening the list. registry_old_links keeps each old link, so a
--    guest's gift emails still lead to their gift: the gift link and the
--    signed "see your gifts" link both prove the guest gave on that list
--    (src/lib/list-links.ts). Nobody else gets from an old link to the new
--    one. Only the server reads this table.
-- 3. Only the server can change a list's link. Before this, a manager could
--    set any slug through the API, such as one that's easy to guess, or one
--    another list just gave up. The trigger refuses a change from a signed-in
--    session, and records the old link when the server makes one.
--
-- Run it before deploying the code. The Settings page refuses to make a new
-- link until registry_old_links exists, so links are never replaced without
-- the old one being kept. Running it first is safe: it only adds things, and
-- nothing in the live code changes a slug.

begin;

-- --------------------------------------------------------------------------
-- 1. New links
-- --------------------------------------------------------------------------

-- The title in lowercase letters and numbers, up to 50 characters, then 12
-- characters with no l, o, 0 or 1. Like profile ids (new_profile_public_id in
-- 017_profile_links_and_email_search.sql), the characters come from the
-- random bytes of a v4 UUID, skipping byte 6 (version) and byte 8 (variant).
-- 256 is a multiple of 32, so every character is equally likely: 60 random
-- bits in all.
create or replace function public.new_registry_slug(p_title text)
returns text
language sql
volatile
set search_path = ''
as $$
  with title_part as (
    select trim(both '-' from left(
             trim(both '-' from regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', '-', 'g')),
             50)) as part
  ),
  code as (
    select string_agg(
             substr('abcdefghijkmnpqrstuvwxyz23456789', get_byte(random_uuid.bytes, i) % 32 + 1, 1),
             '' order by i) as chars
      from (select uuid_send(gen_random_uuid()) as bytes) as random_uuid,
           unnest(array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13]) as i
  )
  select coalesce(nullif(title_part.part, ''), 'list') || '-' || code.chars
    from title_part, code;
$$;

-- Supabase grants new functions to anon by name, so revoking from public
-- alone leaves anon able to call it.
revoke all on function public.new_registry_slug(text) from public, anon;
grant execute on function public.new_registry_slug(text) to authenticated;

-- --------------------------------------------------------------------------
-- 2. Old links
-- --------------------------------------------------------------------------

create table public.registry_old_links (
  slug        text primary key,
  registry_id uuid not null references public.registries(id) on delete cascade,
  replaced_at timestamptz not null default now()
);

create index idx_registry_old_links_registry_id on public.registry_old_links(registry_id);

-- No policies: only the service role reads or writes it.
alter table public.registry_old_links enable row level security;
revoke all on public.registry_old_links from anon, authenticated;

-- --------------------------------------------------------------------------
-- 3. Changing a link
-- --------------------------------------------------------------------------

create or replace function public.record_registry_old_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No caller means the service role: the replaceRegistryLink server action,
  -- after checking the person manages the list.
  if auth.uid() is not null then
    raise exception 'Get a new link from the list''s Settings page'
      using errcode = '42501';
  end if;

  insert into public.registry_old_links (slug, registry_id)
  values (old.slug, old.id)
  on conflict (slug) do nothing;

  return new;
end;
$$;

revoke all on function public.record_registry_old_link() from public, anon, authenticated;

create trigger record_registry_old_link
  before update of slug on public.registries
  for each row
  when (old.slug is distinct from new.slug)
  execute function public.record_registry_old_link();

commit;
