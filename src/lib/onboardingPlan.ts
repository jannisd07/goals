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
