-- ============================================================================
-- Filling in an item's details later
-- ============================================================================
-- Some stores, Amazon above all, block Regibee's server from reading their
-- pages. An item added without the browser extension, such as from an iPad,
-- keeps its link and a name guessed from it, with no photo or price. On a
-- computer with the extension, the list's page can read those links again and
-- fill in what's missing (src/lib/item-details.ts).
--
-- What this adds:
--
-- 1. item_detail_reads: one row per item, for the last time its link was read
--    this way. It keeps the link, so an item isn't offered again until its
--    link changes. It keeps what the read changed and the value before each
--    change, so the list's managers can review the changes and put an old
--    value back.
--
-- Only the website's server reads and writes it, with the service-role key,
-- after checking that the person manages a list the item is on. No API role
-- can read it.
--
-- A row goes when its item does.
--
-- Run this before merging the PR that adds it. Until it runs, the list page
-- doesn't offer to fill in details, which is safe.
--
-- Safe to run more than once.

begin;

create table if not exists public.item_detail_reads (
  item_id     uuid primary key references public.registry_items(id) on delete cascade,
  -- The item's link when it was read.
  read_url    text not null,
  read_at     timestamptz not null default now(),
  -- What the read changed: a list of {"field", "before", "after"}. "field" is
  -- title, price or image_url. "before" is null when the field was empty.
  changes     jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array'),
  -- When someone finished reviewing the changes. Null until then.
  reviewed_at timestamptz
);

alter table public.item_detail_reads enable row level security;
revoke all on public.item_detail_reads from anon, authenticated;

commit;
