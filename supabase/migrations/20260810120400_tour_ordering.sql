-- Reordering an itinerary.
--
-- tour_stops.position is unique per tour, so moving a stop by writing rows one
-- at a time collides with whatever currently holds the target position. The
-- unique constraint is DEFERRABLE INITIALLY DEFERRED precisely so the whole new
-- order can be written in a single statement and checked once at commit.
--
-- SECURITY INVOKER: the tour_stops policies are what authorise this, so a
-- broker can only ever resequence their own tour.

create or replace function public.reorder_tour_stops(
  p_tour_id uuid,
  p_stop_ids uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_updated integer;
  v_total integer;
begin
  select count(*) into v_total
  from public.tour_stops
  where tour_id = p_tour_id;

  if v_total <> coalesce(array_length(p_stop_ids, 1), 0) then
    raise exception 'reorder must list every stop on the tour (% given, % on tour)',
      coalesce(array_length(p_stop_ids, 1), 0), v_total
      using errcode = '22023';
  end if;

  update public.tour_stops s
  set position = ordered.ord
  from unnest(p_stop_ids) with ordinality as ordered(stop_id, ord)
  where s.id = ordered.stop_id
    and s.tour_id = p_tour_id;

  get diagnostics v_updated = row_count;

  -- A stop id from another tour (or one RLS hides) simply matches nothing, so
  -- compare counts rather than trusting the input.
  if v_updated <> v_total then
    raise exception 'reorder did not match every stop on the tour'
      using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.reorder_tour_stops(uuid, uuid[]) from public;
grant execute on function public.reorder_tour_stops(uuid, uuid[]) to authenticated;

-- Next free position on a tour, so adding a stop does not need a round trip.
create or replace function public.next_stop_position(p_tour_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(max(position), 0) + 1
  from public.tour_stops
  where tour_id = p_tour_id;
$$;

revoke execute on function public.next_stop_position(uuid) from public;
grant execute on function public.next_stop_position(uuid) to authenticated;
