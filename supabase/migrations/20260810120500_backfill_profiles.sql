-- Backfill profiles for users who already existed.
--
-- public.handle_new_user() only fires on INSERT into auth.users, so anyone who
-- signed up before this schema was applied has no profiles row. Every
-- broker-owned table has a NOT NULL foreign key to profiles, so their first
-- save would fail on a constraint violation with nothing useful to go on.
--
-- Idempotent, and safe to re-run: ON CONFLICT DO NOTHING leaves existing
-- profiles untouched, and anonymous users are skipped exactly as the trigger
-- skips them -- a guest must never acquire a profile, because the absence of
-- one is part of what keeps them out of broker-owned data.

insert into public.profiles (id, email, full_name)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name'
  )
from auth.users u
where u.is_anonymous is not true
on conflict (id) do nothing;
