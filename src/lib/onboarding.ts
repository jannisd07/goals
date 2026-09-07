import { supabase } from "./supabase";
import {
  CHECKIN_CATEGORIES,
  DEFAULT_MIN_VISIT_MINUTES,
  FOCUS_CATEGORIES,
  normalizeMinVisitMinutes,
  type PendingOnboarding,
} from "../types";
import {
  planOnboardingGoals,
  type ExistingOnboardingGoal,
} from "./onboardingPlan";

/**
 * Persists the complete optional setup collected during onboarding and marks
 * onboarding as complete only after all requested goals have been created.
 */
export async function completePendingOnboarding(
  userId: string,
  pending: PendingOnboarding,
): Promise<void> {
  const focusLabel =
    FOCUS_CATEGORIES.find((c) => c.key === pending.focus_category)?.label ?? "Focus Time";
  const checkinLabel =
    CHECKIN_CATEGORIES.find((c) => c.key === pending.checkin_category)?.label ??
    "Auto Check-In";

  const { error: upsertError } = await supabase
    .from("users")
    .upsert({ id: userId }, { onConflict: "id" });
  if (upsertError) throw upsertError;

  const { data: existingRows, error: existingError } = await supabase
    .from("goals")
    .select("id,type,updated_at,created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("type", ["focus", "physical"])
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (existingError) throw existingError;

  const existing = (existingRows ?? []) as ExistingOnboardingGoal[];
  const now = new Date().toISOString();

  const focusValues = {
    name: focusLabel,
    category: pending.focus_category,
    target_sessions_per_week: 0,
    target_hours_per_week: pending.focus_hours,
    color: "blue",
    location: null,
    pomodoro_duration_minutes: 25,
    is_active: true,
    updated_at: now,
  };
  const checkinValues =
    pending.checkin_category && pending.checkin_location
      ? {
          name: checkinLabel,
          category: pending.checkin_category,
          target_sessions_per_week: pending.checkin_target_sessions,
          target_hours_per_week: 0,
          color: "blue",
          location: pending.checkin_location,
          min_visit_minutes: normalizeMinVisitMinutes(
            pending.checkin_min_visit_minutes ?? DEFAULT_MIN_VISIT_MINUTES,
          ),
          pomodoro_duration_minutes: 25,
          is_active: true,
          updated_at: now,
        }
      : null;
  const plan = planOnboardingGoals(existing, Boolean(checkinValues));

  if (plan.focusGoalId) {
    const { error } = await supabase
      .from("goals")
      .update(focusValues)
      .eq("id", plan.focusGoalId)
      .eq("user_id", userId);
    if (error) throw error;
  }

  if (plan.physicalGoalId && checkinValues) {
    const { error } = await supabase
      .from("goals")
      .update(checkinValues)
      .eq("id", plan.physicalGoalId)
      .eq("user_id", userId);
    if (error) throw error;
  }

  if (plan.deactivateGoalIds.length > 0) {
    const { error } = await supabase
      .from("goals")
      .update({ is_active: false, updated_at: now })
      .eq("user_id", userId)
      .in("id", plan.deactivateGoalIds);
    if (error) throw error;
  }

  const goalsToInsert: Array<Record<string, unknown>> = [];

  if (plan.createFocusGoal) {
    goalsToInsert.push({
      user_id: userId,
      type: "focus",
      ...focusValues,
    });
  }

  if (plan.createPhysicalGoal && checkinValues) {
    goalsToInsert.push({
      user_id: userId,
      type: "physical",
      ...checkinValues,
    });
  }

  if (goalsToInsert.length > 0) {
    const { error: goalError } = await supabase
      .from("goals")
      .insert(goalsToInsert);
    if (goalError) throw goalError;
  }

  const { error: userError } = await supabase
    .from("users")
    .update({
      focus_style: pending.focus_style,
      onboarding_complete: true,
      updated_at: now,
    })
    .eq("id", userId);
  if (userError) throw userError;
}
