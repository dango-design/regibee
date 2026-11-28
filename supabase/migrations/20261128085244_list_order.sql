-- ============================================================================
-- The order of a person's lists
-- ============================================================================
-- Two orders, each a list of registry ids, saved on the person's profile:
--
-- profiles.list_order: the order of the lists on their own My registries
-- tab and the phone app's home screen. It holds the lists they own and the
-- lists they help manage, and only they see it. Each co-manager keeps their
-- own order.
--
-- profiles.profile_list_order: the order of their lists on their public
-- profile (/u/<id>). Null keeps the old order: soonest date first.
--
-- A list missing from an order, like a new one, goes first. An id for a list
-- that was deleted, or one they no longer manage, is skipped when the lists
-- are shown (src/lib/list-order.ts).
--
-- Signed-in sessions can't update these columns: 011_public_profiles.sql
-- took away update on profiles and gave back only full_name. The server
-- writes them with the service-role client after checking who's asking
-- (src/lib/actions/list-order.ts). The owner can read them through the
-- profiles select rule, as with the other columns.
--
-- It only adds columns, so the code that's deployed now keeps working. Run
-- it BEFORE deploying the code that reads them.

alter table public.profiles
  add column list_order uuid[]
    constraint profiles_list_order_length check (cardinality(list_order) <= 500),
  add column profile_list_order uuid[]
    constraint profiles_profile_list_order_length check (cardinality(profile_list_order) <= 500);
