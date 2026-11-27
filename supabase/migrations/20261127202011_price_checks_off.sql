-- ============================================================================
-- Turning off price checks for one item
-- ============================================================================
-- A list's page checks the price of a few items each week (PriceCheck, see
-- "Checking prices" in CLAUDE.md). The review of a new price now has a "Don't
-- check this price again" checkbox.
--
-- What this adds:
--
-- 1. item_detail_reads.price_checks_off_url: the item's link when a manager
--    turned off its price checks. Null while checks are on. Checks stay off
--    while the item keeps that link, and start again when the link changes,
--    since a new link can be a different product or store.
--
-- Only the website's server reads and writes item_detail_reads, as before.
--
-- Run this before merging the PR that adds it. Until it runs, the list page
-- still works, but the checkbox can't save.
--
-- Safe to run more than once.

begin;

alter table public.item_detail_reads add column if not exists price_checks_off_url text;

commit;
