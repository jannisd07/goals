-- Personal coach: cached notification copy plus a hard per-user model budget.
--
-- Both tables are private to the Edge Function. Mobile Data API roles cannot
-- read or write them; the client only ever sees the function's response.

create table if not exists public.coach_nudge_cache (
  user_id uuid primary key
    references auth.users (id) on delete cascade,
  -- Fingerprint of the detected patterns. While it is unchanged the cached
  -- wording stays valid and no model call is made.
  fingerprint text not null
    check (char_length(fingerprint) between 1 and 2000),
  nudges jsonb not null default '[]'::jsonb
    check (jsonb_typeof(nudges) = 'array' and jsonb_array_length(nudges) <= 8),
  -- True when the wording came from the model rather than the deterministic
  -- fallback, so a later run can upgrade fallback copy without re-detecting.
  model_written boolean not null default false,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_nudge_cache enable row level security;
revoke all on table public.coach_nudge_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.coach_nudge_cache to service_role;

create table if not exists public.coach_nudge_limits (
  user_id uuid not null
    references auth.users (id) on delete cascade,
  usage_day date not null,
  model_calls smallint not null
    check (model_calls between 1 and 100),
  primary key (user_id, usage_day)
);

alter table public.coach_nudge_limits enable row level security;
revoke all on table public.coach_nudge_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.coach_nudge_limits to service_role;

-- Counts one model call for today and reports whether it was within budget.
-- Called only immediately before a request is actually sent.
create or replace function public.consume_coach_nudge_quota(
  p_user_id uuid,
  p_limit integer default 1
)
returns table (
  allowed boolean,
  remaining integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (clock_timestamp() at time zone 'utc')::date;
  v_calls integer;
begin
  if p_user_id is null then
    raise exception 'A user id is required.';
  end if;
  if p_limit not between 1 and 20 then
    raise exception 'Coach nudge limit is outside the supported range.';
  end if;

  delete from public.coach_nudge_limits
  where user_id = p_user_id
    and usage_day < v_today;

  insert into public.coach_nudge_limits (user_id, usage_day, model_calls)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_day)
  do update
    set model_calls = public.coach_nudge_limits.model_calls + 1
  returning model_calls into v_calls;

  return query
  select
    v_calls <= p_limit,
    greatest(p_limit - v_calls, 0);
end;
$$;

revoke all on function public.consume_coach_nudge_quota(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.consume_coach_nudge_quota(uuid, integer)
  to service_role;

comment on table public.coach_nudge_cache is
  'Private per-user cache of coach notification copy, keyed by a pattern fingerprint.';
comment on table public.coach_nudge_limits is
  'UTC-day counters capping how often the coach may call the language model per user.';
