-- Which baby checklist entry an item or gift fund counts for
-- (src/lib/checklist-data.ts, src/lib/checklist-matching.ts).
--
--   null      the site works it out from the title, as before
--   a key     it counts for that entry, such as 'crib-mattress'
--   'none'    it counts for no entry
--
-- The checklist sets it when someone adds an entry, and the owner can change
-- it on the checklist page or in the item's dialog. Keys stay the same when an
-- entry is renamed, so a saved choice survives changes to the checklist.
--
-- The existing access rules cover it: whoever can edit the row can set it.
-- Safe to run twice.

alter table public.registry_items add column if not exists checklist_entry text;
alter table public.cash_funds add column if not exists checklist_entry text;

alter table public.registry_items drop constraint if exists registry_items_checklist_entry_format;
alter table public.registry_items add constraint registry_items_checklist_entry_format
  check (checklist_entry is null or checklist_entry ~ '^[a-z0-9-]{1,60}$');

alter table public.cash_funds drop constraint if exists cash_funds_checklist_entry_format;
alter table public.cash_funds add constraint cash_funds_checklist_entry_format
  check (checklist_entry is null or checklist_entry ~ '^[a-z0-9-]{1,60}$');
