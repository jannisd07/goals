-- Superseded by 20260728174705_production_backend.sql.
-- Removing a friendship must remove both reciprocal rows created by
-- add_friend_by_code. Direct client-side DELETE can only see the caller's row
-- under RLS and otherwise leaves the other user connected indefinitely.
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

revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;

-- SECURITY DEFINER functions must never inherit PostgreSQL's default PUBLIC
-- execute grant. Only signed-in app users may call friendship RPCs.
revoke all on function public.add_friend_by_code(text) from public;
revoke all on function public.get_friends_weekly(timestamptz, timestamptz) from public;
revoke all on function public.set_my_friend_code(text) from public;
alter function public.add_friend_by_code(text) set search_path = '';
alter function public.get_friends_weekly(timestamptz, timestamptz) set search_path = '';
alter function public.set_my_friend_code(text) set search_path = '';
grant execute on function public.add_friend_by_code(text) to authenticated;
grant execute on function public.get_friends_weekly(timestamptz, timestamptz) to authenticated;
grant execute on function public.set_my_friend_code(text) to authenticated;

-- A session may only reference one of the caller's own goals. Checking user_id
-- alone would let a guessed foreign goal UUID be attached to the caller's data.
drop policy if exists "Users can create their own sessions" on public.sessions;
create policy "Users can create their own sessions"
  on public.sessions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.goals
      where goals.id = sessions.goal_id and goals.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own sessions" on public.sessions;
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

-- Keep app-side assumptions true even for direct API callers.
alter table public.users
  drop constraint if exists users_friend_code_format;
alter table public.users
  add constraint users_friend_code_format
  check (
    friend_code is null
    or friend_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
  );

alter table public.sessions
  drop constraint if exists sessions_duration_nonnegative;
alter table public.sessions
  add constraint sessions_duration_nonnegative
  check (duration_seconds >= 0);

alter table public.goals
  drop constraint if exists goals_targets_nonnegative;
alter table public.goals
  add constraint goals_targets_nonnegative
  check (
    target_sessions_per_week >= 0
    and target_hours_per_week >= 0
    and pomodoro_duration_minutes > 0
  );
