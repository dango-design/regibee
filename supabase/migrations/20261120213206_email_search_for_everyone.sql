-- Lets people find every account by its whole email address, so typing a
-- friend's address on the Following tab finds them and offers Follow.
--
-- 017_profile_links_and_email_search.sql left accounts made before it out of
-- email search until their owners turned it on, and accounts whose owners
-- unticked sign-up's "Let friends find me" box or switched it off stayed out
-- too. This turns it on for all of them. Owners can still switch it off on
-- their Account page, and new accounts still choose on the sign-up form.
-- Search never shows the address itself.
--
-- Guests (anonymous sessions) stay off. account_id_for_email never finds
-- them anyway.

update public.profiles as p
   set findable_by_email = true
  from auth.users as u
 where u.id = p.id
   and not u.is_anonymous
   and not p.findable_by_email;
