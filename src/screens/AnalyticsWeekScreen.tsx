import React, { useCallback, useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { currentUser, supabase } from "../lib/supabase";
import { useAppStore } from "../store";
import { PaperCard, PaperHeader, PaperScreen } from "../components/paper/PaperUI";
import { TrashIcon } from "../components/TabIcons";
import { useDeleteSession } from "../hooks/useSessions";
import { TextAction } from "../components/ui/TextAction";
import type { RootStackParamList } from "../navigation/types";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";

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

  const deleteSession = useDeleteSession();

  /** Wrong check-ins happen (driving past the gym), so every session can be removed. */
  const confirmDelete = useCallback(
    (session: SessionRow) => {
      const goalName = goalNameById[session.goal_id] ?? "Session";
      Alert.alert(
        "Delete this session?",
        `${goalName} · ${formatTimeLabel(session.start_time)} · ${formatDuration(session.duration_seconds)}` +
          "\n\nIt is removed from your stats, weekly progress and streak. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              deleteSession.mutate(session.id, {
                onError: (error: unknown) => {
                  Alert.alert(
                    "Couldn’t delete the session",
                    error instanceof Error
                      ? error.message
                      : "Check your connection and try again.",
                  );
                },
              });
            },
          },
        ],
      );
    },
    [deleteSession, goalNameById],
  );

  const { data: sessions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics", "week", weekStartISO, weekEndISO, selectedGoalId ?? "all"],
    queryFn: async (): Promise<SessionRow[]> => {
      const user = await currentUser();
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
    <PaperScreen edges={["top"]}>
      <PaperHeader title="Week" onClose={() => navigation.goBack()} closeLabel="Back" />

      <Text style={styles.weekLabel}>{weekLabel}</Text>

      {!isLoading && !isError ? (
        <PaperCard style={styles.summaryCard} padding={16}>
          <Text style={styles.summaryValue}>
            {isPhysical ? `${sessions.length} ${sessions.length === 1 ? "visit" : "visits"}` : formatDuration(weekTotalSeconds)}
          </Text>
          <Text style={styles.summaryLabel}>
            {isPhysical ? "Check-ins this week" : "Focus time this week"}
          </Text>
        </PaperCard>
      ) : null}

      <ScrollView
          bounces={false}
          alwaysBounceVertical={false} style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <Text style={styles.loadingText}>Loading sessions...</Text>
        ) : isError ? (
          <PaperCard style={styles.dayCard} padding={16}>
            <Text style={styles.dayTitle}>This week could not be loaded</Text>
            <Text style={styles.emptyText}>Check your connection and try again.</Text>
            <TextAction
              label="Try Again"
              onPress={() => void refetch()}
              textStyle={styles.linkText}
            />
          </PaperCard>
        ) : (
          days.map((day) => (
            <PaperCard key={day.date.toISOString()} style={styles.dayCard} padding={14}>
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
                    <Pressable
                      onPress={() => confirmDelete(session)}
                      disabled={deleteSession.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${goalNameById[session.goal_id] ?? "session"} at ${formatTimeLabel(session.start_time)}`}
                      accessibilityState={{ disabled: deleteSession.isPending }}
                      style={({ pressed }) => [
                        styles.deleteTouch,
                        { opacity: deleteSession.isPending ? 0.4 : pressed ? 0.6 : 1 },
                      ]}
                    >
                      <TrashIcon size={18} color={PAPER.danger} />
                    </Pressable>
                  </View>
                ))
              )}
            </PaperCard>
          ))
        )}
      </ScrollView>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  weekLabel: {
    color: PAPER.ink,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: NEU_FONTS.heading,
    letterSpacing: -0.3,
    paddingHorizontal: PAPER.gutter + 4,
    paddingTop: 4,
    paddingBottom: 14,
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryValue: {
    color: PAPER.ink,
    fontSize: 28,
    lineHeight: 34,
    fontFamily: NEU_FONTS.heading,
    fontVariant: ["tabular-nums"],
  },
  summaryLabel: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  dayCard: {
    marginBottom: 10,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dayTitle: {
    color: PAPER.ink,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },
  dayTotal: {
    color: PAPER.inkMuted,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
    fontVariant: ["tabular-nums"],
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: PAPER.line,
  },
  sessionTime: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    fontVariant: ["tabular-nums"],
    minWidth: 62,
  },
  sessionGoal: {
    color: PAPER.ink,
    fontSize: 15,
    fontFamily: NEU_FONTS.body,
  },
  sessionTrigger: {
    color: PAPER.inkFaint,
    fontSize: 12,
    fontFamily: NEU_FONTS.body,
    marginTop: 1,
  },
  sessionDuration: {
    color: PAPER.ink,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
    fontVariant: ["tabular-nums"],
  },
  // 44pt touch target without making the compact rows taller.
  deleteTouch: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -10,
    marginLeft: 2,
    marginRight: -12,
  },
  emptyText: {
    color: PAPER.inkFaint,
    fontSize: 14,
    fontFamily: NEU_FONTS.body,
    paddingVertical: 4,
  },
  loadingText: {
    color: PAPER.inkMuted,
    fontSize: 15,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 24,
  },
  linkText: {
    color: PAPER.accentInk,
    fontSize: 15,
  },
});
