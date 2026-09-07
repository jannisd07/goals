-- Superseded by 20260728174705_production_backend.sql.
-- Keep the app's one-focus-goal + one-auto-check-in-goal model enforceable
-- under concurrent requests, not only through client-side checks.
-- Older app versions could create duplicates. Preserve every goal and its
-- sessions, but deactivate all except the most recently updated active goal
-- of each type before adding the partial unique index.
with ranked_active_goals as (
  select
    id,
    row_number() over (
      partition by user_id, type
      order by updated_at desc, created_at desc, id desc
    ) as active_rank
  from public.goals
  where is_active
)
update public.goals as goals
set is_active = false, updated_at = now()
from ranked_active_goals
where goals.id = ranked_active_goals.id
  and ranked_active_goals.active_rank > 1;

create unique index if not exists idx_goals_one_active_per_type
  on public.goals(user_id, type) where is_active;

-- Connected friends intentionally share one week's aggregate only. Validate
-- the caller-provided window so the SECURITY DEFINER RPC cannot be repurposed
-- to request an arbitrarily large slice of another user's history.
create or replace function public.get_friends_weekly(
  week_start timestamptz,
  week_end timestamptz
)
returns table (
  friend_id uuid,
  display_name text,
  focus_hours real,
  focus_target_hours real,
  checkins integer,
  checkin_target integer
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
    ), 0)::integer
  from public.friend_links fl
  join public.users u on u.id = fl.friend_id
  where fl.user_id = auth.uid();
end;
$$;

revoke all on function public.get_friends_weekly(timestamptz, timestamptz) from public;
grant execute on function public.get_friends_weekly(timestamptz, timestamptz) to authenticated;
