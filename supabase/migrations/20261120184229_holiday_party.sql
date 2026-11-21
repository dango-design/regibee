-- ============================================================================
-- "Holiday party" events
-- ============================================================================
-- Adds 'holiday_party' to the occasions events.event_type allows. It's a party
-- for the winter holidays, whatever each family celebrates, and like a family
-- Christmas it starts with everyone giving everyone: each guest links their
-- own wish list when they RSVP. That starting point lives in the code
-- (src/lib/occasions.ts); this file only lets the database store the new type.
--
-- 'holiday' stays as it is. It's "Other holiday", for the rest of the year's
-- holidays, like a Lunar New Year dinner.
--
-- Run it before deploying the code that offers "Holiday party". Until then,
-- making one fails this check. Running it first is safe: it only allows one
-- more value, and no existing row changes.

begin;

alter table public.events drop constraint events_event_type_check;
alter table public.events add constraint events_event_type_check
  check (event_type in (
    'baby_shower',
    'sip_and_see',
    'bridal_shower',
    'wedding',
    'engagement',
    'bachelor',
    'birthday',
    'kids_birthday',
    'christmas',
    'holiday_party',
    'gift_exchange',
    'holiday',
    'housewarming',
    'graduation',
    'retirement',
    'gathering',
    'potluck',
    'meal_train',
    'other'
  ));

commit;
