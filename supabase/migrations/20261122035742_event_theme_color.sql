-- The color a host picks for their event's invitation, like "#e2b4bd". It
-- fills the invitation's header when there's no picture, the Gifts section,
-- everyone's wish lists and the wish list box in the RSVP card
-- (src/lib/event-colors.ts). Null uses the occasion's colors, and leaves the
-- wish list areas without a fill.
--
-- Only adds a column, so run it before merging the code that uses it.

alter table public.events
  add column if not exists theme_color text
    constraint events_theme_color_check check (theme_color ~ '^#[0-9a-f]{6}$');
