export type GoalType = "physical" | "focus";
export type SessionTrigger = "geofence" | "manual_checkin" | "manual_pomodoro";
export type FocusStyle = "interval" | "flowtime";
export type AccentColor = "blue" | "purple" | "green" | "orange" | "pink" | "cyan" | "red" | "yellow";

export interface FixedCommitments {
  sleep_hours_per_night: number;
  work_hours_per_day: number;
  work_days_per_week: number;
  daily_overhead_hours: number;
}

export interface UserConfig {
  id: string;
  display_name: string;
  fixed_commitments: FixedCommitments;
  onboarding_complete: boolean;
  focus_style?: FocusStyle;
  friend_code?: string | null;
  default_session_minutes?: number;
  break_duration_minutes?: number;
  preferred_ambient_sound?: AmbientSoundKey | null;
  ambient_volume?: number;
  notification_preferences?: {
    streakReminder: boolean;
    checkinAlerts: boolean;
    aiNudges: boolean;
    weeklySummary: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface GoalLocation {
  latitude: number;
  longitude: number;
  radius_meters: number;
  address: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  type: GoalType;
  target_sessions_per_week: number;
  target_hours_per_week: number;
  color: AccentColor;
  location: GoalLocation | null;
  /** Auto Check-In: a visit shorter than this is discarded instead of logged. */
  min_visit_minutes: number;
  pomodoro_duration_minutes: number;
  category?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  goal_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  trigger: SessionTrigger;
  rating: number | null;
  pomodoro_cycles: number;
  ambient_sound: AmbientSoundKey | null;
  notes: string | null;
  growth_stage: number;
  garden_rendered?: boolean;
  start_latitude?: number | null;
  start_longitude?: number | null;
  created_at: string;
}

export type AmbientSoundKey = "rain" | "cafe" | "white_noise" | "forest" | "lofi";

export interface AmbientSound {
  key: AmbientSoundKey;
  label: string;
  icon: string;
}

export interface PomodoroState {
  is_running: boolean;
  is_break: boolean;
  is_long_break: boolean;
  current_cycle: number;
  total_cycles: number;
  elapsed_seconds: number;
  duration_seconds: number;
  break_duration_seconds: number;
  /** "interval" counts down duration_seconds per cycle; "flowtime" counts up until the user takes a break. */
  mode?: FocusStyle;
  /** Flowtime only: focus seconds accumulated in the current stretch, feeds the suggested break length. */
  flow_stretch_seconds?: number;
  /**
   * Interval mode only: focus progress preserved when the user starts a break
   * manually from the Live Activity. Resuming returns to the same interval.
   */
  interrupted_focus_elapsed_seconds?: number;
  /** Total productive focus time in this session. Breaks and paused time are deliberately excluded. */
  focused_seconds: number;
  /**
   * Wall-clock cursor used to reconcile time after JS suspension or an app restart.
   * It is reset whenever the timer is paused/resumed so paused time is never counted.
   */
  last_tick_at_ms: number;
}

export interface ActiveSession {
  session_id: string;
  goal_id: string;
  goal_name: string;
  goal_color: AccentColor;
  trigger: SessionTrigger;
  start_time: string;
  pomodoro: PomodoroState | null;
  ambient_sound: AmbientSoundKey | null;
}

export interface WeeklyProgress {
  goal_id: string;
  sessions_completed: number;
  total_hours: number;
}

export const AMBIENT_SOUNDS: AmbientSound[] = [
  { key: "rain", label: "Rain", icon: "rain" },
  { key: "cafe", label: "Cafe", icon: "cafe" },
  { key: "white_noise", label: "Calm", icon: "wave" },
  { key: "forest", label: "Forest", icon: "forest" },
  { key: "lofi", label: "Lo-fi", icon: "music" },
];

export interface GoalCategory {
  key: string;
  /** Becomes the goal name and therefore the card title on the home screen. */
  label: string;
}

export const FOCUS_CATEGORIES: GoalCategory[] = [
  { key: "studying", label: "Studying" },
  { key: "working", label: "Working" },
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
  { key: "coding", label: "Coding" },
  { key: "meditating", label: "Meditating" },
];

export const CHECKIN_CATEGORIES: GoalCategory[] = [
  { key: "study_spot", label: "Study Spot" },
  { key: "gym", label: "Gym" },
  { key: "library", label: "Library" },
  { key: "office", label: "Office" },
  { key: "pilates", label: "Pilates" },
  { key: "pool", label: "Swimming" },
];

export interface FriendWeekly {
  friend_id: string;
  display_name: string;
  focus_hours: number;
  focus_target_hours: number;
  checkins: number;
  checkin_target: number;
}

export interface PendingOnboarding {
  focus_style: FocusStyle;
  focus_category: string | null;
  focus_hours: number;
  checkin_category: string | null;
  checkin_target_sessions: number;
  /** Optional for backward compatibility with onboarding data persisted before the minimum-stay step existed. */
  checkin_min_visit_minutes?: number;
  /** Optional for backward compatibility with onboarding data persisted before location setup moved into the tour. */
  checkin_location?: GoalLocation | null;
  display_name: string;
}

export const DEFAULT_POMODORO_DURATION = 25;
export const SHORT_BREAK_DURATION = 5;
export const LONG_BREAK_DURATION = 15;
export const CYCLES_BEFORE_LONG_BREAK = 4;
export const TOTAL_WEEKLY_HOURS = 168;
/**
 * Auto Check-In minimum stay. Walking past a place must not become a session,
 * so every physical goal carries its own threshold.
 */
export const MIN_VISIT_MINUTES_OPTIONS = [
  { label: "10 min", value: 10 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
] as const;

export const DEFAULT_MIN_VISIT_MINUTES = 10;
export const MIN_VISIT_MINUTES_MIN = 1;
export const MIN_VISIT_MINUTES_MAX = 240;

/** Fallback used when a goal predates the setting or carries an invalid value. */
export const MIN_GEOFENCE_DURATION_SECONDS = DEFAULT_MIN_VISIT_MINUTES * 60;

/** Clamps any stored or user-supplied value onto the supported range. */
export function normalizeMinVisitMinutes(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MIN_VISIT_MINUTES;
  return Math.min(MIN_VISIT_MINUTES_MAX, Math.max(MIN_VISIT_MINUTES_MIN, Math.round(n)));
}
