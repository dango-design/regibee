-- ============================================================================
-- Limits on emails that visitors set off
-- ============================================================================
-- Some pages send email because of what a visitor does there, and the visitor
-- doesn't need an account:
--
-- - A list (/r/<slug>): reserving or giving a gift emails the address the
--   visitor typed, and the list's managers. A reservation's reminder and the
--   email when it runs out go to that address later. Suggesting an item
--   emails the managers.
-- - An event (/e/<slug>): an RSVP emails the guest and the host.
-- - A group gift: chipping in emails the person who chipped in and the
--   organizer.
--
-- Anyone with the link could type other people's addresses over and over.
-- 20261116074752_account_levels.sql limits emails an account sends, and
-- these have no account to count against. So each list, event and group gift
-- gets its own daily allowance, and its owner's level sets how big it is.
-- Pages whose owners are basic also share one allowance, so many pages can't
-- use up the day's sending between them. The numbers are in
-- src/lib/account-levels.ts.
--
-- Over the limit, the gift or RSVP still saves. Only the emails are skipped.
--
-- Nothing calls reserve_visitor_emails until the website code that uses it
-- is deployed. Until then, it only adds an empty table.
--
-- Safe to run more than once.

-- One row per send: which page, its owner's level then, what kind and how
-- many emails. Not who they went to, and not who the visitor was.
create table if not exists public.visitor_email_sends (
  id       bigint generated always as identity primary key,
  -- The list, event or group gift. No foreign key, since it can be any of
  -- the three. The rows stay when the page is deleted, so deleting one
  -- doesn't free up the day's shared allowance.
  page_id  uuid not null,
  level    text not null check (level in ('basic', 'star')),
  kind     text not null,
  emails   integer not null check (emails > 0),
  sent_at  timestamptz not null default now()
);

create index if not exists idx_visitor_email_sends_page on public.visitor_email_sends(page_id, sent_at);
create index if not exists idx_visitor_email_sends_level on public.visitor_email_sends(level, sent_at);

-- Server only.
alter table public.visitor_email_sends enable row level security;
revoke all on public.visitor_email_sends from anon, authenticated;

-- Takes up to p_wanted emails from the page's allowance for the last 24
-- hours, and logs them as one send. p_owner is the account that made the
-- page; its level picks the page's limit. Pages of basic owners also share a
-- site-wide allowance.
--
-- Returns the new row's id (null when nothing was taken) and how many emails
-- were taken. The website sends to that many and skips the rest.
create or replace function public.reserve_visitor_emails(
  p_page uuid,
  p_owner uuid,
  p_kind text,
  p_wanted integer,
  p_basic_daily integer,
  p_star_daily integer,
  p_basic_site_daily integer
)
returns table (reservation bigint, granted integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_level text := public.account_level(p_owner);
  v_since timestamptz := now() - interval '1 day';
  v_left integer;
  v_granted integer;
  v_id bigint;
begin
  -- One send at a time per page, and one at a time across basic owners'
  -- pages, so two sends at once can't both take the last of an allowance.
  -- The locks are always taken in this order, so two sends can't wait on
  -- each other.
  perform pg_advisory_xact_lock(hashtextextended('visitor_email_sends:' || p_page::text, 0));
  if v_level = 'basic' then
    perform pg_advisory_xact_lock(hashtextextended('visitor_email_sends:basic', 0));
  end if;

  select (case when v_level = 'star' then p_star_daily else p_basic_daily end) - coalesce(sum(s.emails), 0)
    into v_left
    from public.visitor_email_sends s
   where s.page_id = p_page
     and s.sent_at > v_since;

  if v_level = 'basic' then
    v_left := least(v_left, p_basic_site_daily - (
      select coalesce(sum(s.emails), 0)
        from public.visitor_email_sends s
       where s.level = 'basic'
         and s.sent_at > v_since
    ));
  end if;

  v_granted := greatest(least(p_wanted, v_left), 0);

  if v_granted > 0 then
    insert into public.visitor_email_sends (page_id, level, kind, emails)
    values (p_page, v_level, p_kind, v_granted)
    returning id into v_id;
  end if;

  return query select v_id, v_granted;
end;
$$;

revoke execute on function public.reserve_visitor_emails(uuid, uuid, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_visitor_emails(uuid, uuid, text, integer, integer, integer, integer)
  to service_role;
