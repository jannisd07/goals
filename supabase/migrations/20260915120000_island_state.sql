-- The island belongs to the account, not to one phone.
--
-- Until now everything a player grew lived only in AsyncStorage: reinstalling
-- the app or switching phones threw away months of work, while the sessions it
-- was built from sat safely in Supabase.
--
-- One row per player rather than one per object: the island is always read and
-- written as a whole, it changes about once per session, and a single row keeps
-- the merge between two devices in one place instead of spread over dozens of
-- rows. `objects` and `spots` mirror the shape the app already stores.

create table if not exists public.island_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- { "<object_key>": { "objectKey", "category", "level", "updatedAt" } }
  objects jsonb not null default '{}'::jsonb,
  -- { "<object_key>": { "i", "j" } } — half-metre cells around the island centre
  spots jsonb not null default '{}'::jsonb,
  -- sessions whose reward was already placed, so a reward can never grow twice
  applied_sessions text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  constraint island_objects_is_object check (jsonb_typeof(objects) = 'object'),
  constraint island_spots_is_object check (jsonb_typeof(spots) = 'object'),
  -- a runaway client must not be able to fill the table
  constraint island_applied_sessions_bounded check (cardinality(applied_sessions) <= 2000)
);

alter table public.island_state enable row level security;

create policy "Users can view their own island"
  on public.island_state for select using (auth.uid() = user_id);
create policy "Users can create their own island"
  on public.island_state for insert with check (auth.uid() = user_id);
create policy "Users can update their own island"
  on public.island_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own island"
  on public.island_state for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.island_state to authenticated;
-- Signed out, the table should not even be discoverable.
revoke all on public.island_state from anon;
