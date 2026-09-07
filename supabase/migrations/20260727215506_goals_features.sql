-- Goals feature expansion: focus style, goal categories, session location,
-- friend codes + links (2026-07-27)

-- Focus style chosen in onboarding (interval = classic pomodoro cycles, flowtime = open-ended)
alter table public.users
  add column if not exists focus_style text not null default 'interval'
    check (focus_style in ('interval', 'flowtime'));

-- Friend code for connecting with friends (generated app-side, 6 chars A-Z0-9)
alter table public.users
  add column if not exists friend_code text default null;

create unique index if not exists idx_users_friend_code
  on public.users(friend_code) where friend_code is not null;

-- "What is it for" category key selected via cards in setup (title shown on home card)
alter table public.goals
  add column if not exists category text default null;

-- Session start location (for study-spot detection / location-aware nudges)
alter table public.sessions
  add column if not exists start_latitude double precision default null,
  add column if not exists start_longitude double precision default null;

-- Friend links (one row per direction; add_friend_by_code creates both)
create table if not exists public.friend_links (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  friend_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.friend_links enable row level security;

drop policy if exists "Users can view their own friend links" on public.friend_links;
create policy "Users can view their own friend links"
  on public.friend_links for select
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own friend links" on public.friend_links;
create policy "Users can delete their own friend links"
  on public.friend_links for delete
  using (auth.uid() = user_id);

-- Connect two users via friend code. SECURITY DEFINER so the caller can resolve
-- the code and create the reciprocal row without loosening users/friend_links RLS.
create or replace function public.add_friend_by_code(code text)
returns table (friend_id uuid, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.users%rowtype;
begin
  select * into target from public.users u
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

-- Weekly summary of all friends: only name + this week's aggregate, never raw sessions.
create or replace function public.get_friends_weekly(week_start timestamptz, week_end timestamptz)
returns table (
  friend_id uuid,
  display_name text,
  focus_hours real,
  focus_target_hours real,
  checkins integer,
  checkin_target integer
)
language sql
security definer
set search_path = public
as $$
  select
    u.id as friend_id,
    u.display_name,
    coalesce((
      select sum(s.duration_seconds) / 3600.0
      from public.sessions s
      join public.goals g on g.id = s.goal_id and g.type = 'focus'
      where s.user_id = u.id
        and s.end_time is not null
        and s.start_time >= week_start
        and s.start_time <= week_end
    ), 0)::real as focus_hours,
    coalesce((
      select max(g.target_hours_per_week) from public.goals g
      where g.user_id = u.id and g.type = 'focus' and g.is_active
    ), 0)::real as focus_target_hours,
    coalesce((
      select count(*)
      from public.sessions s
      join public.goals g on g.id = s.goal_id and g.type = 'physical'
      where s.user_id = u.id
        and s.end_time is not null
        and s.start_time >= week_start
        and s.start_time <= week_end
    ), 0)::integer as checkins,
    coalesce((
      select max(g.target_sessions_per_week) from public.goals g
      where g.user_id = u.id and g.type = 'physical' and g.is_active
    ), 0)::integer as checkin_target
  from public.friend_links fl
  join public.users u on u.id = fl.friend_id
  where fl.user_id = auth.uid();
$$;

-- Claim a friend code for the current user (retries handled app-side on conflict)
create or replace function public.set_my_friend_code(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set friend_code = upper(trim(code)), updated_at = now()
    where id = auth.uid() and friend_code is null;
  return (select friend_code from public.users where id = auth.uid());
end;
$$;
