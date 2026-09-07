-- Auto Check-In: minimum stay per goal.
--
-- Walking past a place must not be logged as a visit. Every physical goal now
-- carries its own threshold; visits shorter than it are discarded instead of
-- written. The default reproduces the previous hard-coded 10 minutes, so
-- existing goals keep behaving exactly as before.

alter table public.goals
  add column if not exists min_visit_minutes integer not null default 10;

alter table public.goals
  drop constraint if exists goals_min_visit_minutes_range;

alter table public.goals
  add constraint goals_min_visit_minutes_range
    check (min_visit_minutes between 1 and 240);

comment on column public.goals.min_visit_minutes is
  'Auto Check-In: a geofence visit shorter than this many minutes is discarded.';

-- Column-level grants are explicit for updates; select/insert/delete are
-- granted table-wide and already cover the new column.
grant update (min_visit_minutes) on table public.goals to authenticated;
