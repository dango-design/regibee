-- ============================================================================
-- Warn before Supabase's account email limit is reached
-- ============================================================================
-- Supabase sends the emails that confirm a new account and reset a password
-- itself, through Resend's SMTP server. It sends at most a set number an hour
-- for the whole project (Authentication → Rate Limits, 30 to start with).
-- Past that, sign-ups and password resets fail until the hour is up, on the
-- website and in the phone app. Supabase sends no warning, so this adds one.
--
-- What this adds:
--
-- 1. auth_emails_sent_since(p_since): how many account emails Supabase has
--    sent since then, from the times auth.users keeps for each kind. A user
--    keeps only the last time of each kind, so an email resent within the
--    hour counts once: the count can be a little low, never high. Only the
--    service role can call it.
--
-- 2. site_alerts: one row per warning emailed, so each kind goes out at most
--    once an hour. Only the server reads and writes it.
--
-- 3. A pg_cron job that calls the site's /api/cron/auth-emails every 5
--    minutes, through pg_net. That route counts, and emails ALERT_EMAIL when
--    the count nears the limit (src/lib/auth-email-alert.ts). The job reads
--    the site's address and CRON_SECRET from Supabase Vault, as secrets named
--    site_url and cron_secret. Until both are there it does nothing, as in
--    local Supabase. To add them on production, once:
--
--      select vault.create_secret('https://www.regibee.com', 'site_url');
--      select vault.create_secret('<CRON_SECRET from Vercel>', 'cron_secret');
--
--    And a daily job that deletes pg_cron's run history after 7 days, since
--    pg_cron keeps a row for every run and never deletes them itself.
--
-- It only adds things, so it can run before or after the code that uses it
-- is deployed. Until the route is deployed, the job's calls get a 404.

begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 1. The count ----------------------------------------------------------------

create or replace function public.auth_emails_sent_since(p_since timestamptz)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
      count(*) filter (where u.confirmation_sent_at >= p_since)
    + count(*) filter (where u.recovery_sent_at >= p_since)
    + count(*) filter (where u.email_change_sent_at >= p_since)
    + count(*) filter (where u.reauthentication_sent_at >= p_since)
  )::integer
  from auth.users as u;
$$;

-- Supabase grants new functions to anon and authenticated by name, so
-- revoking from public alone would leave them able to call it.
revoke all on function public.auth_emails_sent_since(timestamptz) from public, anon, authenticated;
grant execute on function public.auth_emails_sent_since(timestamptz) to service_role;

-- 2. Warnings sent --------------------------------------------------------------

create table if not exists public.site_alerts (
  id      bigint generated always as identity primary key,
  kind    text not null,
  sent_at timestamptz not null default now()
);

create index if not exists idx_site_alerts_kind_sent on public.site_alerts(kind, sent_at);

alter table public.site_alerts enable row level security;
revoke all on public.site_alerts from anon, authenticated;

-- 3. The jobs -------------------------------------------------------------------

-- cron.schedule replaces a job of the same name, so running this file again
-- leaves one of each.
select cron.schedule(
  'auth-email-limit',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := rtrim(site.url, '/') || '/api/cron/auth-emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || site.secret),
      timeout_milliseconds := 10000
    )
    from (
      select
        (select decrypted_secret from vault.decrypted_secrets where name = 'site_url') as url,
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret') as secret
    ) as site
    where site.url is not null and site.secret is not null
  $job$
);

select cron.schedule(
  'cron-history-cleanup',
  '30 3 * * *',
  $job$ delete from cron.job_run_details where end_time < now() - interval '7 days' $job$
);

commit;
