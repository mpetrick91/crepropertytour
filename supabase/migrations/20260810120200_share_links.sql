-- Share links: how a client gets onto a tour without ever creating an account.
--
-- Flow:
--   1. Broker creates a share  -> public.create_tour_share() returns a token.
--   2. Client opens /t/<token> -> public.preview_tour_share() renders the tour
--                                 header for an unauthenticated visitor.
--   3. Client enters their name -> the browser does an anonymous sign-in, then
--                                 calls public.join_tour(), which trades the
--                                 token for a tour_participants row.
--   4. From then on the guest is an ordinary authenticated user and every read
--      and write is governed by the RLS policies, not by the token.

-- URL-safe random token. 24 bytes of entropy, base64url, no padding.
create or replace function public.generate_share_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select rtrim(
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
    '='
  );
$$;

alter table public.tour_shares
  alter column token set default public.generate_share_token();

-- A share is redeemable only while it is neither revoked nor expired.
create or replace function public.share_is_active(s public.tour_shares)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select s.revoked_at is null
     and (s.expires_at is null or s.expires_at > now());
$$;

-- ---------------------------------------------------------------------------
-- create_tour_share -- broker-only. Runs as invoker so the tour_shares RLS
-- policy is what actually authorises it.
-- ---------------------------------------------------------------------------

create or replace function public.create_tour_share(
  p_tour_id uuid,
  p_label text default null,
  p_allow_notes boolean default true,
  p_allow_photos boolean default true,
  p_expires_at timestamptz default null
)
returns public.tour_shares
language plpgsql
set search_path = ''
as $$
declare
  v_share public.tour_shares;
begin
  insert into public.tour_shares (
    tour_id, token, label, allow_notes, allow_photos, expires_at, created_by
  )
  values (
    p_tour_id,
    public.generate_share_token(),
    nullif(trim(coalesce(p_label, '')), ''),
    p_allow_notes,
    p_allow_photos,
    p_expires_at,
    (select auth.uid())
  )
  returning * into v_share;

  return v_share;
end;
$$;

-- ---------------------------------------------------------------------------
-- preview_tour_share -- the only thing an unauthenticated visitor may call.
-- Returns just enough to render "You've been invited to tour 3 buildings in
-- Columbus on Aug 14", and never leaks the token back or anything internal.
-- ---------------------------------------------------------------------------

create type public.tour_share_preview as (
  valid boolean,
  reason text,
  tour_id uuid,
  tour_title text,
  tour_date date,
  start_time time,
  market text,
  stop_count integer,
  broker_name text,
  broker_company text,
  allow_notes boolean,
  allow_photos boolean
);

create or replace function public.preview_tour_share(p_token text)
returns public.tour_share_preview
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_share public.tour_shares;
  v_tour public.tours;
  v_profile public.profiles;
  v_result public.tour_share_preview;
begin
  select * into v_share
  from public.tour_shares
  where token = p_token;

  if not found then
    return (false, 'not_found', null, null, null, null, null, null, null, null, null, null)::public.tour_share_preview;
  end if;

  if v_share.revoked_at is not null then
    return (false, 'revoked', null, null, null, null, null, null, null, null, null, null)::public.tour_share_preview;
  end if;

  if v_share.expires_at is not null and v_share.expires_at <= now() then
    return (false, 'expired', null, null, null, null, null, null, null, null, null, null)::public.tour_share_preview;
  end if;

  select * into v_tour from public.tours where id = v_share.tour_id;
  select * into v_profile from public.profiles where id = v_tour.broker_id;

  v_result := (
    true,
    null,
    v_tour.id,
    v_tour.title,
    v_tour.tour_date,
    v_tour.start_time,
    v_tour.market,
    (select count(*)::integer from public.tour_stops s where s.tour_id = v_tour.id),
    v_profile.full_name,
    v_profile.company,
    v_share.allow_notes,
    v_share.allow_photos
  )::public.tour_share_preview;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_tour -- trades a valid token for a participant row on the caller's
-- current (usually anonymous) identity. Idempotent: reopening the link on the
-- same device returns the existing participant instead of duplicating it.
-- ---------------------------------------------------------------------------

create type public.tour_join_result as (
  tour_id uuid,
  participant_id uuid,
  display_name text,
  role public.participant_role,
  can_add_notes boolean,
  can_add_photos boolean
);

create or replace function public.join_tour(
  p_token text,
  p_display_name text,
  p_company text default null
)
returns public.tour_join_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_share public.tour_shares;
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
  v_participant public.tour_participants;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if v_name is null then
    raise exception 'display name is required' using errcode = '22023';
  end if;

  select * into v_share
  from public.tour_shares
  where token = p_token;

  if not found or not public.share_is_active(v_share) then
    raise exception 'this tour link is no longer valid' using errcode = '42501';
  end if;

  select * into v_participant
  from public.tour_participants
  where tour_id = v_share.tour_id
    and user_id = v_uid;

  if found then
    -- Already on the tour (broker reopening their own link, or a guest coming
    -- back). Refresh their name but never escalate or downgrade their role.
    update public.tour_participants
    set display_name = v_name,
        company = coalesce(nullif(trim(coalesce(p_company, '')), ''), company),
        removed_at = null
    where id = v_participant.id
    returning * into v_participant;
  else
    insert into public.tour_participants (
      tour_id, user_id, share_id, role, display_name, company,
      can_add_notes, can_add_photos
    )
    values (
      v_share.tour_id,
      v_uid,
      v_share.id,
      'guest',
      v_name,
      nullif(trim(coalesce(p_company, '')), ''),
      v_share.allow_notes,
      v_share.allow_photos
    )
    returning * into v_participant;
  end if;

  return (
    v_participant.tour_id,
    v_participant.id,
    v_participant.display_name,
    v_participant.role,
    v_participant.can_add_notes,
    v_participant.can_add_photos
  )::public.tour_join_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants. Default is EXECUTE to PUBLIC, which would hand anonymous
-- visitors the SECURITY DEFINER helpers -- so revoke first, then grant narrowly.
-- ---------------------------------------------------------------------------

revoke execute on function public.generate_share_token() from public;
revoke execute on function public.share_is_active(public.tour_shares) from public;
revoke execute on function public.create_tour_share(uuid, text, boolean, boolean, timestamptz) from public;
revoke execute on function public.preview_tour_share(text) from public;
revoke execute on function public.join_tour(text, text, text) from public;
revoke execute on function public.is_tour_owner(uuid) from public;
revoke execute on function public.is_tour_participant(uuid) from public;
revoke execute on function public.current_participant_id(uuid) from public;
revoke execute on function public.can_contribute(uuid, text) from public;

grant execute on function public.create_tour_share(uuid, text, boolean, boolean, timestamptz) to authenticated;
grant execute on function public.join_tour(text, text, text) to authenticated;

-- The RLS policies call these, and a policy's function calls are permission
-- checked against the invoking role -- so `authenticated` needs EXECUTE or
-- every policied query fails. They only ever report on the caller's own
-- access, so granting them is not a disclosure.
grant execute on function public.is_tour_owner(uuid) to authenticated;
grant execute on function public.is_tour_participant(uuid) to authenticated;
grant execute on function public.current_participant_id(uuid) to authenticated;
grant execute on function public.can_contribute(uuid, text) to authenticated;

-- The one call an unauthenticated visitor is allowed to make.
grant execute on function public.preview_tour_share(text) to anon, authenticated;
