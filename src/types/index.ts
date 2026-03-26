export type GoalType = "physical" | "focus";
export type SessionTrigger = "geofence" | "manual_pomodoro";
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
  pomodoro_duration_minutes: number;
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

export interface HeatMapCell {
  hour: number;
  day: number;
  intensity: number;
}

export interface AIInsight {
  text: string;
  generated_at: string;
}

export interface GrowthOrb {
  id: string;
  goal_id: string;
  goal_name: string;
  color: AccentColor;
  stage: number;
  total_sessions: number;
  x: number;
  y: number;
}

export const ACCENT_COLORS: Record<AccentColor, string> = {
  blue: "#4A9EFF",
  purple: "#A855F7",
  green: "#34D399",
  orange: "#FB923C",
  pink: "#F472B6",
  cyan: "#22D3EE",
  red: "#EF4444",
  yellow: "#FACC15",
};

export const AMBIENT_SOUNDS: AmbientSound[] = [
  { key: "rain", label: "Rain", icon: "🌧" },
  { key: "cafe", label: "Café", icon: "☕" },
  { key: "white_noise", label: "White Noise", icon: "〰" },
  { key: "forest", label: "Forest", icon: "🌲" },
  { key: "lofi", label: "Lo-fi", icon: "🎵" },
];

export const DEFAULT_POMODORO_DURATION = 25;
export const SHORT_BREAK_DURATION = 5;
export const LONG_BREAK_DURATION = 15;
export const CYCLES_BEFORE_LONG_BREAK = 4;
export const TOTAL_WEEKLY_HOURS = 168;
export const MIN_GEOFENCE_DURATION_SECONDS = 600;
