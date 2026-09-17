/**
 * Home — island redesign.
 *
 * A pixel ocean is the background with the island on it; everything else
 * floats on top as light cards. Data and navigation behave exactly as before, only the
 * presentation changed.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Circle, Path } from "react-native-svg";
import { AnalyticsIcon, SettingsIcon } from "../components/TabIcons";
import { GoalGlyph } from "../components/GoalGlyphs";
import { GoalStartSheet } from "../components/GoalStartSheet";
import { PixelSprite } from "../components/PixelArt";
import { IslandObjectsLayer } from "../components/island/IslandObjectsLayer";
import { IslandGrewOverlay } from "../components/island/IslandGrewOverlay";
import { IslandProgressPill } from "../components/island/IslandProgressPill";
import { RewardWaitingPill } from "../components/grow/RewardWaitingPill";
import { MilestoneMoment } from "../components/grow/MilestoneMoment";
import { usePendingGrows } from "../hooks/usePendingGrows";
import { useLifetimeHours } from "../hooks/useLifetimeHours";
import { formatRewardHours } from "../lib/rewards";
import { HOME_ISLAND_STAGES } from "../lib/homeIslandStages";
import { islandGrowth, islandStageFor } from "../lib/islandScene";
import { seedForUser, type Spot } from "../lib/islandPlacement";
import { useAppStore } from "../store";
import { useGoals } from "../hooks/useGoals";
import {
  useActiveCheckIn,
  useEndActiveCheckIn,
  useStartManualCheckIn,
  useWeeklyProgress,
} from "../hooks/useSessions";
import { useStreak } from "../hooks/useStreak";
import { usePageRefreshAnimation } from "../hooks/usePageRefreshAnimation";
import { useRefreshPermissionWarnings } from "../hooks/useRefreshPermissionWarnings";
import { PermissionWarningPill } from "../components/PermissionWarningPill";
import { persistFocusStyle } from "../lib/focusStyle";
import { userFacingMessage } from "../lib/errors";
import { formatMinVisitDuration, normalizeMinVisitMinutes, type Goal } from "../types";
import type { RootStackParamList } from "../navigation/types";

/** Stable empty island, so the selector never hands back a fresh object. */
const NO_ISLAND_OBJECTS: Readonly<Record<string, { level: number }>> = {};
const NO_ISLAND_SPOTS: Readonly<Record<string, Spot>> = {};

/** Palette of the island artwork. Kept local to this screen for now. */
const C = {
  ink: "#0F1B2D",
  inkSoft: "#6B7280",
  green: "#2E9E4F",
  greenSoft: "#D7EEDD",
  card: "rgba(255,255,255,0.86)",
  track: "#C9D6E2",
  sky: "#4CC3F5",
};

