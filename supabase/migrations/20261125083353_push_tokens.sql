-- ============================================================================
-- Push notifications in the phone app
-- ============================================================================
-- The phone app can show a notification for a follow request, an RSVP to
-- your event and a gift on your list. Expo's push service delivers them. To
-- reach a phone, the website's server needs that phone's Expo push token.
--
-- What this adds:
--
-- 1. push_tokens: one row per phone that has notifications on, with the
--    account signed in on it. A token belongs to the phone, so it's the key:
--    when someone else signs in on the same phone, the row moves to them.
--
-- 2. register_push_token(token, platform): saves the phone's token for the
--    signed-in account, moving it from another account if needed. The app
--    calls it after sign-in. An account keeps at most 20 phones: older rows go.
--
-- Access:
-- - A signed-in account can read and delete only its own rows, through the
--   API. It can't insert or update them directly: register_push_token does
--   that, and only ever for the account calling it.
-- - The website's server reads tokens with the service-role key to send
--   pushes (src/lib/push-server.ts), and deletes tokens Expo says are no
--   longer registered.
-- - The app deletes the phone's row when someone signs out or turns
--   notifications off. Rows go when their account is deleted.
--
-- Run this before merging the PR that adds it. Until it runs, the app can't
-- save tokens (it carries on without them) and the server sends no pushes.
--
-- Safe to run more than once.

begin;

create table if not exists public.push_tokens (
  -- Expo's token for one install of the app, like ExponentPushToken[xxxx].
  token      text primary key
             check (char_length(token) <= 200 and token ~ '^Expo(nent)?PushToken\[[^\]]+\]$'),
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  -- The last time the app saved it. The app saves it each time it starts signed in.
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

revoke all on public.push_tokens from anon, authenticated;
grant select, delete on public.push_tokens to authenticated;

drop policy if exists "Owners read their push tokens" on public.push_tokens;
create policy "Owners read their push tokens"
  on public.push_tokens for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Owners delete their push tokens" on public.push_tokens;
create policy "Owners delete their push tokens"
  on public.push_tokens for delete
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  -- Guests' anonymous sessions on the website aren't accounts.
  if v_user is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in to turn on notifications';
  end if;

  insert into public.push_tokens (token, user_id, platform)
  values (p_token, v_user, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();

  -- At most 20 phones per account. Keep the ones saved most recently.
  delete from public.push_tokens
  where user_id = v_user
    and token in (
      select token from public.push_tokens
      where user_id = v_user
      order by updated_at desc
      offset 20
    );
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

commit;
