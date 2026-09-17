import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * One payload for both kinds of live session. Keep in step with
 * ios/ExpoFocusLiveActivityModule.swift and native/FocusLiveActivityWidget.swift:
 * all three describe the same thing, and if they drift the activity stops
 * decoding on the lock screen.
 */
export type FocusLiveActivityState = {
  /** "focus" is a timed session, "visit" an Auto Check-In that just runs. */
  kind: "focus" | "visit";
  sessionId: string;
  goalId: string;
  goalName: string;
  modeLabel: "FLOWTIME" | "INTERVALS" | "CHECKED IN";
  phaseLabel: "FOCUS MODE" | "RECOVERY MODE" | "BREAK MODE" | "AT YOUR SPOT";
  isBreak: boolean;
  isRunning: boolean;
  timerCountsUp: boolean;
  timerDateMs: number;
  staticTime: string;
  /** What is growing on the island right now; empty when nothing is. */
  growName: string;
  growDetail: string;
  growCategory: "plant" | "building" | "water" | "beach" | "";
};

type ExpoFocusLiveActivityNativeModule = {
  isSupported(): boolean;
  start(state: FocusLiveActivityState): Promise<string | null>;
  update(state: FocusLiveActivityState): Promise<boolean>;
  endAll(): Promise<void>;
};

const nativeModule =
  requireOptionalNativeModule<ExpoFocusLiveActivityNativeModule>(
    "ExpoFocusLiveActivity",
  );

export function isFocusLiveActivitySupported(): boolean {
  return nativeModule?.isSupported() ?? false;
}

export async function startFocusLiveActivity(
  state: FocusLiveActivityState,
): Promise<string | null> {
  return nativeModule?.start(state) ?? null;
}

export async function updateFocusLiveActivity(
  state: FocusLiveActivityState,
): Promise<boolean> {
  return nativeModule?.update(state) ?? false;
}

export async function endFocusLiveActivities(): Promise<void> {
  await nativeModule?.endAll();
}
