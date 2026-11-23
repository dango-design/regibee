-- ============================================================================
-- Gift ideas: who it's for is optional
-- ============================================================================
-- Someone can save a gift idea before they know who it's for. An idea saved
-- that way has an empty `recipient` (''). The page lists those ideas under
-- "Not sure who yet" (src/lib/gift-ideas.ts).
--
-- Why an empty string and not null: older phone app builds and extension
-- versions read `recipient` as text. An empty string still works there. A
-- null could break them.
--
-- It only loosens a rule, so it's safe to run before the code that uses it.
-- Run it before merging: without it, saving an idea with no name fails on
-- regibee.com.

begin;

alter table public.gift_ideas alter column recipient set default '';

-- The check from 20261115094644_gift_ideas.sql asked for 1 to 80 characters.
alter table public.gift_ideas drop constraint gift_ideas_recipient_check;
alter table public.gift_ideas
  add constraint gift_ideas_recipient_check check (char_length(btrim(recipient)) <= 80);

commit;
