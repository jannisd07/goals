-- Covers the composite session -> goal ownership foreign key for cascades and
-- integrity checks. Completed-session partial indexes remain optimized for UI
-- reads; this index exists specifically for the FK's complete row set.
create index if not exists idx_sessions_goal_owner
  on public.sessions(goal_id, user_id);
