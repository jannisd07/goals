-- VibeTime Database Schema
-- Run this in your Supabase SQL Editor to create all required tables

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Users table
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Goals table
create table if not exists public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('physical', 'focus')),
  target_sessions_per_week integer not null default 4,
  target_hours_per_week real not null default 10,
  color text not null default 'blue',
  location jsonb default null,
  pomodoro_duration_minutes integer not null default 25,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sessions table
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  goal_id uuid references public.goals(id) on delete cascade not null,
  start_time timestamptz not null default now(),
  end_time timestamptz default null,
  duration_seconds integer not null default 0,
  trigger text not null check (trigger in ('geofence', 'manual_pomodoro')),
  rating integer default null check (rating is null or (rating >= 1 and rating <= 5)),
  pomodoro_cycles integer not null default 0,
  ambient_sound text default null,
  notes text default null,
  growth_stage integer not null default 0,
  garden_rendered boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.sessions
  add column if not exists garden_rendered boolean not null default false;

-- Indexes for performance
create index if not exists idx_goals_user_id on public.goals(user_id);
create index if not exists idx_goals_user_active on public.goals(user_id, is_active);
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_goal_id on public.sessions(goal_id);
create index if not exists idx_sessions_start_time on public.sessions(start_time);
create index if not exists idx_sessions_user_time on public.sessions(user_id, start_time);

-- Row Level Security
alter table public.users enable row level security;
alter table public.goals enable row level security;
alter table public.sessions enable row level security;

-- Users RLS policies
drop policy if exists "Users can view their own profile" on public.users;
create policy "Users can view their own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- Goals RLS policies
drop policy if exists "Users can view their own goals" on public.goals;
create policy "Users can view their own goals"
  on public.goals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own goals" on public.goals;
create policy "Users can create their own goals"
  on public.goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own goals" on public.goals;
create policy "Users can update their own goals"
  on public.goals for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own goals" on public.goals;
create policy "Users can delete their own goals"
  on public.goals for delete
  using (auth.uid() = user_id);

-- Sessions RLS policies
drop policy if exists "Users can view their own sessions" on public.sessions;
create policy "Users can view their own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own sessions" on public.sessions;
create policy "Users can create their own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own sessions" on public.sessions;
create policy "Users can update their own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own sessions" on public.sessions;
create policy "Users can delete their own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);
