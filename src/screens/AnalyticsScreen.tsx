import React, { useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  PaperCard,
  PaperHeader,
  PaperLabel,
  PaperScreen,
} from "../components/paper/PaperUI";
import { TextAction } from "../components/ui/TextAction";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/TabIcons";
import { useMonthSessions } from "../hooks/useSessions";
import { useServerInsight } from "../hooks/useInsights";
import { useAppStore } from "../store";
import { computeLocalInsight } from "../lib/insights";
import { formatInsightUpdatedAt } from "../lib/serverInsights";
import { hapticLight } from "../lib/haptics";
import type { Goal, Session } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DAY_HEADERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SCREEN_BOTTOM_CLEARANCE = 28;

interface DayCell {
  day: number | null;
  value: number;
  isToday: boolean;
}

function buildMonthGrid(
  year: number,
  month: number,
  sessions: Session[],
  goalId: string | null,
  physical: boolean,
): DayCell[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7;

  const valueByDay = new Map<number, number>();
  for (const session of sessions) {
    if (goalId && session.goal_id !== goalId) continue;
    const start = new Date(session.start_time);
    if (start.getFullYear() !== year || start.getMonth() !== month) continue;
    const day = start.getDate();
    const contribution = physical ? 1 : session.duration_seconds / 60;
    valueByDay.set(day, (valueByDay.get(day) ?? 0) + contribution);
  }

  const now = new Date();
  const cells: DayCell[] = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push({ day: null, value: 0, isToday: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      value: valueByDay.get(day) ?? 0,
      isToday:
        day === now.getDate() && month === now.getMonth() && year === now.getFullYear(),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, value: 0, isToday: false });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/**
 * Four fixed steps rather than a continuous alpha ramp. A smooth gradient makes
 * every day look slightly different and nothing look meaningful; discrete steps
 * let you actually compare two weeks at a glance.
 */
const HEAT_STEPS = ["#CDE7D5", "#8FCBA4", "#4FAC72", "#2E9E4F"] as const;

function intensityColor(value: number, maxValue: number, physical: boolean): string {
  if (value <= 0) return PAPER.sunken;
  const t = Math.min(1, value / Math.max(physical ? 1 : 30, maxValue));
  const step = Math.min(HEAT_STEPS.length - 1, Math.floor(t * HEAT_STEPS.length));
  return HEAT_STEPS[step];
}

interface WeekSummary {
  label: string;
  startISO: string;
  endISO: string;
  hours: number;
  sessions: number;
  hitTarget: boolean | null;
}

function buildWeekSummaries(
  year: number,
  month: number,
  sessions: Session[],
  goal: Goal | null,
): WeekSummary[] {
  if (!goal) return [];
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  // Walk Mondays covering the month.
  const firstMonday = new Date(monthStart);
  firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));

  const summaries: WeekSummary[] = [];
  const now = new Date();

  for (
    let weekStart = new Date(firstMonday);
    weekStart <= monthEnd;
    weekStart.setDate(weekStart.getDate() + 7)
  ) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    if (start > now) break;

    let seconds = 0;
    let count = 0;
    for (const session of sessions) {
      if (session.goal_id !== goal.id) continue;
      const t = new Date(session.start_time);
      if (t >= start && t <= end) {
        seconds += session.duration_seconds;
        count += 1;
      }
    }

    const hours = seconds / 3600;
    const isCurrentWeek = now >= start && now <= end;
    const isPhysical = goal.type === "physical";
    const target = isPhysical ? goal.target_sessions_per_week : goal.target_hours_per_week;
    const achieved = isPhysical ? count : hours;

    const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

    summaries.push({
      label: isCurrentWeek ? "This week" : `${fmt(start)} – ${fmt(end)}`,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      hours,
      sessions: count,
      hitTarget: isCurrentWeek ? null : target > 0 ? achieved >= target : null,
    });
  }

  return summaries.reverse();
}

