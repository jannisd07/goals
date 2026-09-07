-- Allow an explicit foreground fallback when background geofencing is
-- unavailable or when the user wants to end an active visit immediately.

alter table public.sessions
  drop constraint if exists sessions_trigger_check;

alter table public.sessions
  add constraint sessions_trigger_check
  check (trigger in ('geofence', 'manual_checkin', 'manual_pomodoro'));

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
  if new.trigger in ('geofence', 'manual_checkin') and linked_goal_type <> 'physical' then
    raise exception 'SESSION_TRIGGER_GOAL_MISMATCH';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_session_goal_type()
  from public, anon, authenticated;

comment on column public.sessions.trigger is
  'geofence and manual_checkin belong to physical goals; manual_pomodoro belongs to focus goals.';
