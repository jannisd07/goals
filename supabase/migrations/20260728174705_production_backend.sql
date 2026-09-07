-- Production backend hardening for Goals.
-- Covers profile creation, cross-device preferences, relational integrity,
-- explicit Data API grants, ownership-scoped RLS and private friend RPC logic.

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Profiles and cross-device preferences
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists default_session_minutes integer not null default 25,
  add column if not exists break_duration_minutes integer not null default 5,
  add column if not exists preferred_ambient_sound text default null,
  add column if not exists ambient_volume real not null default 0.5,
  add column if not exists notification_preferences jsonb not null default '{
    "streakReminder": true,
    "checkinAlerts": true,
    "aiNudges": true,
    "weeklySummary": false
  }'::jsonb;

-- Auth is the source of truth for email. The public profile deliberately does
-- not duplicate email addresses. Backfill any auth accounts created before the
-- trigger existed, then create every future profile atomically on signup.
insert into public.users (id, display_name)
select
  account.id,
  left(
    coalesce(
      nullif(trim(account.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(account.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(account.email, ''), '@', 1), ''),
      'there'
    ),
    80
  )
from auth.users as account
on conflict (id) do nothing;

update public.users as profile
set display_name = left(
  coalesce(
    nullif(trim(account.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(account.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(account.email, ''), '@', 1), ''),
    'there'
  ),
  80
)
from auth.users as account
where account.id = profile.id
  and length(trim(profile.display_name)) not between 1 and 80;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'there'
      ),
      80
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function private.set_updated_at();

drop trigger if exists goals_set_updated_at on public.goals;
create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Domain constraints
-- ---------------------------------------------------------------------------

alter table public.users
  drop constraint if exists users_display_name_valid,
  add constraint users_display_name_valid
    check (length(trim(display_name)) between 1 and 80),
  drop constraint if exists users_default_session_minutes_valid,
  add constraint users_default_session_minutes_valid
    check (default_session_minutes between 5 and 240),
  drop constraint if exists users_break_duration_minutes_valid,
  add constraint users_break_duration_minutes_valid
    check (break_duration_minutes between 1 and 60),
  drop constraint if exists users_preferred_ambient_sound_valid,
  add constraint users_preferred_ambient_sound_valid
    check (
      preferred_ambient_sound is null
      or preferred_ambient_sound in ('rain', 'cafe', 'white_noise', 'forest', 'lofi')
    ),
  drop constraint if exists users_ambient_volume_valid,
  add constraint users_ambient_volume_valid
    check (ambient_volume between 0 and 1),
  drop constraint if exists users_fixed_commitments_valid,
  add constraint users_fixed_commitments_valid
    check (
      jsonb_typeof(fixed_commitments) = 'object'
      and jsonb_typeof(fixed_commitments -> 'sleep_hours_per_night') = 'number'
      and (fixed_commitments ->> 'sleep_hours_per_night')::numeric between 0 and 24
      and jsonb_typeof(fixed_commitments -> 'work_hours_per_day') = 'number'
      and (fixed_commitments ->> 'work_hours_per_day')::numeric between 0 and 24
      and jsonb_typeof(fixed_commitments -> 'work_days_per_week') = 'number'
      and (fixed_commitments ->> 'work_days_per_week')::numeric between 0 and 7
      and jsonb_typeof(fixed_commitments -> 'daily_overhead_hours') = 'number'
      and (fixed_commitments ->> 'daily_overhead_hours')::numeric between 0 and 24
    ),
  drop constraint if exists users_notification_preferences_valid,
  add constraint users_notification_preferences_valid
    check (
      jsonb_typeof(notification_preferences) = 'object'
      and jsonb_typeof(notification_preferences -> 'streakReminder') = 'boolean'
      and jsonb_typeof(notification_preferences -> 'checkinAlerts') = 'boolean'
      and jsonb_typeof(notification_preferences -> 'aiNudges') = 'boolean'
      and jsonb_typeof(notification_preferences -> 'weeklySummary') = 'boolean'
    ),
  drop constraint if exists users_friend_code_format,
  add constraint users_friend_code_format
    check (
      friend_code is null
      or friend_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
    );

alter table public.goals
  drop constraint if exists goals_name_valid,
  add constraint goals_name_valid
    check (length(trim(name)) between 1 and 80),
  drop constraint if exists goals_targets_nonnegative,
  add constraint goals_targets_nonnegative
    check (
      target_sessions_per_week between 0 and 50
      and target_hours_per_week between 0 and 168
      and pomodoro_duration_minutes between 1 and 240
    ),
  drop constraint if exists goals_color_valid,
  add constraint goals_color_valid
    check (color in ('blue', 'purple', 'green', 'orange', 'pink', 'cyan', 'red', 'yellow')),
  drop constraint if exists goals_location_valid,
  add constraint goals_location_valid
    check (
      (
        type = 'focus'
        and location is null
      )
      or
      (
        type = 'physical'
        and jsonb_typeof(location) = 'object'
        and jsonb_typeof(location -> 'latitude') = 'number'
        and (location ->> 'latitude')::double precision between -90 and 90
        and jsonb_typeof(location -> 'longitude') = 'number'
        and (location ->> 'longitude')::double precision between -180 and 180
        and jsonb_typeof(location -> 'radius_meters') = 'number'
        and (location ->> 'radius_meters')::double precision between 10 and 1000
        and jsonb_typeof(location -> 'address') = 'string'
        and length(trim(location ->> 'address')) between 1 and 300
      )
    );

alter table public.sessions
  drop constraint if exists sessions_duration_nonnegative,
  add constraint sessions_duration_nonnegative
    check (duration_seconds between 0 and 604800),
  drop constraint if exists sessions_end_time_valid,
  add constraint sessions_end_time_valid
    check (end_time is null or end_time >= start_time),
  drop constraint if exists sessions_pomodoro_cycles_valid,
  add constraint sessions_pomodoro_cycles_valid
    check (pomodoro_cycles between 0 and 10000),
  drop constraint if exists sessions_growth_stage_valid,
  add constraint sessions_growth_stage_valid
    check (growth_stage between 0 and 4),
  drop constraint if exists sessions_rating_requires_completion,
  add constraint sessions_rating_requires_completion
    check (rating is null or end_time is not null),
  drop constraint if exists sessions_ambient_sound_valid,
  add constraint sessions_ambient_sound_valid
    check (
      ambient_sound is null
      or ambient_sound in ('rain', 'cafe', 'white_noise', 'forest', 'lofi')
    ),
  drop constraint if exists sessions_notes_length_valid,
  add constraint sessions_notes_length_valid
    check (notes is null or length(notes) <= 2000),
  drop constraint if exists sessions_coordinates_valid,
  add constraint sessions_coordinates_valid
    check (
      (start_latitude is null and start_longitude is null)
      or
      (
        start_latitude between -90 and 90
        and start_longitude between -180 and 180
      )
    );

-- Ownership is also enforced structurally, not only by RLS. A session cannot
-- point at another account's goal even through privileged server code.
alter table public.goals
  drop constraint if exists goals_id_user_id_key,
  add constraint goals_id_user_id_key unique (id, user_id);

alter table public.sessions
  drop constraint if exists sessions_goal_id_fkey,
  drop constraint if exists sessions_goal_owner_fkey,
  add constraint sessions_goal_owner_fkey
    foreign key (goal_id, user_id)
    references public.goals (id, user_id)
    on delete cascade;

create or replace function private.validate_session_goal_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_goal_type text;
begin
  select goal.type
  into linked_goal_type
  from public.goals as goal
  where goal.id = new.goal_id
    and goal.user_id = new.user_id;

  if linked_goal_type is null then
    raise exception 'SESSION_GOAL_NOT_FOUND';
  end if;
  if new.trigger = 'manual_pomodoro' and linked_goal_type <> 'focus' then
    raise exception 'SESSION_TRIGGER_GOAL_MISMATCH';
  end if;
  if new.trigger = 'geofence' and linked_goal_type <> 'physical' then
    raise exception 'SESSION_TRIGGER_GOAL_MISMATCH';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_session_goal_type() from public, anon, authenticated;

drop trigger if exists sessions_validate_goal_type on public.sessions;
create trigger sessions_validate_goal_type
  before insert or update of user_id, goal_id, trigger on public.sessions
  for each row execute function private.validate_session_goal_type();

-- Keep one active goal per supported feature after cleaning any legacy
-- duplicates without deleting their history.
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
update public.goals as goal
set is_active = false
from ranked_active_goals
where goal.id = ranked_active_goals.id
  and ranked_active_goals.active_rank > 1;

create unique index if not exists idx_goals_one_active_per_type
  on public.goals(user_id, type)
  where is_active;

create unique index if not exists idx_users_friend_code
  on public.users(friend_code)
  where friend_code is not null;

create index if not exists idx_friend_links_friend_id
  on public.friend_links(friend_id);

drop index if exists public.idx_sessions_user_id;
drop index if exists public.idx_sessions_start_time;
drop index if exists public.idx_sessions_goal_id;

create index if not exists idx_sessions_user_completed_time
  on public.sessions(user_id, start_time desc)
  where end_time is not null;

create index if not exists idx_sessions_goal_completed_time
  on public.sessions(goal_id, start_time desc)
  where end_time is not null;

-- ---------------------------------------------------------------------------
-- Ownership-scoped RLS
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.goals enable row level security;
alter table public.sessions enable row level security;
alter table public.friend_links enable row level security;

drop policy if exists "Users can view their own profile" on public.users;
drop policy if exists "Users can insert their own profile" on public.users;
drop policy if exists "Users can update their own profile" on public.users;

create policy "Users can view their own profile"
  on public.users for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can insert their own profile"
  on public.users for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.users for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view their own goals" on public.goals;
drop policy if exists "Users can create their own goals" on public.goals;
drop policy if exists "Users can update their own goals" on public.goals;
drop policy if exists "Users can delete their own goals" on public.goals;

create policy "Users can view their own goals"
  on public.goals for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own goals"
  on public.goals for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own goals"
  on public.goals for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own goals"
  on public.goals for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own sessions" on public.sessions;
drop policy if exists "Users can create their own sessions" on public.sessions;
drop policy if exists "Users can update their own sessions" on public.sessions;
drop policy if exists "Users can delete their own sessions" on public.sessions;

create policy "Users can view their own sessions"
  on public.sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own sessions"
  on public.sessions for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.goals as goal
      where goal.id = sessions.goal_id
        and goal.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own sessions"
  on public.sessions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.goals as goal
      where goal.id = sessions.goal_id
        and goal.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own sessions"
  on public.sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view their own friend links" on public.friend_links;
drop policy if exists "Users can delete their own friend links" on public.friend_links;

create policy "Users can view their own friend links"
  on public.friend_links for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete their own friend links"
  on public.friend_links for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Explicit Data API privileges. An unauthenticated client can access Auth but
-- cannot discover or touch app data. Signed-in clients receive only the table
-- and column operations used by the application.
revoke all privileges on table public.users from anon, authenticated;
revoke all privileges on table public.goals from anon, authenticated;
revoke all privileges on table public.sessions from anon, authenticated;
revoke all privileges on table public.friend_links from anon, authenticated;

grant select, insert on table public.users to authenticated;
grant update (
  display_name,
  fixed_commitments,
  onboarding_complete,
  focus_style,
  default_session_minutes,
  break_duration_minutes,
  preferred_ambient_sound,
  ambient_volume,
  notification_preferences,
  updated_at
) on table public.users to authenticated;

grant select, insert, delete on table public.goals to authenticated;
grant update (
  name,
  type,
  category,
  target_sessions_per_week,
  target_hours_per_week,
  color,
  location,
  pomodoro_duration_minutes,
  is_active,
  updated_at
) on table public.goals to authenticated;

grant select, insert, delete on table public.sessions to authenticated;
grant update (
  end_time,
  duration_seconds,
  rating,
  pomodoro_cycles,
  ambient_sound,
  notes,
  growth_stage,
  garden_rendered
) on table public.sessions to authenticated;

grant select on table public.friend_links to authenticated;

-- ---------------------------------------------------------------------------
-- Friends API
-- Privileged implementations remain outside the exposed Data API schema.
-- Public RPC wrappers are SECURITY INVOKER and callable only after sign-in.
-- ---------------------------------------------------------------------------

create or replace function private.set_my_friend_code(code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(trim(code));
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if normalized_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'INVALID_FRIEND_CODE';
  end if;

  update public.users
  set friend_code = normalized_code
  where id = auth.uid()
    and friend_code is null;

  return (
    select profile.friend_code
    from public.users as profile
    where profile.id = auth.uid()
  );
exception
  when unique_violation then
    raise exception 'FRIEND_CODE_TAKEN';
end;
$$;

create or replace function private.add_friend_by_code(code text)
returns table (friend_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target public.users%rowtype;
begin
  if caller_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select profile.*
  into target
  from public.users as profile
  where profile.friend_code = upper(trim(code));

  if target.id is null then
    raise exception 'FRIEND_CODE_NOT_FOUND';
  end if;
  if target.id = caller_id then
    raise exception 'CANNOT_ADD_SELF';
  end if;

  insert into public.friend_links (user_id, friend_id)
  values (caller_id, target.id)
  on conflict (user_id, friend_id) do nothing;

  insert into public.friend_links (user_id, friend_id)
  values (target.id, caller_id)
  on conflict (user_id, friend_id) do nothing;

  return query
  select target.id, target.display_name;
end;
$$;

create or replace function private.remove_friend(friend uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  delete from public.friend_links
  where
    (user_id = caller_id and friend_id = friend)
    or
    (user_id = friend and friend_id = caller_id);
end;
$$;

create or replace function private.get_friends_weekly(
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
declare
  caller_id uuid := auth.uid();
  current_week timestamptz := date_trunc('week', now());
begin
  if caller_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if week_end <= week_start
    or week_end - week_start > interval '8 days'
    or week_start < current_week - interval '1 day'
    or week_end > current_week + interval '8 days'
  then
    raise exception 'INVALID_WEEK_RANGE';
  end if;

  return query
  select
    profile.id,
    profile.display_name,
    coalesce((
      select sum(session.duration_seconds) / 3600.0
      from public.sessions as session
      join public.goals as goal
        on goal.id = session.goal_id
       and goal.type = 'focus'
      where session.user_id = profile.id
        and session.end_time is not null
        and session.start_time >= week_start
        and session.start_time <= week_end
    ), 0)::real,
    coalesce((
      select max(goal.target_hours_per_week)
      from public.goals as goal
      where goal.user_id = profile.id
        and goal.type = 'focus'
        and goal.is_active
    ), 0)::real,
    coalesce((
      select count(*)
      from public.sessions as session
      join public.goals as goal
        on goal.id = session.goal_id
       and goal.type = 'physical'
      where session.user_id = profile.id
        and session.end_time is not null
        and session.start_time >= week_start
        and session.start_time <= week_end
    ), 0)::integer,
    coalesce((
      select max(goal.target_sessions_per_week)
      from public.goals as goal
      where goal.user_id = profile.id
        and goal.type = 'physical'
        and goal.is_active
    ), 0)::integer
  from public.friend_links as link
  join public.users as profile
    on profile.id = link.friend_id
  where link.user_id = caller_id;
end;
$$;

revoke all on function private.set_my_friend_code(text) from public, anon;
revoke all on function private.add_friend_by_code(text) from public, anon;
revoke all on function private.remove_friend(uuid) from public, anon;
revoke all on function private.get_friends_weekly(timestamptz, timestamptz) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.set_my_friend_code(text) to authenticated;
grant execute on function private.add_friend_by_code(text) to authenticated;
grant execute on function private.remove_friend(uuid) to authenticated;
grant execute on function private.get_friends_weekly(timestamptz, timestamptz) to authenticated;

create or replace function public.set_my_friend_code(code text)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.set_my_friend_code($1);
$$;

create or replace function public.add_friend_by_code(code text)
returns table (friend_id uuid, display_name text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.add_friend_by_code($1);
$$;

create or replace function public.remove_friend(friend uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.remove_friend($1);
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
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_friends_weekly($1, $2);
$$;

revoke all on function public.set_my_friend_code(text) from public, anon;
revoke all on function public.add_friend_by_code(text) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.get_friends_weekly(timestamptz, timestamptz) from public, anon;

grant execute on function public.set_my_friend_code(text) to authenticated;
grant execute on function public.add_friend_by_code(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.get_friends_weekly(timestamptz, timestamptz) to authenticated;

comment on table public.users is
  'Private per-account profile and cross-device preferences. Email remains in auth.users.';
comment on table public.goals is
  'Owned focus and geofenced Auto Check-In goals; at most one active goal per type.';
comment on table public.sessions is
  'Owned completed or in-progress focus/geofence sessions powering progress, analytics and Grove.';
comment on table public.friend_links is
  'Reciprocal private friendship edges. Only weekly aggregates are shared through RPC.';
