import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { NeumorphicSurface } from "../components/NeumorphicSurface";
import { TextAction } from "../components/ui/TextAction";
import type { RootStackParamList } from "../navigation/types";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

type AnalyticsWeekRoute = RouteProp<RootStackParamList, "AnalyticsWeek">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type SessionRow = {
  id: string;
  goal_id: string;
  start_time: string;
  duration_seconds: number;
  trigger: "geofence" | "manual_checkin" | "manual_pomodoro";
};

function formatDuration(seconds: number): string {
  const mins = Math.max(0, Math.round(seconds / 60));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AnalyticsWeekScreen() {
  const route = useRoute<AnalyticsWeekRoute>();
  const navigation = useNavigation<Nav>();
  const goals = useAppStore((s) => s.goals);

  const { weekStartISO, weekEndISO, selectedGoalId, weekLabel } = route.params;
  const weekStart = useMemo(() => new Date(weekStartISO), [weekStartISO]);
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? null;
  const isPhysical = selectedGoal?.type === "physical";

  const goalNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const goal of goals) {
      map[goal.id] = goal.name;
    }
    return map;
  }, [goals]);

  const { data: sessions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", "week", weekStartISO, weekEndISO, selectedGoalId ?? "all"],
    queryFn: async (): Promise<SessionRow[]> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from("sessions")
        .select("id, goal_id, start_time, duration_seconds, trigger")
        .eq("user_id", user.id)
        .gte("start_time", weekStartISO)
        .lte("start_time", weekEndISO)
        .not("end_time", "is", null)
        .order("start_time", { ascending: true });

      if (selectedGoalId) {
        query = query.eq("goal_id", selectedGoalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
  });

  const days = useMemo(() => {
    const weekDays = Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + idx);
      date.setHours(0, 0, 0, 0);
      return date;
    });

    const byDay: Array<{ date: Date; sessions: SessionRow[]; totalSeconds: number }> = weekDays.map((date) => ({
      date,
      sessions: [],
      totalSeconds: 0,
    }));
    const indexByDay = new Map(
      weekDays.map((date, index) => [
        `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        index,
      ]),
    );

    for (const session of sessions) {
      const d = new Date(session.start_time);
      const idx = indexByDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      if (idx !== undefined) {
        byDay[idx].sessions.push(session);
        byDay[idx].totalSeconds += session.duration_seconds;
      }
    }

    return byDay;
  }, [sessions, weekStart]);

  const weekTotalSeconds = useMemo(() => days.reduce((sum, day) => sum + day.totalSeconds, 0), [days]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.headerRow}>
        <TextAction label="Back" onPress={() => navigation.goBack()} />

        <View pointerEvents="none" style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Week</Text>
          <Text style={styles.headerSubtitle}>{weekLabel}</Text>
        </View>

        <View style={{ width: 72 }} />
      </View>

      {!isLoading && !isError ? (
        <NeumorphicSurface style={styles.summaryCard} contentPadding={16}>
          <Text style={styles.summaryValue}>
            {isPhysical ? `${sessions.length} ${sessions.length === 1 ? "visit" : "visits"}` : formatDuration(weekTotalSeconds)}
          </Text>
          <Text style={styles.summaryLabel}>
            {isPhysical ? "Check-ins this week" : "Focus time this week"}
          </Text>
        </NeumorphicSurface>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <Text style={styles.loadingText}>Loading sessions...</Text>
        ) : isError ? (
          <NeumorphicSurface style={styles.dayCard} contentPadding={16}>
            <Text style={styles.dayTitle}>This week could not be loaded</Text>
            <Text style={styles.emptyText}>Check your connection and try again.</Text>
            <TextAction label="Try Again" onPress={() => void refetch()} />
          </NeumorphicSurface>
        ) : (
          days.map((day) => (
            <NeumorphicSurface
              key={day.date.toISOString()}
              style={styles.dayCard}
              contentPadding={14}
            >
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{formatDayLabel(day.date)}</Text>
                <Text style={styles.dayTotal}>
                  {isPhysical
                    ? `${day.sessions.length} ${day.sessions.length === 1 ? "visit" : "visits"}`
                    : formatDuration(day.totalSeconds)}
                </Text>
              </View>

              {day.sessions.length === 0 ? (
                <Text style={styles.emptyText}>No sessions</Text>
              ) : (
                day.sessions.map((session) => (
                  <View key={session.id} style={styles.sessionRow}>
                    <Text style={styles.sessionTime}>{formatTimeLabel(session.start_time)}</Text>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={styles.sessionGoal} numberOfLines={1}>
                        {goalNameById[session.goal_id] ?? "Goal"}
                      </Text>
                      <Text style={styles.sessionTrigger}>
                        {session.trigger === "manual_pomodoro"
                          ? "Focus"
                          : session.trigger === "manual_checkin"
                            ? "Manual Check-In"
                            : "Auto Check-In"}
                      </Text>
                    </View>
                    <Text style={styles.sessionDuration}>{formatDuration(session.duration_seconds)}</Text>
                  </View>
                ))
              )}
            </NeumorphicSurface>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEU.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  headerTitle: {
    color: NEU.textPrimary,
    fontSize: 17,
    fontFamily: NEU_FONTS.label,
  },
  headerSubtitle: {
    color: NEU.textSecondary,
    fontSize: 12,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
  },
  summaryCard: {
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryValue: {
    color: NEU.textPrimary,
    fontSize: 24,
    fontFamily: NEU_FONTS.heading,
  },
  summaryLabel: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  loadingText: {
    color: NEU.textSecondary,
    fontSize: 14,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 12,
  },
  dayCard: {
    marginBottom: 16,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dayTitle: {
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
  },
  dayTotal: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
  },
  emptyText: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    paddingVertical: 6,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(197, 205, 216, 0.6)",
  },
  sessionTime: {
    color: NEU.textSecondary,
    fontSize: 12,
    fontFamily: NEU_FONTS.body,
    width: 58,
  },
  sessionGoal: {
    color: NEU.textPrimary,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
  },
  sessionTrigger: {
    color: NEU.textSecondary,
    fontSize: 11,
    fontFamily: NEU_FONTS.body,
    marginTop: 1,
  },
  sessionDuration: {
    color: NEU.textPrimary,
    fontSize: 12,
    fontFamily: NEU_FONTS.body,
  },
});
