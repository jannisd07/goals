-- Insight rate limiting.
--
-- `analyze-sessions` reads up to 2000 session rows and runs the pattern
-- clustering on every call, and until now nothing stopped a valid JWT from
-- looping it. The daily "refresh quota" that migration 20260730130000 added for
-- the old model-backed version was never wired up and no longer fits: the
-- insight is now computed deterministically, so a normal user may legitimately
-- refresh it many times a day. What has to be bounded is the *rate*.

create table if not exists public.insight_rate_limits (
  user_id uuid not null
    references auth.users (id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null
    check (request_count between 1 and 10000),
  primary key (user_id, window_started_at)
);

alter table public.insight_rate_limits enable row level security;
revoke all on table public.insight_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.insight_rate_limits to service_role;

create or replace function public.consume_insight_rate_slot(
  p_user_id uuid,
  p_limit integer default 10,
  p_window_seconds integer default 60
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_request_count integer;
begin
  if p_user_id is null then
    raise exception 'A user id is required.';
  end if;
  if p_limit not between 1 and 1000 then
    raise exception 'Quota limit is outside the supported range.';
  end if;
  if p_window_seconds not between 1 and 3600 then
    raise exception 'Quota window is outside the supported range.';
  end if;

  v_window_start := to_timestamp(
    (
      floor(extract(epoch from v_now) / p_window_seconds)
      * p_window_seconds
    )::double precision
  );

  -- Keeping only the current window makes retention bounded without pg_cron.
  delete from public.insight_rate_limits
  where user_id = p_user_id
    and window_started_at < v_window_start;

  insert into public.insight_rate_limits (
    user_id,
    window_started_at,
    request_count
  )
  values (p_user_id, v_window_start, 1)
  on conflict (user_id, window_started_at)
  do update
    set request_count = public.insight_rate_limits.request_count + 1
  returning request_count into v_request_count;

  return query
  select
    v_request_count <= p_limit,
    case
      when v_request_count <= p_limit then 0
      else greatest(
        1,
        ceil(
          extract(
            epoch from (
              v_window_start
              + make_interval(secs => p_window_seconds)
              - v_now
            )
          )
        )::integer
      )
    end;
end;
$$;

revoke all on function public.consume_insight_rate_slot(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_insight_rate_slot(uuid, integer, integer)
  to service_role;

comment on table public.insight_rate_limits is
  'Per-user request windows for analyze-sessions. Service role only.';

-- Remove the unused remains of the model-backed insight design. Nothing in the
-- app or in any edge function reads them, and insight_cache still stores
-- per-user text that no longer has a reader.
drop function if exists public.consume_insight_refresh_quota(uuid, integer);
drop table if exists public.insight_refresh_limits;
drop table if exists public.insight_cache;