function fmtHours(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Ring showing how much of the week's disposable time is still left. */
function BalanceRing({ progress, size = 54 }: { progress: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E4E7EC" strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={C.green} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function todayLabel(): string {
  // Short form so the streak still fits on one line next to it.
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Two people plus an online dot, matching the supplied artwork. */
function FriendsGlyph({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="9.2" cy="7.6" r="3.6" fill={C.ink} />
      <Path
        d="M2.8 18.9c0-3.3 2.9-5.6 6.4-5.6s6.4 2.3 6.4 5.6c0 .6-.5 1.1-1.1 1.1H3.9c-.6 0-1.1-.5-1.1-1.1Z"
        fill={C.ink}
      />
      <Circle cx="17.6" cy="8.2" r="2.6" fill={C.ink} />
      <Circle cx="17.8" cy="16.4" r="3.1" fill={C.green} />
    </Svg>
  );
}

/** Filled play triangle on a solid green disc, as in the reference art. */
function PlayDisc({ size = 52 }: { size?: number }) {
  return (
    <View style={[styles.playDisc, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24">
        <Path d="M8 5.2c0-.9 1-1.5 1.8-1l9 6.8c.7.5.7 1.5 0 2l-9 6.8c-.8.5-1.8-.1-1.8-1V5.2Z" fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Home used to show zeros when goals or the week could not be fetched — the
 * one screen everybody lands on after sign-in, and the one without any error
 * state. Same shape as the other lines on Home, with the way out on it.
 */
function LoadErrorPill({ onRetry }: { onRetry: () => void }) {
  return (
    <Pressable
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Your week could not be loaded. Tap to try again."
      style={({ pressed }) => [styles.loadErrorTouch, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.loadErrorPill}>
        <Text style={styles.loadErrorText} numberOfLines={2}>
          Your week could not be loaded
        </Text>
        <Text style={styles.loadErrorAction}>Retry</Text>
      </View>
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const goals = useAppStore((s) => s.goals);
  const userConfig = useAppStore((s) => s.userConfig);
  const lastSessionMinutes = useAppStore((s) => s.lastSessionMinutes);
  const focusStyle = useAppStore((s) => s.focusStyle);
  const setFocusStyle = useAppStore((s) => s.setFocusStyle);
  const setLastSessionMinutes = useAppStore((s) => s.setLastSessionMinutes);
  const setFocusGrowCategory = useAppStore((s) => s.setFocusGrowCategory);
  const setFocusGrowObject = useAppStore((s) => s.setFocusGrowObject);
  const [sessionPickerGoal, setSessionPickerGoal] = useState<Goal | null>(null);
  // A focus session that is still running — after a restart the app lands here,
  // not on the timer, and Home must say so instead of offering to start another.
  const runningSession = useAppStore((s) => (s.activeSession?.pomodoro ? s.activeSession : null));
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const islandObjects = useAppStore(
    (s) => (s.userConfig ? s.islandObjectsByUser[s.userConfig.id] : undefined) ?? NO_ISLAND_OBJECTS,
  );
  const islandSpots = useAppStore(
    (s) => (s.userConfig ? s.islandSpotsByUser[s.userConfig.id] : undefined) ?? NO_ISLAND_SPOTS,
  );
  const islandSeed = seedForUser(userConfig?.id);
  // The island grows with what stands on it, and the objects sit where the
  // placement put them (src/lib/islandScene.ts, src/lib/islandPlacement.ts).
  const islandStage = islandStageFor(islandObjects);
  const growth = islandGrowth(islandObjects);
  /**
   * Growing the island is the payoff of everything else, so it is announced
   * rather than swapped in silently. `seenStage` is what the player was last
   * shown; the first time an account is seen it is simply written down, so a
   * fresh install never celebrates the island it started with.
   *
   * That note is only true once the account's island has actually arrived. This
   * phone starts out empty, so writing the mark straight away writes down a size
   * 1 island — and the moment the sync brings the real one in, the app announces
   * a growth the player never worked for on this device. So it waits for the
   * pull (`useIslandSync`). Offline it simply waits: no mark, no announcement,
   * and nothing lost.
   */
  const seenStage = useAppStore((s) =>
    s.userConfig ? s.islandStageSeenByUser[s.userConfig.id] : undefined,
  );
  const islandSyncedFor = useAppStore((s) => s.islandSyncedFor);
  const markIslandStageSeen = useAppStore((s) => s.markIslandStageSeen);
  const userId = userConfig?.id ?? null;
  useEffect(() => {
    if (!userId || seenStage !== undefined || islandSyncedFor !== userId) return;
    markIslandStageSeen(userId, islandStage);
  }, [userId, seenStage, islandStage, islandSyncedFor, markIslandStageSeen]);
  const grewFrom = seenStage !== undefined && islandStage > seenStage ? seenStage : null;
  const stage = HOME_ISLAND_STAGES[islandStage - 1];
  const bgSize = Image.resolveAssetSource(stage.background);
  // Background and island layer share this transform, so the island moves with it.
  const bgTransform = { transform: [{ scale: stage.zoom }, { translateY: stage.shiftY }] };
  // Cover math of the background image; the transform is applied on top.
  const bgScale = Math.max(screenWidth / bgSize.width, screenHeight / bgSize.height);
  const islandRect = stage.islandRect ?? { left: 0, top: 0, width: 0, height: 0 };
  const islandStyle = {
    position: "absolute" as const,
    left: islandRect.left * bgScale - (bgSize.width * bgScale - screenWidth) / 2,
    top: islandRect.top * bgScale - (bgSize.height * bgScale - screenHeight) / 2,
    width: islandRect.width * bgScale,
    height: islandRect.height * bgScale,
  };

  const goalsQuery = useGoals();
  const progressQuery = useWeeklyProgress();
  const disposableTimeHours = useAppStore((st) => st.disposableTimeHours);
  const usedTimeThisWeekSeconds = useAppStore((st) => st.usedTimeThisWeekSeconds);
  const streak = useStreak();
  const lifetimeHours = useLifetimeHours();
  const refreshKey = usePageRefreshAnimation();
  useRefreshPermissionWarnings(refreshKey);
  const autoCheckInWarning = useAppStore((s) => s.autoCheckInPermissionWarning);
  const notificationWarning = useAppStore((s) => s.notificationPermissionWarning);
  // Rewards waiting to be placed are re-read every time Home comes back.
  const pendingGrows = usePendingGrows(refreshKey);
  const autoDelivered = useAppStore((s) => s.autoDeliveredGrows);
  // A landmark that just arrived takes the whole screen for a breath.
  const arrivedMilestone = useAppStore((s) => s.arrivedMilestones[0] ?? null);
  const clearArrivedMilestone = useAppStore((s) => s.clearArrivedMilestone);
  const clearAutoDeliveredGrows = useAppStore((s) => s.clearAutoDeliveredGrows);

  const firstName = (userConfig?.display_name ?? "there").split(" ")[0];
  const focusGoal = goals.find((g) => g.type === "focus") ?? null;
  const checkInGoal = goals.find((g) => g.type === "physical") ?? null;
  const activeCheckIn = useActiveCheckIn(checkInGoal?.id);
  const startManualCheckIn = useStartManualCheckIn();
  const endActiveCheckIn = useEndActiveCheckIn();

  useEffect(() => {
    if (!checkInGoal) return;
    void activeCheckIn.refetch();
  }, [activeCheckIn.refetch, checkInGoal, refreshKey]);

  /**
   * The week, counted up (Jannis, 2026-09-18).
   *
   * This used to show the free time still left — a budget nobody had set, that
   * fell as you worked. Two things at once, and neither of them a question
   * anybody asks in the morning. It read as a number going the wrong way: do
   * the right thing, watch it shrink.
   *
   * So it counts what has been put in instead. The ring fills as the week
   * fills, which is the direction everything else on this screen already moves.
   * The free time is still the frame it is measured against, just no longer the
   * headline.
   */
  const totalSeconds = disposableTimeHours * 3600;
  const investedSeconds = Math.max(0, usedTimeThisWeekSeconds);
  const investedRatio =
    totalSeconds > 0 ? Math.min(1, investedSeconds / totalSeconds) : 0;

  // Without a connection the query has nothing; the last known week from the
  // store is the same source the balance ring already draws from, so the cards
  // and the ring never disagree.
  const storedProgress = useAppStore((st) => st.weeklyProgress);
  const progress = progressQuery.data ?? storedProgress;
  const focusHours = focusGoal ? progress[focusGoal.id]?.total_hours ?? 0 : 0;
  const focusTarget = focusGoal?.target_hours_per_week ?? 0;
  const focusRatio = focusTarget > 0 ? Math.min(1, focusHours / focusTarget) : 0;
  const visits = checkInGoal ? progress[checkInGoal.id]?.sessions_completed ?? 0 : 0;
  const visitTarget = checkInGoal?.target_sessions_per_week ?? 0;
  // An open visit was invisible on the card — only the accessibility label
  // changed. Re-rendered on every focus/foreground (refreshKey), so the minutes
  // are current whenever the player looks; nothing ticks on its own.
  const checkInElapsedMinutes = activeCheckIn.data
    ? Math.max(0, Math.floor((Date.now() - new Date(activeCheckIn.data.start_time).getTime()) / 60000))
    : 0;
  const checkInElapsedLabel =
    checkInElapsedMinutes >= 60
      ? `${Math.floor(checkInElapsedMinutes / 60)}h ${checkInElapsedMinutes % 60}m`
      : `${checkInElapsedMinutes} min`;

  const handleCheckIn = useCallback(
    (goal: Goal) => {
      const open = activeCheckIn.data;
      const run = () => {
        const action = open
          ? endActiveCheckIn.mutateAsync(open)
          : startManualCheckIn.mutateAsync(goal);
        void action.catch((error: unknown) => {
          Alert.alert(
            open ? "Couldn’t end check-in" : "Couldn’t start check-in",
            userFacingMessage(error, "Check your connection and try again."),
          );
        });
      };
      // Ending early is allowed, but it must not look like a logged visit: the
      // start sheet says shorter visits are not counted, and the mutation keeps
      // that promise — so say it here, before anything is thrown away.
      const minVisitSeconds = normalizeMinVisitMinutes(goal.min_visit_minutes ?? null) * 60;
      const elapsedSeconds = open
        ? Math.floor((Date.now() - new Date(open.start_time).getTime()) / 1000)
        : 0;
      if (open && elapsedSeconds < minVisitSeconds) {
        Alert.alert(
          "End check-in?",
          `This visit is shorter than ${formatMinVisitDuration(goal.min_visit_minutes)} and won’t count as a session.`,
          [
            { text: "Keep going", style: "cancel" },
            { text: "End without logging", style: "destructive", onPress: run },
          ],
        );
        return;
      }
      run();
    },
    [activeCheckIn.data, endActiveCheckIn, startManualCheckIn],
  );

  return (
    <ImageBackground
      source={stage.background}
      style={styles.bg}
      imageStyle={bgTransform}
      resizeMode="cover"
    >
      {/* Same box and transform as the background image, so the island moves with it. */}
      {stage.island ? (
        <View style={[StyleSheet.absoluteFill, bgTransform]} pointerEvents="none">
          <Image source={stage.island} style={islandStyle} resizeMode="stretch" />
        </View>
      ) : null}
      <IslandObjectsLayer
        stage={islandStage}
        island={islandObjects}
        spots={islandSpots}
        seed={islandSeed}
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        transform={bgTransform}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headText}>
            <Text style={styles.hey} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              Hey {firstName}
            </Text>
            <Text style={styles.date} numberOfLines={1}>
              {todayLabel()}
              {streak && streak.current > 0 ? (
                <Text style={styles.streak}>{`  ·  ${streak.current}-day streak`}</Text>
              ) : null}
            </Text>
            <Pressable
              onPress={() => navigation.navigate("Rewards")}
              accessibilityRole="button"
              accessibilityLabel={
                lifetimeHours.data === undefined
                  ? "Open rewards, hours not loaded"
                  : `Open rewards, ${formatRewardHours(lifetimeHours.data)} tracked`
              }
              hitSlop={6}
              style={({ pressed }) => [styles.rewardsTouch, { opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={styles.rewardsPill}>
                <PixelSprite name="trophy" size={20} />
                <Text style={styles.rewardsText}>
                  {/*
                    A failed load is not zero hours. Showing "0 h" to someone
                    with a year of work behind them reads as lost progress.
                  */}
                  {lifetimeHours.data === undefined
                    ? "—"
                    : formatRewardHours(lifetimeHours.data)}
                </Text>
              </View>
            </Pressable>
          </View>
          <View style={styles.tools}>
            <Pressable
              onPress={() => navigation.navigate("Friends")}
              accessibilityRole="button"
              accessibilityLabel="Open friends"
              style={styles.toolTouch}
            >
              <View style={styles.toolCircle}>
                <FriendsGlyph size={23} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("Analytics")}
              accessibilityRole="button"
              accessibilityLabel="Open stats"
              style={styles.toolTouch}
            >
              <View style={styles.toolCircle}>
                <AnalyticsIcon size={21} color={C.ink} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("Settings")}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              style={styles.toolTouch}
            >
              <View style={styles.toolCircle}>
                <SettingsIcon size={22} color={C.ink} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Balance pill */}
        <View style={styles.balance}>
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceValue}>{fmtHours(investedSeconds)}</Text>
            <Text style={styles.balanceLabel}>invested this week</Text>
          </View>
          <BalanceRing progress={investedRatio} size={48} />
        </View>

        {/* A failed load must not look like an empty week. */}
        {(goalsQuery.isError && goals.length === 0) || progressQuery.isError ? (
          <LoadErrorPill
            onRetry={() => {
              void goalsQuery.refetch();
              void progressQuery.refetch();
            }}
          />
        ) : null}

        {/* A permission that is off stops the app silently; say so here. */}
        <PermissionWarningPill
          autoCheckInWarning={autoCheckInWarning}
          notificationWarning={notificationWarning}
        />

        {/* No reward is ever lost, so Home has to say when one is waiting. */}
        <RewardWaitingPill
          waiting={pendingGrows.length}
          delivered={autoDelivered}
          onDismiss={clearAutoDeliveredGrows}
          onOpen={() => {
            const next = pendingGrows[0];
            if (!next) return;
            navigation.navigate("GrowReveal", {
              sessionId: next.sessionId,
              goalId: next.goalId,
              goalName: next.goalName,
              durationSeconds: next.durationSeconds,
              category: next.category,
              objectKey: next.objectKey,
            });
          }}
        />

        {/* How far to the next island size — the other half of "Island too small". */}
        <IslandProgressPill
          growth={growth}
          onArrange={
            Object.keys(islandObjects).length > 0
              ? () => navigation.navigate("IslandPlace")
              : undefined
          }
        />

        {/* The island sits behind this layout (see homeIslandStages); this keeps it visible. */}
        <View style={{ flex: 1 }} />

        {/* Goal cards */}
        <View style={styles.cards}>
          <Pressable
            onPress={() =>
              runningSession
                ? navigation.navigate("FocusSession", {
                    goalId: runningSession.goal_id,
                    sessionLengthMinutes: lastSessionMinutes,
                  })
                : focusGoal
                  ? setSessionPickerGoal(focusGoal)
                  : navigation.navigate("SetupStudying")
            }
            accessibilityRole="button"
            accessibilityLabel={
              runningSession
                ? `Resume ${runningSession.goal_name} session`
                : focusGoal
                  ? `Start ${focusGoal.name} session`
                  : "Set up a focus goal"
            }
            style={styles.card}
          >
            <View style={styles.cardTop}>
              <GoalGlyph category={focusGoal?.category} type="focus" />
            </View>
            <View style={styles.playSlot} pointerEvents="none">
              <PlayDisc size={46} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {focusGoal?.name ?? "Focus"}
            </Text>
            <Text style={styles.cardMeta}>
              {runningSession
                ? runningSession.pomodoro?.is_running
                  ? "Running · tap to resume"
                  : "Paused · tap to resume"
                : focusGoal
                  ? `${focusHours.toFixed(1)} / ${Math.round(focusTarget)}h`
                  : "Tap to set up"}
            </Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${focusRatio * 100}%` }]} />
            </View>
          </Pressable>

          {/* Auto Check-In is optional and can be skipped in onboarding. Without
              this the card was a dead tap with no way to set it up later. */}
          <Pressable
            onPress={() =>
              checkInGoal
                ? setSessionPickerGoal(checkInGoal)
                : navigation.navigate("SetupGeofence")
            }
            accessibilityRole="button"
            accessibilityLabel={
              !checkInGoal
                ? "Set up Auto Check-In"
                : activeCheckIn.data
                  ? "End check-in"
                  : "Start check-in"
            }
            style={styles.card}
          >
            <View style={styles.cardTop}>
              <GoalGlyph category={checkInGoal?.category} type="physical" />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {checkInGoal?.name ?? "Visits"}
            </Text>
            <Text style={styles.cardMeta}>
              {!checkInGoal
                ? "Tap to set up"
                : activeCheckIn.data
                  ? `Checked in · ${checkInElapsedLabel} · tap to end`
                  : `${visits} / ${visitTarget} sessions`}
            </Text>
            <View style={styles.dots}>
              {Array.from({ length: Math.max(1, Math.min(6, visitTarget)) }).map((_, i) => (
                <View key={i} style={[styles.dot, i < visits && styles.dotDone]} />
              ))}
            </View>
          </Pressable>
        </View>
      </SafeAreaView>

      {arrivedMilestone ? (
        <MilestoneMoment
          milestone={arrivedMilestone}
          onDone={() => clearArrivedMilestone(arrivedMilestone.id)}
        />
      ) : null}

      <GoalStartSheet
        visible={sessionPickerGoal !== null}
        goal={sessionPickerGoal}
        initialMinutes={lastSessionMinutes}
        initialStyle={focusStyle}
        checkInActive={Boolean(activeCheckIn.data)}
        onClose={() => setSessionPickerGoal(null)}
        onToggleCheckIn={() => {
          const goal = sessionPickerGoal;
          setSessionPickerGoal(null);
          if (goal) handleCheckIn(goal);
        }}
        onStartFocus={(minutes, style, growCategory, growObjectKey) => {
          const goal = sessionPickerGoal;
          if (!goal) return;
          setSessionPickerGoal(null);
          const previousStyle = focusStyle;
          setFocusStyle(style);
          setLastSessionMinutes(minutes);
          setFocusGrowCategory(growCategory);
          setFocusGrowObject(growObjectKey);
          if (userConfig?.id && style !== previousStyle) {
            const requestUserId = userConfig.id;
            void persistFocusStyle(requestUserId, style).catch(() => {
              const current = useAppStore.getState();
              if (
                current.userConfig?.id !== requestUserId ||
                current.focusStyle !== style
              ) {
                return;
              }
              setFocusStyle(previousStyle);
            });
          }
          navigation.navigate("FocusSession", {
            goalId: goal.id,
            sessionLengthMinutes: minutes,
            growCategory,
            growObjectKey,
          });
        }}
      />
      {grewFrom !== null && userId ? (
        <IslandGrewOverlay
          from={grewFrom}
          to={islandStage}
          transform={bgTransform}
          onDone={() => markIslandStageSeen(userId, islandStage)}
        />
      ) : null}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: C.sky },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  headText: { flex: 1, paddingRight: 10 },
  hey: { fontSize: 30, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.6 },
  date: { fontSize: 14, color: "rgba(255,255,255,0.92)", marginTop: 4, fontWeight: "600" },
  streak: { color: "#BFF3CE", fontWeight: "800" },
  rewardsTouch: { alignSelf: "flex-start", marginTop: 6, minHeight: 40, justifyContent: "center" },
  rewardsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingLeft: 9,
    paddingRight: 14,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
  },
  rewardsText: { fontSize: 15, fontWeight: "800", color: C.ink, letterSpacing: -0.2 },
  tools: { flexDirection: "row", gap: 8, marginTop: 4 },
  toolTouch: {
    width: 48, height: 48, alignItems: "center", justifyContent: "center",
  },
  toolCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  balance: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 18,
    paddingLeft: 24,
    paddingRight: 14,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    minWidth: 260,
  },
  balanceValue: {
    fontSize: 24, fontWeight: "800", color: C.ink, letterSpacing: -0.5,
  },
  balanceLabel: {
    fontSize: 13, fontWeight: "600", color: "#8A8A99", marginTop: 2,
  },
  cards: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    minHeight: 146,
  },
  // Sits inset from the top-right corner rather than flush with it.
  playSlot: { position: "absolute", top: 16, right: 20 },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 34,
  },
  playDisc: {
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 19, fontWeight: "800", color: C.ink, marginTop: 8, letterSpacing: -0.3,
  },
  cardMeta: {
    fontSize: 15.5, fontWeight: "700", color: "#8A8A99", marginTop: 3,
  },
  bar: {
    height: 11, borderRadius: 6, backgroundColor: "#DDE3EA",
    marginTop: 11, overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 7, backgroundColor: C.green },
  dots: { flexDirection: "row", gap: 8, marginTop: 11 },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2.4, borderColor: "#DDE3EA",
  },
  dotDone: { backgroundColor: C.green, borderColor: C.green },
  loadErrorTouch: { marginHorizontal: 20, marginTop: 10, minHeight: 44, justifyContent: "center" },
  loadErrorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  loadErrorText: { flex: 1, color: C.ink, fontSize: 14 },
  loadErrorAction: { color: C.green, fontSize: 14, fontWeight: "600" },
});
