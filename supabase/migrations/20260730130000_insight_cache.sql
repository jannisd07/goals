-- Private server-side cache and manual-refresh quota for Stats insights.
-- Mobile Data API roles cannot read or mutate either table.

create table public.insight_cache (
  user_id uuid primary key
    references auth.users (id) on delete cascade,
  insight text not null
    check (char_length(insight) between 1 and 2000),
  status text not null
    check (status in ('ready', 'insufficient_data')),
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.insight_cache enable row level security;
revoke all on table public.insight_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.insight_cache to service_role;

create table public.insight_refresh_limits (
  user_id uuid not null
    references auth.users (id) on delete cascade,
  refresh_day date not null,
  request_count smallint not null
    check (request_count between 1 and 100),
  primary key (user_id, refresh_day)
);

alter table public.insight_refresh_limits enable row level security;
revoke all on table public.insight_refresh_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.insight_refresh_limits to service_role;

create or replace function public.consume_insight_refresh_quota(
  p_user_id uuid,
  p_limit integer default 3
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
  v_request_count integer;
begin
  if p_user_id is null then
    raise exception 'A user id is required.';
  end if;
  if p_limit not between 1 and 20 then
    raise exception 'Refresh limit is outside the supported range.';
  end if;

  delete from public.insight_refresh_limits
  where user_id = p_user_id
    and refresh_day < v_today;

  insert into public.insight_refresh_limits (
    user_id,
    refresh_day,
    request_count
  )
  values (p_user_id, v_today, 1)
  on conflict (user_id, refresh_day)
  do update
    set request_count = public.insight_refresh_limits.request_count + 1
  returning request_count into v_request_count;

  return query
  select
    v_request_count <= p_limit,
    greatest(p_limit - v_request_count, 0);
end;
$$;

revoke all on function public.consume_insight_refresh_quota(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.consume_insight_refresh_quota(uuid, integer)
  to service_role;

comment on table public.insight_cache is
  'Private per-user cache for the authenticated analyze-sessions Edge Function.';
comment on table public.insight_refresh_limits is
  'UTC-day counters enforcing at most three manual Stats insight refreshes per user.';