export function AnalyticsScreen() {
  const navigation = useNavigation<Nav>();
  const goals = useAppStore((s) => s.goals);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  const {
    data: sessions,
    isLoading,
    isError,
    refetch,
  } = useMonthSessions(year, month);
  const boundaryWeekSessions = useMemo(() => sessions ?? [], [sessions]);
  const monthSessions = useMemo(
    () =>
      boundaryWeekSessions.filter((session) => {
        const start = new Date(session.start_time);
        return start.getFullYear() === year && start.getMonth() === month;
      }),
    [boundaryWeekSessions, month, year],
  );

  const activeGoals = goals.filter((g) => g.is_active);
  const selectedGoal =
    activeGoals.find((g) => g.id === selectedGoalId) ?? activeGoals[0] ?? null;
  const effectiveGoalId = selectedGoal?.id ?? null;
  const serverInsight = useServerInsight(effectiveGoalId);
  const isPhysical = selectedGoal?.type === "physical";

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const goPrevMonth = useCallback(() => {
    hapticLight();
    setMonth((m) => {
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    if (isCurrentMonth) return;
    hapticLight();
    setMonth((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, [isCurrentMonth]);

  const goalSessions = useMemo(
    () => monthSessions.filter((s) => !effectiveGoalId || s.goal_id === effectiveGoalId),
    [monthSessions, effectiveGoalId],
  );

  const weeks = useMemo(
    () => buildMonthGrid(year, month, monthSessions, effectiveGoalId, isPhysical),
    [year, month, monthSessions, effectiveGoalId, isPhysical],
  );

  const maxDayValue = useMemo(
    () => Math.max(...weeks.flat().map((c) => c.value), 0),
    [weeks],
  );

  const weekSummaries = useMemo(
    () => buildWeekSummaries(year, month, boundaryWeekSessions, selectedGoal),
    [year, month, boundaryWeekSessions, selectedGoal],
  );

  const totalHours = goalSessions.reduce((acc, s) => acc + s.duration_seconds / 3600, 0);
  const totalVisits = goalSessions.length;

  const completedWeeks = weekSummaries.filter((w) => w.hitTarget !== null);
  const weeksHit = completedWeeks.filter((w) => w.hitTarget).length;

  const localInsight = useMemo(
    () => computeLocalInsight(goalSessions, isPhysical),
    [goalSessions, isPhysical],
  );
  const insightText =
    serverInsight.data?.insight ??
    localInsight ??
    "Log a few sessions and patterns will start to show up here.";
  const insightUpdatedLabel = serverInsight.data
    ? formatInsightUpdatedAt(serverInsight.data.generated_at)
    : serverInsight.isError
      ? "Using an on-device insight"
      : "";

  return (
    <PaperScreen edges={["top"]}>
      <PaperHeader
        title="Stats"
        onClose={() => {
          hapticLight();
          navigation.goBack();
        }}
      />
      <Animated.View entering={FadeIn.duration(220)} style={{ flex: 1 }}>
        <ScrollView
          bounces={false}
          alwaysBounceVertical={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: SCREEN_BOTTOM_CLEARANCE }}
          showsVerticalScrollIndicator={false}
        >
          {/* The month is the axis everything below is read against, so it gets
              its own line rather than being tucked into the title. */}
          <View style={styles.monthRow}>
            <Text style={styles.monthLabel}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <View style={styles.monthNav}>
              <Pressable
                onPress={goPrevMonth}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                style={({ pressed }) => [
                  styles.monthNavBtn,
                  { opacity: pressed ? 0.5 : 1 },
                ]}
              >
                <ChevronLeftIcon size={18} color={PAPER.ink} strokeWidth={2} />
              </Pressable>
              <Pressable
                onPress={goNextMonth}
                disabled={isCurrentMonth}
                accessibilityRole="button"
                accessibilityLabel="Next month"
                accessibilityState={{ disabled: isCurrentMonth }}
                style={({ pressed }) => [
                  styles.monthNavBtn,
                  { opacity: isCurrentMonth ? 0.25 : pressed ? 0.5 : 1 },
                ]}
              >
                <ChevronRightIcon size={18} color={PAPER.ink} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color={PAPER.accent} />
              <Text style={styles.emptyText}>Loading your stats…</Text>
            </View>
          ) : isError ? (
            <PaperCard style={styles.card} padding={18}>
              <Text style={styles.emptyTitle}>Stats could not be loaded</Text>
              <Text style={styles.emptyText}>Check your connection and try again.</Text>
              <TextAction
                label="Try Again"
                onPress={() => void refetch()}
                textStyle={styles.linkText}
              />
            </PaperCard>
          ) : activeGoals.length === 0 ? (
            <PaperCard style={styles.card} padding={18}>
              <Text style={styles.emptyTitle}>No goals yet</Text>
              <Text style={styles.emptyText}>
                Set up a goal on the Home screen and your progress will show up here.
              </Text>
            </PaperCard>
          ) : (
            <>
              {/* Goal segments */}
              {activeGoals.length > 1 ? (
                <Animated.View entering={FadeInDown.delay(50).duration(400)}>
                  <View style={styles.segmentRow}>
                    {activeGoals.map((goal) => {
                      const active = goal.id === effectiveGoalId;
                      return (
                        <Pressable
                          key={goal.id}
                          onPress={() => {
                            setSelectedGoalId(goal.id);
                            hapticLight();
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={goal.name}
                          accessibilityState={{ selected: active }}
                          style={styles.segmentTouch}
                        >
                          <View style={[styles.segment, active && styles.segmentActive]}>
                            <Text
                              style={[styles.segmentText, active && styles.segmentTextActive]}
                              numberOfLines={1}
                            >
                              {goal.name}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </Animated.View>
              ) : null}

              {/* Two numbers, one card, one hairline between them. Two separate
                  panels for two numbers reads as filler. */}
              <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                <PaperCard style={styles.card} padding={0}>
                  <View style={styles.kpiRow}>
                    <View style={styles.kpiCell}>
                      <Text style={styles.kpiValue}>
                        {isPhysical ? totalVisits : totalHours.toFixed(1)}
                        <Text style={styles.kpiUnit}>{isPhysical ? " visits" : "h"}</Text>
                      </Text>
                      <Text style={styles.kpiLabel}>this month</Text>
                    </View>
                    <View style={styles.kpiSplit} />
                    <View style={styles.kpiCell}>
                      <Text style={styles.kpiValue}>
                        {completedWeeks.length > 0 ? `${weeksHit}/${completedWeeks.length}` : "—"}
                      </Text>
                      <Text style={styles.kpiLabel}>weeks on target</Text>
                    </View>
                  </View>
                </PaperCard>
              </Animated.View>

              {/* Calendar heatmap */}
              <Animated.View entering={FadeInDown.delay(150).duration(400)}>
                <PaperLabel>Daily activity</PaperLabel>
                <PaperCard style={styles.card} padding={14}>
                  <View style={styles.dayHeaderRow}>
                    {DAY_HEADERS.map((d, i) => (
                      <Text key={`${d}-${i}`} style={styles.dayHeader}>
                        {d}
                      </Text>
                    ))}
                  </View>
                  {weeks.map((week, wi) => (
                    <View key={wi} style={styles.weekRow}>
                      {week.map((cell, ci) => (
                        <View key={ci} style={styles.dayCellWrap}>
                          {cell.day !== null ? (
                            <View
                              accessible
                              accessibilityRole="text"
                              accessibilityLabel={
                                cell.value > 0
                                  ? isPhysical
                                    ? `Day ${cell.day}: ${Math.round(cell.value)} visits`
                                    : `Day ${cell.day}: ${Math.round(cell.value)} minutes`
                                  : `Day ${cell.day}: no session`
                              }
                              style={[
                                styles.dayCell,
                                {
                                  backgroundColor: intensityColor(
                                    cell.value,
                                    maxDayValue,
                                    isPhysical,
                                  ),
                                },
                                cell.isToday && styles.dayCellToday,
                              ]}
                            />
                          ) : (
                            <View style={[styles.dayCell, { backgroundColor: "transparent" }]} />
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                  <View style={styles.legendRow}>
                    <Text style={styles.legendLabel}>Less</Text>
                    <View style={styles.legendSwatch} />
                    {HEAT_STEPS.map((color) => (
                      <View key={color} style={[styles.legendSwatch, { backgroundColor: color }]} />
                    ))}
                    <Text style={styles.legendLabel}>More</Text>
                  </View>
                </PaperCard>
              </Animated.View>

              {/* Insight — quiet, data-driven, no AI framing */}
              <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                <PaperLabel>Your pattern</PaperLabel>
                <PaperCard style={styles.card} padding={16}>
                  <View style={styles.insightHeader}>
                    <TextAction
                      label={serverInsight.isRefreshing ? "Refreshing…" : "Refresh"}
                      onPress={() => {
                        hapticLight();
                        void serverInsight.refresh().catch(() => undefined);
                      }}
                      disabled={
                        serverInsight.isRefreshing ||
                        serverInsight.data?.status === "insufficient_data"
                      }
                      align="right"
                      containerStyle={styles.insightRefresh}
                      textStyle={styles.insightRefreshText}
                    />
                  </View>
                  {serverInsight.isLoading && !localInsight ? (
                    <View style={styles.insightLoading}>
                      <ActivityIndicator size="small" color={PAPER.accent} />
                      <Text style={styles.insightLoadingText}>Finding your patterns…</Text>
                    </View>
                  ) : (
                    <Text style={styles.insightText}>{insightText}</Text>
                  )}
                  {serverInsight.refreshError ? (
                    <Text style={styles.insightMeta}>
                      {serverInsight.refreshError.message}
                    </Text>
                  ) : insightUpdatedLabel ? (
                    <Text style={styles.insightMeta}>{insightUpdatedLabel}</Text>
                  ) : null}
                </PaperCard>
              </Animated.View>

              {/* Weeks drill-down */}
              {weekSummaries.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(250).duration(400)}>
                  <PaperLabel>Week by week</PaperLabel>
                  <PaperCard style={styles.card} padding={0}>
                    {weekSummaries.map((week, index) => (
                      <Pressable
                        key={week.startISO}
                        onPress={() =>
                          navigation.navigate("AnalyticsWeek", {
                            weekStartISO: week.startISO,
                            weekEndISO: week.endISO,
                            weekLabel: week.label,
                            selectedGoalId: effectiveGoalId ?? undefined,
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${week.label}`}
                        style={({ pressed }) => [
                          styles.weekListRow,
                          index > 0 && styles.weekListDivider,
                          { opacity: pressed ? 0.55 : 1 },
                        ]}
                      >
                        <Text style={styles.weekListLabel}>{week.label}</Text>
                        <Text
                          style={[
                            styles.weekListValue,
                            week.hitTarget === true && styles.weekListValueHit,
                          ]}
                        >
                          {isPhysical
                            ? `${week.sessions} visits`
                            : `${week.hours.toFixed(1)}h`}
                          {week.hitTarget === null
                            ? ""
                            : week.hitTarget
                              ? " · hit"
                              : " · missed"}
                        </Text>
                      </Pressable>
                    ))}
                  </PaperCard>
                </Animated.View>
              ) : null}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: PAPER.gutter + 4,
    paddingRight: PAPER.gutter - 4,
    paddingTop: 6,
    paddingBottom: 4,
  },
  monthLabel: {
    color: PAPER.ink,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: NEU_FONTS.heading,
    letterSpacing: -0.4,
  },
  monthNav: {
    flexDirection: "row",
  },
  monthNavBtn: {
    width: PAPER.hitTarget,
    height: PAPER.hitTarget,
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    marginBottom: 4,
  },
  loadingState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: PAPER.gutter,
  },
  linkText: {
    color: PAPER.accentInk,
    fontSize: 15,
  },

  // Goal picker: white stays white when chosen, only the label and outline
  // turn green, so a selected goal still belongs to the same family of cards.
  segmentRow: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: PAPER.gutter,
    marginTop: 14,
    marginBottom: 18,
  },
  segmentTouch: {
    flex: 1,
    minHeight: PAPER.hitTarget,
    justifyContent: "center",
  },
  segment: {
    minHeight: 38,
    borderRadius: PAPER.radiusSm,
    borderWidth: 1,
    borderColor: PAPER.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAPER.surface,
    paddingHorizontal: 10,
  },
  segmentActive: {
    borderColor: PAPER.accent,
    backgroundColor: PAPER.accentWash,
  },
  segmentText: {
    color: PAPER.inkMuted,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
  },
  segmentTextActive: {
    color: PAPER.accentInk,
    fontFamily: NEU_FONTS.heading,
  },

  kpiRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  kpiCell: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  kpiSplit: {
    width: 1,
    backgroundColor: PAPER.line,
    marginVertical: 12,
  },
  kpiValue: {
    color: PAPER.ink,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: NEU_FONTS.heading,
    fontVariant: ["tabular-nums"],
  },
  kpiUnit: {
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
    color: PAPER.inkMuted,
  },
  kpiLabel: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
  },

  dayHeaderRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: "center",
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  dayCellWrap: {
    flex: 1,
    alignItems: "center",
  },
  dayCell: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: PAPER.ink,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 8,
  },
  legendLabel: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.body,
    marginHorizontal: 4,
  },
  legendSwatch: {
    width: 11,
    height: 11,
    borderRadius: 3,
    backgroundColor: PAPER.sunken,
  },

  insightText: {
    color: PAPER.ink,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
    lineHeight: 24,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: -4,
    marginBottom: 2,
  },
  insightRefresh: {
    minWidth: 72,
    marginRight: -4,
  },
  insightRefreshText: {
    fontSize: 14,
    color: PAPER.accentInk,
  },
  insightLoading: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  insightLoadingText: {
    color: PAPER.inkMuted,
    fontSize: 15,
    fontFamily: NEU_FONTS.body,
  },
  insightMeta: {
    color: PAPER.inkFaint,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 12,
  },

  weekListRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    minHeight: 52,
  },
  weekListDivider: {
    borderTopWidth: 1,
    borderTopColor: PAPER.line,
  },
  weekListLabel: {
    color: PAPER.ink,
    fontSize: 15,
    fontFamily: NEU_FONTS.body,
  },
  weekListValue: {
    color: PAPER.inkMuted,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
    fontVariant: ["tabular-nums"],
  },
  weekListValueHit: {
    color: PAPER.accentInk,
  },

  emptyTitle: {
    color: PAPER.ink,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
    marginBottom: 6,
  },
  emptyText: {
    color: PAPER.inkMuted,
    fontSize: 15,
    fontFamily: NEU_FONTS.body,
    lineHeight: 21,
  },
});
