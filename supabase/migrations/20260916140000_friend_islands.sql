-- Friends can see each other's island, not just each other's hours.
--
-- The island itself lives in `island_state.objects` as the app's own JSON, and
-- working out an island's size from it means the whole growth model in SQL. So
-- the two numbers a friend is allowed to see are written next to it when the
-- island is saved: how big the island is, and how much of the catalog is grown.
-- Only those two ever leave the account — never what stands on it or where.

alter table public.island_state
  add column if not exists stage smallint not null default 1,
  add column if not exists levels integer not null default 0;

alter table public.island_state
  drop constraint if exists island_stage_range;
alter table public.island_state
  add constraint island_stage_range check (stage between 1 and 5);
alter table public.island_state
  drop constraint if exists island_levels_positive;
alter table public.island_state
  add constraint island_levels_positive check (levels >= 0);

-- The return type grows, so the function has to be dropped rather than replaced.
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
  island_levels integer
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
    coalesce((select i.levels from public.island_state i where i.user_id = u.id), 0)::integer
  from public.friend_links fl
  join public.users u on u.id = fl.friend_id
  where fl.user_id = auth.uid();
end;
$$;

revoke all on function public.get_friends_weekly(timestamptz, timestamptz) from public;
revoke all on function public.get_friends_weekly(timestamptz, timestamptz) from anon;
grant execute on function public.get_friends_weekly(timestamptz, timestamptz) to authenticated;
