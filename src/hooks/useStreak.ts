import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { currentUser, supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { computeStreak, type StreakInfo } from "../lib/streaks";
import { syncStreakReminder } from "../lib/notifications";

const STREAK_WINDOW_DAYS = 90;

export function useStreak(): StreakInfo | null {
  const streakReminderEnabled = useAppStore((s) => s.notificationPrefs.streakReminder);

  const { data } = useQuery({
    queryKey: ["streak"],
    queryFn: async (): Promise<StreakInfo> => {
      const user = await currentUser();
      if (!user) return { current: 0, longest: 0, atRiskToday: false };

      const since = new Date();
      since.setDate(since.getDate() - STREAK_WINDOW_DAYS);

      const { data: sessions, error } = await supabase
        .from("sessions")
        .select("start_time, end_time")
        .eq("user_id", user.id)
        .gte("start_time", since.toISOString())
        .not("end_time", "is", null);

      if (error) throw error;
      return computeStreak(sessions ?? []);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Keep the evening reminder in sync with reality and with the user's preference.
  useEffect(() => {
    if (!data) return;
    if (!streakReminderEnabled) {
      void syncStreakReminder(0, false);
      return;
    }
    void syncStreakReminder(data.current, data.atRiskToday);
  }, [data, streakReminderEnabled]);

  return data ?? null;
}
