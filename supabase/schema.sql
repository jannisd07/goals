-- Goals readable baseline schema.
-- The ordered files in supabase/migrations/ are the authoritative complete
-- state for fresh and existing projects, including production hardening.

create extension if not exists "uuid-ossp";

create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null default '',
  fixed_commitments jsonb not null default '{
    "sleep_hours_per_night": 8,
    "work_hours_per_day": 8,
    "work_days_per_week": 5,
    "daily_overhead_hours": 2
  }'::jsonb,
  onboarding_complete boolean not null default false,
  focus_style text not null default 'interval'
    check (focus_style in ('interval', 'flowtime')),
  friend_code text default null
    constraint users_friend_code_format
    check (
      friend_code is null
      or friend_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
    ),
  default_session_minutes integer not null default 25,
  break_duration_minutes integer not null default 5,
  preferred_ambient_sound text default null,
  ambient_volume real not null default 0.5,
  notification_preferences jsonb not null default '{
    "streakReminder": true,
    "checkinAlerts": true,
    "aiNudges": true,
    "weeklySummary": false
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_users_friend_code
  on public.users(friend_code) where friend_code is not null;

create table if not exists public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('physical', 'focus')),
  category text default null,
  target_sessions_per_week integer not null default 4,
  target_hours_per_week real not null default 10,
  color text not null default 'blue',
  location jsonb default null,
  -- Auto Check-In: visits shorter than this are discarded, never logged.
  min_visit_minutes integer not null default 10,
  pomodoro_duration_minutes integer not null default 25,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_targets_nonnegative check (
    target_sessions_per_week >= 0
    and target_hours_per_week >= 0
    and pomodoro_duration_minutes > 0
  ),
  constraint goals_min_visit_minutes_range check (
    min_visit_minutes between 1 and 240
  )
);

-- The product supports at most one active goal of each type. Inactive history
-- remains valid and a new goal can be created after one is deactivated.
create unique index if not exists idx_goals_one_active_per_type
  on public.goals(user_id, type) where is_active;

create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  goal_id uuid references public.goals(id) on delete cascade not null,
  start_time timestamptz not null default now(),
  end_time timestamptz default null,
  duration_seconds integer not null default 0
    constraint sessions_duration_nonnegative check (duration_seconds >= 0),
  trigger text not null check (trigger in ('geofence', 'manual_checkin', 'manual_pomodoro')),
  rating integer default null check (rating is null or rating between 1 and 5),
  pomodoro_cycles integer not null default 0,
  ambient_sound text default null,
  notes text default null,
  growth_stage integer not null default 0,
  garden_rendered boolean not null default false,
  start_latitude double precision default null,
  start_longitude double precision default null,
  created_at timestamptz not null default now()
);

create table if not exists public.friend_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  friend_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists idx_goals_user_id on public.goals(user_id);
create index if not exists idx_goals_user_active on public.goals(user_id, is_active);
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_goal_id on public.sessions(goal_id);
create index if not exists idx_sessions_start_time on public.sessions(start_time);
create index if not exists idx_sessions_user_time on public.sessions(user_id, start_time);
create index if not exists idx_friend_links_user_id on public.friend_links(user_id);

alter table public.users enable row level security;
alter table public.goals enable row level security;
alter table public.sessions enable row level security;
alter table public.friend_links enable row level security;

create policy "Users can view their own profile"
  on public.users for select using (auth.uid() = id);
create policy "Users can update their own profile"
  on public.users for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can insert their own profile"
  on public.users for insert with check (auth.uid() = id);

create policy "Users can view their own goals"
  on public.goals for select using (auth.uid() = user_id);
create policy "Users can create their own goals"
  on public.goals for insert with check (auth.uid() = user_id);
create policy "Users can update their own goals"
  on public.goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own goals"
  on public.goals for delete using (auth.uid() = user_id);

create policy "Users can view their own sessions"
  on public.sessions for select using (auth.uid() = user_id);
create policy "Users can create their own sessions"
  on public.sessions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.goals
      where goals.id = sessions.goal_id and goals.user_id = auth.uid()
    )
  );
create policy "Users can update their own sessions"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.goals
      where goals.id = sessions.goal_id and goals.user_id = auth.uid()
    )
  );
create policy "Users can delete their own sessions"
  on public.sessions for delete using (auth.uid() = user_id);

create policy "Users can view their own friend links"
  on public.friend_links for select using (auth.uid() = user_id);
create policy "Users can delete their own friend links"
  on public.friend_links for delete using (auth.uid() = user_id);

create or replace function public.add_friend_by_code(code text)
returns table (friend_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.users%rowtype;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select * into target
  from public.users u
  where u.friend_code = upper(trim(code));

  if target.id is null then
    raise exception 'FRIEND_CODE_NOT_FOUND';
  end if;
  if target.id = auth.uid() then
    raise exception 'CANNOT_ADD_SELF';
  end if;

  insert into public.friend_links (user_id, friend_id)
    values (auth.uid(), target.id)
    on conflict (user_id, friend_id) do nothing;
  insert into public.friend_links (user_id, friend_id)
    values (target.id, auth.uid())
    on conflict (user_id, friend_id) do nothing;

  return query select target.id, target.display_name;
end;
$$;

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

create or replace function public.set_my_friend_code(code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  update public.users
  set friend_code = upper(trim(code)), updated_at = now()
  where id = auth.uid() and friend_code is null;
  return (select friend_code from public.users where id = auth.uid());
end;
$$;

create or replace function public.remove_friend(friend uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  delete from public.friend_links
  where
    (user_id = auth.uid() and friend_id = friend)
    or
    (user_id = friend and friend_id = auth.uid());
end;
$$;

revoke all on function public.add_friend_by_code(text) from public;
revoke all on function public.get_friends_weekly(timestamptz, timestamptz) from public;
revoke all on function public.set_my_friend_code(text) from public;
revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.add_friend_by_code(text) to authenticated;
grant execute on function public.get_friends_weekly(timestamptz, timestamptz) to authenticated;
grant execute on function public.set_my_friend_code(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
