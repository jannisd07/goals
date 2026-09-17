-- Visiting a friend's island, and a clearer set of numbers next to their name.
--
-- Two changes:
--
--   * `get_friends_weekly` also returns all-time hours, so the list can show the
--     week and the whole story side by side.
--   * `get_friend_island` hands over what stands on a friend's island so it can
--     be drawn. This is a deliberate widening of what leaves an account: until
--     now only the island's size travelled. It is guarded by the friend link —
--     only someone the owner has as a friend can read it — and it carries no
--     sessions, no goals and no times, just the objects and where they stand.

drop function if exists public.get_friends_weekly(timestamptz, timestamptz);

create function public.get_friends_weekly(
  week_start timestamptz,
  week_end timestamptz
)
returns table (
  friend_id uuid,
  display_name text,
  focus_hours real,
  focus_target_hours real,
  checkins integer,
  checkin_target integer,
  island_stage smallint,
  island_levels integer,
  total_hours real
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if week_end <= week_start or week_end - week_start > interval '8 days' then
    raise exception 'INVALID_WEEK_RANGE';
  end if;

  return query
  select
    u.id,
    u.display_name,
    coalesce((
      select sum(s.duration_seconds) / 3600.0
      from public.sessions s
      join public.goals g on g.id = s.goal_id and g.type = 'focus'
      where s.user_id = u.id
        and s.end_time is not null
        and s.start_time >= week_start
        and s.start_time <= week_end
    ), 0)::real,
    coalesce((
      select max(g.target_hours_per_week)
      from public.goals g
      where g.user_id = u.id and g.type = 'focus' and g.is_active
    ), 0)::real,
    coalesce((
      select count(*)
      from public.sessions s
      join public.goals g on g.id = s.goal_id and g.type = 'physical'
      where s.user_id = u.id
        and s.end_time is not null
        and s.start_time >= week_start
        and s.start_time <= week_end
    ), 0)::integer,
    coalesce((
      select max(g.target_sessions_per_week)
      from public.goals g
      where g.user_id = u.id and g.type = 'physical' and g.is_active
    ), 0)::integer,
    coalesce((select i.stage from public.island_state i where i.user_id = u.id), 1)::smallint,
    coalesce((select i.levels from public.island_state i where i.user_id = u.id), 0)::integer,
    coalesce((
      select sum(s.duration_seconds) / 3600.0
      from public.sessions s
      where s.user_id = u.id and s.end_time is not null
    ), 0)::real
  from public.friend_links fl
  join public.users u on u.id = fl.friend_id
  where fl.user_id = auth.uid();
end;
$$;

revoke all on function public.get_friends_weekly(timestamptz, timestamptz) from public;
revoke all on function public.get_friends_weekly(timestamptz, timestamptz) from anon;
grant execute on function public.get_friends_weekly(timestamptz, timestamptz) to authenticated;

create or replace function public.get_friend_island(friend uuid)
returns table (
  stage smallint,
  levels integer,
  objects jsonb,
  spots jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  -- Only a friend may look, and only in the direction the link points.
  if not exists (
    select 1 from public.friend_links fl
    where fl.user_id = auth.uid() and fl.friend_id = friend
  ) then
    raise exception 'NOT_A_FRIEND';
  end if;

  return query
  select i.stage, i.levels, i.objects, i.spots
  from public.island_state i
  where i.user_id = friend;
end;
$$;

revoke all on function public.get_friend_island(uuid) from public;
revoke all on function public.get_friend_island(uuid) from anon;
grant execute on function public.get_friend_island(uuid) to authenticated;
