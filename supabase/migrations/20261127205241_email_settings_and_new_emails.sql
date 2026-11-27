-- ============================================================================
-- Email settings and new emails
-- ============================================================================
-- What this adds:
--
-- 1. profiles.gift_emails: how a list's managers hear about gifts. 'instant'
--    (one email per gift, as before), 'daily' (one summary a day) or 'off'.
--    Set on the Account page. Phone pushes don't change.
--
-- 2. gift_email_digest: gifts waiting for tomorrow's daily summary, one row
--    per manager who chose 'daily'. The daily job sends them and deletes the
--    rows. A row only points at the purchase: the job reads the gift when it
--    sends, so a gift the guest undid is left out. shown_name is the giver's
--    name as the manager may see it, "Secret Santa" for a hidden giver.
--
-- 3. profiles.welcome_emailed_at: when the welcome email went, so a second
--    confirmation link can't send another.
--
-- 4. registries.thanks_reminded_for: the list date a thank-you reminder went
--    out for. A birthday list's date moves each year, so this holds the date,
--    not a yes/no.
--
-- 5. events.auto_rsvp_reminder and events.rsvp_reminded_for: whether guests
--    who haven't replied get one reminder 3 days before the reply-by date,
--    and the reply-by date it was sent for. On by default; the host turns it
--    off on the event's Edit page.
--
-- 6. events.exchange_reminded_for: the event date the gift exchange's
--    "time to get your gift" reminder went out for.
--
-- 7. group_gifts.funded_emailed_at: when the organizer was told the goal was
--    reached, so taking a pledge back and adding it again can't send another.
--
-- Access:
-- - gift_email_digest has no access rules for the API: only the website's
--   server reads and writes it, with the service-role key.
-- - The new profiles columns follow the table's existing rules: a signed-in
--   session can read its own row but only update full_name and avatar_url,
--   so the server saves gift_emails (setGiftEmails) and welcome_emailed_at.
-- - The new events, registries and group_gifts columns follow those tables'
--   existing rules. Only the server writes the "sent" columns.
--
-- Run this before merging the PR that adds it. Until it runs, sending a gift
-- email, deleting an item and the daily jobs fail on regibee.com.
--
-- Safe to run more than once.

begin;

alter table public.profiles
  add column if not exists gift_emails text not null default 'instant'
    check (gift_emails in ('instant', 'daily', 'off')),
  add column if not exists welcome_emailed_at timestamptz;

create table if not exists public.gift_email_digest (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  registry_id uuid not null references public.registries(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  -- 'given': an item; 'covered': money for an item the owners bought;
  -- 'fund': a gift fund.
  kind        text not null check (kind in ('given', 'covered', 'fund')),
  shown_name  text not null check (char_length(shown_name) <= 120),
  created_at  timestamptz not null default now(),
  unique (user_id, purchase_id)
);

create index if not exists idx_gift_email_digest_user_id on public.gift_email_digest(user_id);

alter table public.gift_email_digest enable row level security;
revoke all on public.gift_email_digest from anon, authenticated;

alter table public.registries
  add column if not exists thanks_reminded_for date;

alter table public.events
  add column if not exists auto_rsvp_reminder boolean not null default true,
  add column if not exists rsvp_reminded_for date,
  add column if not exists exchange_reminded_for date;

alter table public.group_gifts
  add column if not exists funded_emailed_at timestamptz;

commit;
