-- ============================================================================
-- Inviting people you follow to an event
-- ============================================================================
-- A host can add people they follow to an event's guest list without typing
-- an email (inviteFollowedPeople in src/lib/actions/events.ts). Their
-- invitation goes to the email on their account, which is stored on the guest
-- like any other, so invitations, reminders and messages reach them the same
-- way. The guest is linked to the account by profile_id.
--
-- The host sees that email only when the two follow each other. Otherwise the
-- guest list shows it as private (src/lib/guest-emails.ts). The same goes for
-- a group saved from that guest list: group_members.profile_id, which already
-- exists (20261111223600_groups.sql) and nothing set until now, links the
-- member to the account in the same way.
--
-- What this adds:
--
-- 1. event_guests.profile_id, and at most one guest per account on an event.
-- 2. A trigger that takes the email off those guests and group members when
--    the account is deleted. Clearing profile_id alone would leave the
--    address showing to hosts it was hidden from.
--
-- It only adds things, so it can run before or after the code that uses it
-- is deployed. Run it before, so inviting people you follow works as soon as
-- it ships.

begin;

alter table public.event_guests
  add column profile_id uuid references public.profiles(id) on delete set null;

create index idx_event_guests_profile_id
  on public.event_guests(profile_id)
  where profile_id is not null;

-- One guest per account on each event, as there's one per email address.
create unique index event_guests_event_profile_key
  on public.event_guests(event_id, profile_id)
  where profile_id is not null;

create or replace function public.clear_account_guest_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_guests set email = null where profile_id = old.id;
  update public.group_members set email = null where profile_id = old.id;
  return old;
end;
$$;

-- Only the trigger calls it.
revoke execute on function public.clear_account_guest_emails() from public, anon, authenticated;

create trigger clear_account_guest_emails
  before delete on public.profiles
  for each row execute function public.clear_account_guest_emails();

commit;
