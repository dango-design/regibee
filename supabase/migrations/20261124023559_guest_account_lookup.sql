-- ============================================================================
-- Finding the accounts behind an event's guests
-- ============================================================================
-- An event's guest list offers Follow beside a guest who has a Regibee
-- account (src/lib/guest-follows.ts). A guest the host typed in, or who
-- RSVPed from the event link, is matched to an account by email address.
--
-- account_id_for_email (017_profile_links_and_email_search.sql) looks up one
-- address at a time, and a guest list holds up to 300. This looks up a whole
-- list in one query, under the same rules: unconfirmed addresses and guests'
-- anonymous sessions don't count.
--
-- The app calls it with the service-role client, then checks each account's
-- "who can find me" choices and blocks itself, as it does for people search.
--
-- It only adds a function, so it can run before or after the code that uses
-- it is deployed. Until it runs, only guests invited from the people a host
-- follows get the Follow button.

create or replace function public.account_ids_for_emails(p_emails text[])
returns table (email text, account_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email), u.id
    from auth.users as u
   where lower(u.email) in (select lower(btrim(e)) from unnest(p_emails) as e)
     and u.email_confirmed_at is not null
     and not u.is_anonymous;
$$;

-- Functions in public can be run by anyone by default, including through the
-- Data API with the anon key. This one would tell anyone which email
-- addresses have accounts, so only the service role can run it.
revoke execute on function public.account_ids_for_emails(text[]) from public, anon, authenticated;
grant execute on function public.account_ids_for_emails(text[]) to service_role;
