export interface ExistingOnboardingGoal {
  id: string;
  type: "focus" | "physical";
  updated_at: string;
  created_at: string;
}

export interface OnboardingGoalPlan {
  focusGoalId: string | null;
  physicalGoalId: string | null;
  deactivateGoalIds: string[];
  createFocusGoal: boolean;
  createPhysicalGoal: boolean;
}

export interface OnboardingGoalPlanOptions {
  /**
   * Set for an account that finished onboarding before. Skipping Auto Check-In
   * in a repeated setup then means "leave it as it is", not "remove it": the
   * newest check-in goal stays active and only older duplicates are retired.
   */
  preserveExistingPhysicalGoal?: boolean;
}

/**
 * Plans an idempotent onboarding reconciliation. `existing` must be ordered
 * newest-first, matching the Supabase query in completePendingOnboarding.
 */
export function planOnboardingGoals(
  existing: ExistingOnboardingGoal[],
  includePhysicalGoal: boolean,
  options: OnboardingGoalPlanOptions = {},
): OnboardingGoalPlan {
  const focusGoals = existing.filter((goal) => goal.type === "focus");
  const physicalGoals = existing.filter((goal) => goal.type === "physical");
  const keepNewestPhysical =
    includePhysicalGoal || options.preserveExistingPhysicalGoal === true;

  return {
    focusGoalId: focusGoals[0]?.id ?? null,
    physicalGoalId: includePhysicalGoal
      ? physicalGoals[0]?.id ?? null
      : null,
    deactivateGoalIds: [
      ...focusGoals.slice(1),
      ...(keepNewestPhysical ? physicalGoals.slice(1) : physicalGoals),
    ].map((goal) => goal.id),
    createFocusGoal: focusGoals.length === 0,
    createPhysicalGoal: includePhysicalGoal && physicalGoals.length === 0,
  };
}

/** The same default the app uses for a visit length. */
const DEFAULT_MIN_VISIT = 10;

/**
 * One goal row, always with the same columns.
 *
 * Both goals go up in a single insert, and PostgREST builds one column list out
 * of the rows it is handed: a key on one row and missing on the other is sent
 * as NULL for the other — not as the column default. `min_visit_minutes` lived
 * only on the check-in row, so the focus row arrived with NULL against a NOT
 * NULL column and the whole setup failed. A fresh account with Auto Check-In
 * could never finish onboarding.
 *
 * Passing the rows through here makes that impossible rather than merely
 * noticed: every row has every column, whatever the caller left out.
 */
export function goalPayload(values: Partial<GoalPayload>): GoalPayload {
  return {
    name: "Goal",
    category: null,
    target_sessions_per_week: 0,
    target_hours_per_week: 0,
    color: "blue",
    location: null,
    min_visit_minutes: DEFAULT_MIN_VISIT,
    pomodoro_duration_minutes: 25,
    is_active: true,
    updated_at: new Date().toISOString(),
    ...values,
  };
}

export interface GoalPayload {
  name: string;
  category: string | null;
  target_sessions_per_week: number;
  target_hours_per_week: number;
  color: string;
  location: unknown;
  min_visit_minutes: number;
  pomodoro_duration_minutes: number;
  is_active: boolean;
  updated_at: string;
}

