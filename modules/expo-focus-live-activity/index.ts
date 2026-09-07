import { requireOptionalNativeModule } from "expo-modules-core";

export type FocusLiveActivityState = {
  sessionId: string;
  goalId: string;
  goalName: string;
  modeLabel: "FLOWTIME" | "INTERVALS";
  phaseLabel: "FOCUS MODE" | "RECOVERY MODE" | "BREAK MODE";
  isBreak: boolean;
  isRunning: boolean;
  timerCountsUp: boolean;
  timerDateMs: number;
  staticTime: string;
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
