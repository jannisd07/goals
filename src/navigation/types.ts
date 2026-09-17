import type { GrowCategory } from "../types";

export type RootStackParamList = {
  /** The app's main screen. A plain screen since Grove was removed (2026-09-14). */
  MainTabs: undefined;
  FocusSession: {
    goalId: string;
    sessionLengthMinutes: number;
    growCategory?: GrowCategory;
    /** Object picked in the start sheet; it is the one growing in the ring. */
    growObjectKey?: string;
  };
  GrowReveal: {
    sessionId: string;
    goalId: string;
    goalName: string;
    durationSeconds: number;
    /** Chosen before a focus session; null after Auto Check-In, picked on the screen. */
    category: GrowCategory | null;
    /** Object picked before a focus session, preselected on the reveal. */
    objectKey?: string | null;
  };
  Analytics: undefined;
  AnalyticsWeek: {
    weekStartISO: string;
    weekEndISO: string;
    weekLabel: string;
    selectedGoalId?: string;
  };
  Settings: undefined;
  SetupStudying: undefined;
  SetupGeofence: undefined;
  Onboarding: undefined;
  Auth: undefined;
  PasswordReset: undefined;
  Friends: undefined;
  Rewards: undefined;
  /**
   * Without an object this is the rearrange mode: pick things up on the island
   * and put them down again. With one it places that object, once.
   */
  IslandPlace: { objectKey?: string; level?: number } | undefined;
  /** A friend's island, full screen and read-only. */
  FriendIsland: { friendId: string; name: string };
};


