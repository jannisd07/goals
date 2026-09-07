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

/**
 * Plans an idempotent onboarding reconciliation. `existing` must be ordered
 * newest-first, matching the Supabase query in completePendingOnboarding.
 */
export function planOnboardingGoals(
  existing: ExistingOnboardingGoal[],
  includePhysicalGoal: boolean,
): OnboardingGoalPlan {
  const focusGoals = existing.filter((goal) => goal.type === "focus");
  const physicalGoals = existing.filter((goal) => goal.type === "physical");

  return {
    focusGoalId: focusGoals[0]?.id ?? null,
    physicalGoalId: includePhysicalGoal
      ? physicalGoals[0]?.id ?? null
      : null,
    deactivateGoalIds: [
      ...focusGoals.slice(1),
      ...(includePhysicalGoal ? physicalGoals.slice(1) : physicalGoals),
    ].map((goal) => goal.id),
    createFocusGoal: focusGoals.length === 0,
    createPhysicalGoal: includePhysicalGoal && physicalGoals.length === 0,
  };
}
