-- Authenticated, centrally throttled place search for the mobile app.
-- The Data API roles cannot access these operational tables or functions;
-- only the server-side service role used by the Edge Function can.

create table public.place_search_cache (
  cache_key text primary key
    check (cache_key ~ '^[0-9a-f]{64}$'),
  results jsonb not null
    check (jsonb_typeof(results) = 'array'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index place_search_cache_expiry_idx
  on public.place_search_cache (expires_at);

alter table public.place_search_cache enable row level security;
revoke all on table public.place_search_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.place_search_cache to service_role;

create table public.place_search_rate_limits (
  user_id uuid not null
    references auth.users (id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null
    check (request_count between 1 and 10000),
  primary key (user_id, window_started_at)
);

alter table public.place_search_rate_limits enable row level security;
revoke all on table public.place_search_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.place_search_rate_limits to service_role;

create table public.place_search_upstream_state (
  singleton boolean primary key default true
    check (singleton),
  next_request_at timestamptz not null default now()
);

insert into public.place_search_upstream_state (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.place_search_upstream_state enable row level security;
revoke all on table public.place_search_upstream_state from public, anon, authenticated;
grant select, insert, update on table public.place_search_upstream_state to service_role;

create or replace function public.consume_place_search_quota(
  p_user_id uuid,
  p_limit integer default 40,
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

  -- Keep at most the current window for this user. This makes retention
  -- bounded without a project-level cron dependency.
  delete from public.place_search_rate_limits
  where user_id = p_user_id
    and window_started_at < v_window_start;

  insert into public.place_search_rate_limits (
    user_id,
    window_started_at,
    request_count
  )
  values (p_user_id, v_window_start, 1)
  on conflict (user_id, window_started_at)
  do update
    set request_count = public.place_search_rate_limits.request_count + 1
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

create or replace function public.reserve_place_search_upstream_slot(
  p_spacing_ms integer default 1100,
  p_max_wait_ms integer default 8000
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_next_request_at timestamptz;
  v_reserved_at timestamptz;
  v_wait_ms integer;
begin
  if p_spacing_ms not between 1000 and 10000 then
    raise exception 'Upstream spacing is outside the supported range.';
  end if;
  if p_max_wait_ms not between 0 and 30000 then
    raise exception 'Maximum queue time is outside the supported range.';
  end if;

  select next_request_at
  into v_next_request_at
  from public.place_search_upstream_state
  where singleton = true
  for update;

  if not found then
    insert into public.place_search_upstream_state (singleton, next_request_at)
    values (true, v_now)
    on conflict (singleton) do nothing;

    select next_request_at
    into v_next_request_at
    from public.place_search_upstream_state
    where singleton = true
    for update;
  end if;

  v_reserved_at := greatest(v_now, v_next_request_at);
  v_wait_ms := greatest(
    0,
    ceil(extract(epoch from (v_reserved_at - v_now)) * 1000)::integer
  );

  -- Do not reserve a slot the caller cannot wait for. This prevents an
  -- overloaded queue from growing indefinitely.
  if v_wait_ms > p_max_wait_ms then
    return -1;
  end if;

  update public.place_search_upstream_state
  set next_request_at =
    v_reserved_at + make_interval(
      secs => (p_spacing_ms / 1000.0)::double precision
    )
  where singleton = true;

  return v_wait_ms;
end;
$$;

revoke all on function public.consume_place_search_quota(uuid, integer, integer)
  from public, anon, authenticated;
revoke all on function public.reserve_place_search_upstream_slot(integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_place_search_quota(uuid, integer, integer)
  to service_role;
grant execute on function public.reserve_place_search_upstream_slot(integer, integer)
  to service_role;

comment on table public.place_search_cache is
  'Short-lived, query-hash keyed cache for public geocoder responses. No user id or plaintext query is stored.';
comment on table public.place_search_rate_limits is
  'Operational per-user request counters for the authenticated place-search Edge Function.';
comment on table public.place_search_upstream_state is
  'Singleton coordinator that serializes public geocoder cache misses across Edge Function instances.';
