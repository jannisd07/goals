/**
 * Running focus session in the paper look (Jannis, 2026-09-10: layout B).
 *
 * The dial is a white disc with one flat progress ring. Inside it the island
 * object picked in the start sheet grows while the session runs; the timer,
 * status and what is growing sit below. Ending a session that grew something
 * opens the grow reveal instead of going straight back to Home.
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useReducedMotion,
  withTiming,
  FadeIn,
  FadeInUp,
  FadeInDown,
  Easing,
} from "react-native-reanimated";
import { Circle } from "react-native-svg";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { usePomodoro } from "../hooks/usePomodoro";
import { useAmbientSound } from "../hooks/useAmbientSound";
import { useGoals } from "../hooks/useGoals";
import { useGrowHistory } from "../hooks/useGrowHistory";
import { useAppStore } from "../store";
import { hapticLight } from "../lib/haptics";
import {
  circularSliderAngleFromPoint,
  sliderRatioFromPageX,
  sliderThumbLeft,
} from "../lib/sliders";
import { formatTimer } from "../lib/time";
import {
  GROW_OBJECTS,
  MIN_GROW_SESSION_SECONDS,
  asGrowCategory,
  growCategoryInfo,
  liveGrowth,
  GROW_STEPS_BY_TIER,
} from "../lib/growRewards";
import { addPendingGrow } from "../lib/pendingGrows";
import { AMBIENT_SOUNDS } from "../types";
import type { AmbientSoundKey } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { PauseIcon, PlayIcon } from "../components/TabIcons";
import { GrowingObject } from "../components/grow/GrowingObject";
import { FocusDial } from "../components/focus/FocusDial";
import {
  FLOW_TARGET_DEFAULT,
  FLOW_TARGET_STEPS,
  FLOW_TARGET_SWEEP,
  describeFlowTarget,
  flowTargetAt,
  flowTargetIndex,
  flowTargetTurn,
  formatFlowTarget,
  snapFlowTarget,
} from "../lib/flowTarget";
import { PaperScreen } from "../components/paper/PaperUI";
import { TextAction } from "../components/ui/TextAction";
import { PAPER } from "../theme/paper";
import { NEU_FONTS } from "../theme/neumorphism";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 260;
const RING_DIAL_SIZE = RING_SIZE;
const RING_STROKE = 6;
const RING_RADIUS = (RING_DIAL_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_CENTER = RING_DIAL_SIZE / 2;
const OBJECT_SIZE = 168;
/**
 * Flowtime's target is set by turning the ring, not typed in beforehand
 * (island-free decision, Jannis 2026-09-15). One full turn covers 5 minutes to
 * 16 hours on a split scale — see src/lib/flowTarget.ts for why it is split and
 * not logarithmic.
 */
const FLOW_TARGET_LAST_INDEX = FLOW_TARGET_STEPS.length - 1;
/** Stable fallback, so effects that depend on the history do not restart every render. */
const EMPTY_HISTORY: number[] = [];

type FocusRoute = RouteProp<RootStackParamList, "FocusSession">;
type FocusNav = NativeStackNavigationProp<RootStackParamList>;

const SOUND_LABELS: Record<string, string> = {
  rain: "Rain",
  cafe: "Cafe",
  white_noise: "Calm",
  forest: "Forest",
  lofi: "Lo-fi",
};

export function FocusSessionScreen() {
  const route = useRoute<FocusRoute>();
  const navigation = useNavigation<FocusNav>();
  const {
    goalId,
    sessionLengthMinutes,
    growCategory: requestedGrowCategory,
    growObjectKey: requestedGrowObjectKey,
  } = route.params;

  const goals = useAppStore((s) => s.goals);
  const focusStyle = useAppStore((s) => s.focusStyle);
  const focusGrowCategory = useAppStore((s) => s.focusGrowCategory);
  const focusGrowObjectKey = useAppStore((s) => s.focusGrowObjectKey);
  const setLastCompletedSessionId = useAppStore((s) => s.setLastCompletedSessionId);
  const goalsQuery = useGoals();
  const requestedGoal = goals.find((g) => g.id === goalId);
  const reduceMotion = useReducedMotion();

  const {
    activeSession,
    startFocusSession,
    stopFocusSession,
    togglePause,
    skipBreak,
    takeBreak,
    extendFocus,
    setFlowtimeTarget,
    isRunning,
  } = usePomodoro();
  const activeGoal = activeSession
    ? goals.find((candidate) => candidate.id === activeSession.goal_id)
    : undefined;
  const goalName = activeSession?.goal_name ?? activeGoal?.name ?? requestedGoal?.name;

  const growHistory = useGrowHistory(activeSession?.goal_id ?? goalId).data ?? EMPTY_HISTORY;
  const growCategory =
    asGrowCategory(activeSession?.grow_category) ??
    asGrowCategory(requestedGrowCategory) ??
    asGrowCategory(focusGrowCategory) ??
    "plant";
  // The object picked in the start sheet grows in the ring; the store keeps it over a
  // restart, and the first object of the category is the last resort.
  // The running session decides first: reopening the start sheet and picking
  // something else must not change what this session finally awards. Route and
  // store only matter while the session is still being created.
  const growObject =
    GROW_OBJECTS[growCategory].find(
      (object) => object.key === activeSession?.grow_object_key,
    ) ??
    GROW_OBJECTS[growCategory].find((object) => object.key === requestedGrowObjectKey) ??
    GROW_OBJECTS[growCategory].find((object) => object.key === focusGrowObjectKey) ??
    GROW_OBJECTS[growCategory][0];

  const { currentSound, selectSound, volume, setVolume } = useAmbientSound();
  const [startError, setStartError] = useState(false);
  // True only while a start is really in flight. Flowtime opens on its dial
  // instead, so it must not start out looking like it is already loading.
  const [starting, setStarting] = useState(
    () => !activeSession && useAppStore.getState().focusStyle !== "flowtime",
  );
  const [stopping, setStopping] = useState(false);
  const [startAttempt, setStartAttempt] = useState(0);
  const [volumeTrackWidth, setVolumeTrackWidth] = useState(0);
  const [isAdjustingTarget, setIsAdjustingTarget] = useState(false);
  /**
   * Flowtime has no length to pick in the start sheet any more. The screen opens
   * on the dial instead, and this is the target until the session exists and
   * takes it over.
   */
  const [armedTarget, setArmedTarget] = useState(() =>
    snapFlowTarget(sessionLengthMinutes || FLOW_TARGET_DEFAULT),
  );
  const volumeTrackRef = React.useRef<View>(null);
  const volumeTrackLeftRef = React.useRef(0);
  const stoppingRef = React.useRef(false);
  /** An End Session dialog is already open; a second tap must not stack another. */
  const askingStopRef = React.useRef(false);
  const lastFlowTargetRef = React.useRef<number | null>(null);
  const flowTargetDragRef = React.useRef<{
    lastAngle: number;
    continuousIndex: number;
  } | null>(null);

  const pomodoro = activeSession?.pomodoro;
  const isFlowtime = pomodoro?.mode === "flowtime";
  const onBreak = Boolean(pomodoro?.is_break || pomodoro?.is_long_break);
  const elapsed = pomodoro?.elapsed_seconds ?? 0;
  const totalFocusedSeconds = pomodoro?.focused_seconds ?? 0;
  const storedFlowTargetMinutes =
    pomodoro?.duration_seconds && pomodoro.duration_seconds > 0
      ? pomodoro.duration_seconds / 60
      : sessionLengthMinutes;
  const flowTargetMinutes = snapFlowTarget(storedFlowTargetMinutes || FLOW_TARGET_DEFAULT);
  const flowTargetSeconds = flowTargetMinutes * 60;

  /**
   * Before the session exists the style in the store decides the mode, so the
   * dial can be set before anything has started. Afterwards the session decides,
   * because reopening the start sheet must not change a running session.
   */
  const armingFlowtime = !activeSession && focusStyle === "flowtime" && !startError;
  const targetMinutes = activeSession ? flowTargetMinutes : armedTarget;
  const canAdjustTarget = armingFlowtime || (isFlowtime && !onBreak);
  const applyTarget = useCallback(
    (minutes: number) => {
      if (activeSession) setFlowtimeTarget(minutes);
      else setArmedTarget(minutes);
    },
    [activeSession, setFlowtimeTarget],
  );

  // Interval focus + any break count down; flowtime focus counts up.
  const countsDown = !isFlowtime;
  const duration = onBreak
    ? pomodoro?.break_duration_seconds ?? 300
    : isFlowtime
      ? flowTargetSeconds
      : pomodoro?.duration_seconds ?? 1500;
  // In Flowtime the ring shows the focused time against the target. A break must
  // not drain it: the focus is still there, it is only paused, and CLAUDE.md §9.1
  // forbids the ring from ever looking like the session reset.
  const progress = isFlowtime
    ? Math.min(1, totalFocusedSeconds / flowTargetSeconds)
    : duration > 0
      ? Math.min(1, elapsed / duration)
      : 0;

  const progressAnim = useSharedValue(0);

  useEffect(() => {
    progressAnim.value = withTiming(progress, {
      duration: isAdjustingTarget ? 90 : 900,
      easing: Easing.linear,
    });
  }, [isAdjustingTarget, progress, progressAnim]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - progressAnim.value),
  }));

  // The object grows with the focused time; breaks do not add to it.
  const growReferenceSeconds = isFlowtime
    ? flowTargetSeconds
    : pomodoro?.duration_seconds ?? sessionLengthMinutes * 60;
  const growth = liveGrowth(totalFocusedSeconds, growHistory, growReferenceSeconds);
  // The object steps up a stage as the session earns bigger rewards, so the
  // building on screen is the one this session would leave on the island.
  const islandLevel = useAppStore((state) => {
    const userId = state.userConfig?.id;
    if (!userId) return 0;
    return state.islandObjectsByUser[userId]?.[growObject.key]?.level ?? 0;
  });
  const growLevel = Math.min(
    growObject.maxLevel,
    Math.max(1, islandLevel + GROW_STEPS_BY_TIER[growth.size.tier]),
  );
  const updateVolumeFromPageX = useCallback(
    (pageX: number) => {
      const nextVolume = sliderRatioFromPageX(
        pageX,
        volumeTrackLeftRef.current,
        volumeTrackWidth,
      );
      if (nextVolume !== null) setVolume(nextVolume);
    },
    [setVolume, volumeTrackWidth]
  );

  const beginFlowTargetDrag = useCallback(
    (x: number, y: number) => {
      if (!canAdjustTarget) return false;
      const angle = circularSliderAngleFromPoint(x, y, RING_DIAL_SIZE);
      if (angle === null) return false;
      flowTargetDragRef.current = {
        lastAngle: angle,
        // Carried as a fraction of a step, so a slow turn does not stall between
        // two steps and a fast one does not skip any.
        continuousIndex: flowTargetIndex(targetMinutes),
      };
      setIsAdjustingTarget(true);
      return true;
    },
    [canAdjustTarget, targetMinutes],
  );

  const moveFlowTargetDrag = useCallback(
    (x: number, y: number) => {
      const drag = flowTargetDragRef.current;
      if (!drag || !canAdjustTarget) return;
      const angle = circularSliderAngleFromPoint(x, y, RING_DIAL_SIZE);
      if (angle === null) return;

      const fullTurn = Math.PI * 2;
      let delta = angle - drag.lastAngle;
      if (delta > Math.PI) delta -= fullTurn;
      if (delta < -Math.PI) delta += fullTurn;

      drag.lastAngle = angle;
      // Nearly a whole turn is the whole scale, so the step size follows the
      // scale rather than the angle: fine at the short end, coarse at the long
      // one. Divided by the sweep, because the scale stops short of the top.
      drag.continuousIndex = Math.min(
        FLOW_TARGET_LAST_INDEX,
        Math.max(
          0,
          drag.continuousIndex +
            (delta / (fullTurn * FLOW_TARGET_SWEEP)) * FLOW_TARGET_LAST_INDEX,
        ),
      );

      const nextTarget = flowTargetAt(drag.continuousIndex);
      applyTarget(nextTarget);
      if (lastFlowTargetRef.current !== nextTarget) {
        lastFlowTargetRef.current = nextTarget;
        hapticLight();
      }
    },
    [applyTarget, canAdjustTarget],
  );

  const endFlowTargetDrag = useCallback(() => {
    flowTargetDragRef.current = null;
    lastFlowTargetRef.current = null;
    setIsAdjustingTarget(false);
  }, []);

  const nudgeFlowTarget = useCallback(
    (direction: -1 | 1) => {
      applyTarget(flowTargetAt(flowTargetIndex(targetMinutes) + direction));
      hapticLight();
    },
    [applyTarget, targetMinutes],
  );

  // A screen opened through Home's Resume action already owns an active
  // session. Mark it as started immediately so clearing that session during
  // End Session cannot trigger the auto-start effect again while the native
  // back transition is still unmounting this screen.
  const hasStartedRef = React.useRef(Boolean(activeSession));
  useEffect(() => {
    // Flowtime waits: the dial is the first step, Start comes after it.
    if (armingFlowtime) return;
    if (requestedGoal && !activeSession && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setStarting(true);
      setStartError(false);
      void startFocusSession(
        requestedGoal,
        focusStyle === "flowtime" ? armedTarget : sessionLengthMinutes,
        requestedGrowCategory,
        requestedGrowObjectKey,
      ).then(
        (started) => {
          setStarting(false);
          if (!started) setStartError(true);
        },
      );
    }
  }, [
    armingFlowtime,
    armedTarget,
    focusStyle,
    requestedGoal,
    activeSession,
    startFocusSession,
    sessionLengthMinutes,
    requestedGrowCategory,
    requestedGrowObjectKey,
    startAttempt,
  ]);

  /** Start with the target now on the dial. */
  const startArmedFlowtime = useCallback(() => {
    if (!requestedGoal || hasStartedRef.current) return;
    hasStartedRef.current = true;
    setStarting(true);
    setStartError(false);
    hapticLight();
    void startFocusSession(
      requestedGoal,
      armedTarget,
      requestedGrowCategory,
      requestedGrowObjectKey,
    ).then((started) => {
      setStarting(false);
      if (!started) {
        hasStartedRef.current = false;
        setStartError(true);
      }
    });
  }, [
    armedTarget,
    requestedGoal,
    requestedGrowCategory,
    requestedGrowObjectKey,
    startFocusSession,
  ]);

  const handleStop = useCallback(async () => {
    const session = activeSession;
    if (!session?.pomodoro || stoppingRef.current) return;
    stoppingRef.current = true;
    setStopping(true);
    const category = asGrowCategory(session.grow_category) ?? growCategory;
    const focusedSeconds = await stopFocusSession({ requestRating: false });
    if (focusedSeconds === null) {
      stoppingRef.current = false;
      setStopping(false);
      return;
    }

    if (focusedSeconds < MIN_GROW_SESSION_SECONDS) {
      // Too short to grow anything: rate it as before, or nothing when cancelled.
      if (focusedSeconds > 0) setLastCompletedSessionId(session.session_id);
      navigation.goBack();
      return;
    }

    const grow = {
      sessionId: session.session_id,
      goalId: session.goal_id,
      goalName: session.goal_name,
      durationSeconds: focusedSeconds,
      endedAt: new Date().toISOString(),
      category,
      objectKey: growObject.key,
    };
    // Kept until it is added, so closing the app on the reveal loses nothing.
    await addPendingGrow(grow).catch((error) => {
      console.warn("Could not keep the grown object for later:", error);
    });
    navigation.replace("GrowReveal", {
      sessionId: grow.sessionId,
      goalId: grow.goalId,
      goalName: grow.goalName,
      durationSeconds: grow.durationSeconds,
      category: grow.category,
      objectKey: grow.objectKey,
    });
  }, [
    activeSession,
    growCategory,
    growObject,
    navigation,
    setLastCompletedSessionId,
    stopFocusSession,
  ]);

  const requestStop = useCallback(() => {
    // The dialog is native and the clock keeps running behind it, so two quick
    // taps used to stack two of them — the second one then sat over the reveal
    // screen with a dead button.
    if (askingStopRef.current || stoppingRef.current) return;
    askingStopRef.current = true;
    const answered = () => {
      askingStopRef.current = false;
    };

    const focusedSeconds = activeSession?.pomodoro?.focused_seconds ?? 0;
    // Rounded down, and the clock keeps counting while the dialog is open, so
    // what is stored is never less than what the dialog promised.
    const wholeMinutes = Math.floor(focusedSeconds / 60);
    const saved =
      wholeMinutes >= 1
        ? `${wholeMinutes} ${wholeMinutes === 1 ? "minute" : "minutes"} of focus will be saved.`
        : "Less than a minute of focus will be saved.";
    // Every long enough session grows something. Below the line it does not, and
    // the player should hear that here — not wonder afterwards why the island
    // looks the same.
    const missingMinutes = Math.ceil((MIN_GROW_SESSION_SECONDS - focusedSeconds) / 60);
    const body =
      focusedSeconds <= 0
        ? "No focus time has been recorded yet."
        : focusedSeconds >= MIN_GROW_SESSION_SECONDS
          ? `${saved} Your island grows.`
          : `${saved} Nothing grows on your island yet — ${missingMinutes} more ${
              missingMinutes === 1 ? "minute" : "minutes"
            } and it would.`;
    Alert.alert(
      focusedSeconds > 0 ? "End focus session?" : "Cancel focus session?",
      body,
      [
        { text: "Keep Focusing", style: "cancel", onPress: answered },
        {
          text: focusedSeconds > 0 ? "End Session" : "Cancel Session",
          style: "destructive",
          onPress: () => {
            answered();
            void handleStop();
          },
        },
      ],
      { onDismiss: answered },
    );
  }, [activeSession?.pomodoro?.focused_seconds, handleStop]);

  if (!goalName) {
    return (
      <PaperScreen edges={["top", "bottom"]}>
        <View style={styles.centered}>
          {goalsQuery.isLoading || goalsQuery.isFetching ? (
            <>
              <ActivityIndicator size="large" color={PAPER.accent} />
              <Text style={[styles.secondaryText, { marginTop: 16 }]}>
                Loading goal…
              </Text>
            </>
          ) : goalsQuery.isError ? (
            <>
              <Text style={styles.secondaryText}>Goal could not be loaded</Text>
              <TextAction
                label="Try Again"
                align="center"
                onPress={() => void goalsQuery.refetch()}
                containerStyle={{ marginTop: 12 }}
                textStyle={styles.linkText}
              />
            </>
          ) : (
            <Text style={styles.secondaryText}>Goal not found</Text>
          )}
          <TextAction
            label="Back"
            align="center"
            onPress={() => navigation.goBack()}
            containerStyle={{ marginTop: 16 }}
            textStyle={styles.linkText}
          />
        </View>
      </PaperScreen>
    );
  }

  // Flowtime asks for the target here rather than in the start sheet: the ring is
  // the control, so this is where you learn it. Turning it before the first
  // second is also the only moment where nothing is lost by experimenting.
  if (armingFlowtime && !starting) {
    return (
      <PaperScreen edges={["top", "bottom"]}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(400)}
          style={styles.flex1}
        >
          <View style={styles.header}>
            <Text style={styles.goalTitle} numberOfLines={1}>
              {goalName}
            </Text>
            <Text style={styles.modeEyebrow}>FLOWTIME · COUNT UP</Text>
            <Text style={styles.modeDescription}>
              No automatic end. Set a target to aim for — the timer keeps counting
              past it, and you can turn the ring again at any time.
            </Text>
          </View>

          <View style={styles.centerArea}>
            <View style={styles.dial}>
              <View
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Flowtime focus target"
                accessibilityHint="Turn clockwise for longer or counterclockwise for shorter."
                accessibilityValue={{
                  min: 0,
                  max: FLOW_TARGET_STEPS.length - 1,
                  now: flowTargetIndex(armedTarget),
                  text: describeFlowTarget(armedTarget),
                }}
                accessibilityActions={[
                  { name: "increment", label: "Longer focus target" },
                  { name: "decrement", label: "Shorter focus target" },
                ]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "increment") nudgeFlowTarget(1);
                  else if (event.nativeEvent.actionName === "decrement") nudgeFlowTarget(-1);
                }}
                onStartShouldSetResponder={(event) =>
                  circularSliderAngleFromPoint(
                    event.nativeEvent.locationX,
                    event.nativeEvent.locationY,
                    RING_DIAL_SIZE,
                  ) !== null
                }
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(event) =>
                  beginFlowTargetDrag(
                    event.nativeEvent.locationX,
                    event.nativeEvent.locationY,
                  )
                }
                onResponderMove={(event) =>
                  moveFlowTargetDrag(
                    event.nativeEvent.locationX,
                    event.nativeEvent.locationY,
                  )
                }
                onResponderRelease={endFlowTargetDrag}
                onResponderTerminate={endFlowTargetDrag}
                onResponderTerminationRequest={() => false}
                style={styles.ringWell}
              >
                <FocusDial
                  size={RING_DIAL_SIZE}
                  stroke={RING_STROKE}
                  targetTurn={flowTargetTurn(armedTarget)}
                  // Always on here: setting the target is the whole screen.
                  showScale
                  arc={
                    <Circle
                      cx={RING_CENTER}
                      cy={RING_CENTER}
                      r={RING_RADIUS}
                      stroke={PAPER.accent}
                      strokeWidth={RING_STROKE}
                      fill="none"
                      strokeDasharray={`${RING_CIRCUMFERENCE}`}
                      strokeDashoffset={
                        RING_CIRCUMFERENCE * (1 - flowTargetTurn(armedTarget))
                      }
                      strokeLinecap="round"
                    />
                  }
                >
                  <View pointerEvents="none" style={styles.objectStage}>
                    <GrowingObject
                      category={growCategory}
                      objectKey={growObject.key}
                      level={growLevel}
                      scale={growth.visualScale}
                      resting
                      size={OBJECT_SIZE}
                    />
                  </View>
                </FocusDial>
              </View>
            </View>

            <Text style={styles.timerText}>{formatFlowTarget(armedTarget)}</Text>
            <Text style={styles.statusText}>Target</Text>
            <Text style={styles.dialHint}>
              {isAdjustingTarget
                ? "Release to keep this target"
                : "Turn the ring to set your target · 5 min to 16 h"}
            </Text>
          </View>

          <View style={styles.armFooter}>
            <Pressable
              onPress={startArmedFlowtime}
              accessibilityRole="button"
              accessibilityLabel={`Start focus with a ${describeFlowTarget(armedTarget)} target`}
              style={({ pressed }) => [
                styles.armStart,
                { transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <Text style={styles.armStartText}>Start focus</Text>
            </Pressable>
            <TextAction
              label="Back"
              align="center"
              onPress={() => navigation.goBack()}
              textStyle={styles.linkText}
            />
          </View>
        </Animated.View>
      </PaperScreen>
    );
  }

  if (!activeSession) {
    return (
      <PaperScreen edges={["top", "bottom"]}>
        <View style={styles.centered}>
          {(starting || stopping) && !startError ? (
            <>
              <ActivityIndicator size="large" color={PAPER.accent} />
              <Text style={[styles.secondaryText, { marginTop: 16 }]}>
                {stopping ? "Saving your session…" : "Starting session…"}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.errorTitle}>Session could not start</Text>
              <Text
                style={[
                  styles.secondaryText,
                  { marginTop: 10, maxWidth: 300, lineHeight: 23 },
                ]}
              >
                Check your connection, then try again. No focus time has been recorded.
              </Text>
              <TextAction
                label="Try Again"
                align="center"
                onPress={() => {
                  hasStartedRef.current = false;
                  setStartError(false);
                  setStarting(true);
                  setStartAttempt((attempt) => attempt + 1);
                }}
                containerStyle={{ marginTop: 18 }}
                textStyle={styles.linkText}
              />
              <TextAction
                label="Back"
                align="center"
                onPress={() => navigation.goBack()}
                containerStyle={{ marginTop: 4 }}
                textStyle={styles.linkText}
              />
            </>
          )}
        </View>
      </PaperScreen>
    );
  }

  const phaseLabel = pomodoro?.is_long_break
    ? "Long Break"
      : pomodoro?.is_break
      ? "Break"
      : isFlowtime
        ? "In flow"
        : `Cycle ${pomodoro?.current_cycle ?? 1}`;
  const statusLabel = isFlowtime
    ? phaseLabel
    : isRunning
      ? phaseLabel
      : `${phaseLabel} · Paused`;

  const timerSeconds =
    isFlowtime && !onBreak
      ? totalFocusedSeconds
      : countsDown
        ? Math.max(0, duration - elapsed)
        : elapsed;

  const sessionProgressLabel = isFlowtime
    ? onBreak
      ? `${formatTimer(totalFocusedSeconds)} total focus`
      : null
    : `${pomodoro?.total_cycles ?? 0} ${(pomodoro?.total_cycles ?? 0) === 1 ? "cycle" : "cycles"} completed`;
  const modeEyebrow = onBreak
    ? isFlowtime
      ? "RECOVERY · STOPWATCH"
      : "RECOVERY · COUNTDOWN"
    : isFlowtime
      ? "FLOWTIME · COUNT UP"
      : "INTERVALS · COUNTDOWN";
  const modeDescription = onBreak
    ? isFlowtime
      ? "This break counts up and ends only when you choose Resume Focus."
      : "This break ends automatically. Skip it whenever you feel ready."
    : isFlowtime
      ? "No automatic end. Take a break when your focus drops."
      : `${Math.round(duration / 60)}-minute block, then your break starts automatically.`;
  const flowTargetReached =
    isFlowtime && !onBreak && totalFocusedSeconds >= flowTargetSeconds;

  const growInfo = growCategoryInfo(growCategory);
  const growNoun = growInfo.noun.charAt(0).toUpperCase() + growInfo.noun.slice(1);
  const growLine = onBreak
    ? `${growNoun} · waiting for your focus`
    : `${growNoun} · growing ${growth.size.label.toLowerCase()}`;

  return (
    <PaperScreen edges={["top", "bottom"]}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(400)}
        style={styles.flex1}
      >
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(400).delay(80)}
          style={styles.header}
        >
          <Text style={styles.goalTitle} numberOfLines={1}>
            {goalName}
          </Text>
          <Text style={styles.modeEyebrow}>{modeEyebrow}</Text>
          <Text style={styles.modeDescription}>{modeDescription}</Text>
        </Animated.View>

        <View style={styles.centerArea}>
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(500).delay(160)}
            style={styles.dial}
          >
            <View
              accessible={canAdjustTarget}
              accessibilityRole={canAdjustTarget ? "adjustable" : undefined}
              accessibilityLabel={canAdjustTarget ? "Flowtime focus target" : undefined}
              accessibilityHint={
                canAdjustTarget
                  ? "Turn clockwise for longer or counterclockwise for shorter."
                  : undefined
              }
              accessibilityValue={
                canAdjustTarget
                  ? {
                      min: 0,
                      max: FLOW_TARGET_STEPS.length - 1,
                      now: flowTargetIndex(targetMinutes),
                      text: describeFlowTarget(targetMinutes),
                    }
                  : undefined
              }
              accessibilityActions={
                canAdjustTarget
                  ? [
                      { name: "increment", label: "Longer focus target" },
                      { name: "decrement", label: "Shorter focus target" },
                    ]
                  : undefined
              }
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === "increment") {
                  nudgeFlowTarget(1);
                } else if (event.nativeEvent.actionName === "decrement") {
                  nudgeFlowTarget(-1);
                }
              }}
              onStartShouldSetResponder={(event) =>
                canAdjustTarget &&
                circularSliderAngleFromPoint(
                  event.nativeEvent.locationX,
                  event.nativeEvent.locationY,
                  RING_DIAL_SIZE,
                ) !== null
              }
              onMoveShouldSetResponder={() => canAdjustTarget}
              onResponderGrant={(event) => {
                beginFlowTargetDrag(
                  event.nativeEvent.locationX,
                  event.nativeEvent.locationY,
                );
              }}
              onResponderMove={(event) => {
                moveFlowTargetDrag(
                  event.nativeEvent.locationX,
                  event.nativeEvent.locationY,
                );
              }}
              onResponderRelease={endFlowTargetDrag}
              onResponderTerminate={endFlowTargetDrag}
              onResponderTerminationRequest={() => false}
              style={styles.ringWell}
            >
              <FocusDial
                size={RING_DIAL_SIZE}
                stroke={RING_STROKE}
                targetTurn={canAdjustTarget ? flowTargetTurn(targetMinutes) : undefined}
                showScale={isAdjustingTarget}
                arc={
                  <AnimatedCircle
                    cx={RING_CENTER}
                    cy={RING_CENTER}
                    r={RING_RADIUS}
                    stroke={PAPER.accent}
                    strokeWidth={RING_STROKE}
                    fill="none"
                    strokeDasharray={`${RING_CIRCUMFERENCE}`}
                    strokeLinecap="round"
                    animatedProps={animatedProps}
                  />
                }
              >
                <View pointerEvents="none" style={styles.objectStage}>
                  <GrowingObject
                    category={growCategory}
                    objectKey={growObject.key}
                    level={growLevel}
                    scale={growth.visualScale}
                    resting={onBreak || !isRunning}
                    size={OBJECT_SIZE}
                  />
                </View>
              </FocusDial>
            </View>
          </Animated.View>

          <Text style={styles.timerText}>{formatTimer(timerSeconds)}</Text>
          <Text style={styles.statusText}>{statusLabel}</Text>
          <Text style={styles.growText}>{growLine}</Text>
          {isFlowtime && !onBreak ? (
            <Text style={styles.dialHint}>
              {isAdjustingTarget
                ? `Release for a ${formatFlowTarget(flowTargetMinutes)} target`
                : flowTargetReached
                  ? "Target reached · keep going or take a break"
                  : `${formatFlowTarget(flowTargetMinutes)} target · turn the ring`}
            </Text>
          ) : null}
          {sessionProgressLabel ? (
            <Text style={styles.cyclesCompleted}>{sessionProgressLabel}</Text>
          ) : null}

          <Animated.View
            entering={reduceMotion ? undefined : FadeInUp.duration(400).delay(360)}
            style={styles.controlsRow}
          >
            {!isFlowtime ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isRunning ? "Pause session" : "Resume session"
                }
                onPress={() => {
                  togglePause();
                  hapticLight();
                }}
                style={styles.pauseButtonTouch}
              >
                <View pointerEvents="none" style={styles.pauseButton}>
                  {isRunning ? (
                    <PauseIcon size={18} color="#FFFFFF" />
                  ) : (
                    <PlayIcon size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.pauseButtonLabel}>
                    {isRunning ? "Pause" : "Resume"}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {isFlowtime && !onBreak ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take a break"
                onPress={() => takeBreak()}
                style={({ pressed }) => [
                  styles.breakPillTouch,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View pointerEvents="none" style={styles.breakPill}>
                  <Text style={styles.breakPillLabel}>Break</Text>
                </View>
              </Pressable>
            ) : null}

            {!isFlowtime && !onBreak ? (
              <TextAction
                label="+5 min"
                onPress={() => extendFocus(5)}
                containerStyle={styles.inlineAction}
                textStyle={styles.linkText}
              />
            ) : null}

            {onBreak ? (
              <TextAction
                label={isFlowtime ? "Resume Focus" : "Skip"}
                onPress={() => {
                  skipBreak();
                  hapticLight();
                }}
                containerStyle={styles.inlineAction}
                textStyle={styles.linkText}
              />
            ) : null}
          </Animated.View>
        </View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInUp.duration(400).delay(440)}
          style={styles.bottomSection}
        >
          <View style={styles.musicCard}>
            <Text style={styles.sectionLabel}>Focus music</Text>
            <ScrollView
              bounces={false}
              alwaysBounceVertical={false}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.soundScroll}
              contentContainerStyle={styles.soundScrollContent}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Turn focus music off"
                accessibilityState={{ selected: !currentSound }}
                onPress={() => {
                  selectSound(null);
                  hapticLight();
                }}
                style={styles.soundPillTouch}
              >
                <View style={[styles.soundPill, !currentSound && styles.soundPillSelected]}>
                  <Text
                    style={[
                      styles.soundPillLabel,
                      !currentSound && styles.soundPillLabelSelected,
                    ]}
                  >
                    Off
                  </Text>
                </View>
              </Pressable>

              {AMBIENT_SOUNDS.map((s) => {
                const isSelected = currentSound === s.key;
                return (
                  <Pressable
                    key={s.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${SOUND_LABELS[s.key] ?? s.label}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      selectSound(s.key as AmbientSoundKey);
                      hapticLight();
                    }}
                    style={styles.soundPillTouch}
                  >
                    <View style={[styles.soundPill, isSelected && styles.soundPillSelected]}>
                      <Text
                        style={[
                          styles.soundPillLabel,
                          isSelected && styles.soundPillLabelSelected,
                        ]}
                      >
                        {SOUND_LABELS[s.key] ?? s.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {currentSound && (
              <View style={styles.volumeRow}>
                <Text style={styles.volumeLabel}>Vol</Text>
                <View style={styles.volumeTrack}>
                  <View
                    ref={volumeTrackRef}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Focus music volume"
                    accessibilityValue={{ min: 0, max: 100, now: Math.round(volume * 100) }}
                    accessibilityActions={[
                      { name: "increment", label: "Increase volume" },
                      { name: "decrement", label: "Decrease volume" },
                    ]}
                    onAccessibilityAction={(event) => {
                      const step = event.nativeEvent.actionName === "increment" ? 0.1 : -0.1;
                      setVolume(Math.max(0, Math.min(1, volume + step)));
                    }}
                    onLayout={(event) => {
                      setVolumeTrackWidth(event.nativeEvent.layout.width);
                      volumeTrackRef.current?.measureInWindow((x) => {
                        volumeTrackLeftRef.current = x;
                      });
                    }}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(event) => {
                      updateVolumeFromPageX(event.nativeEvent.pageX);
                    }}
                    onResponderMove={(event) => {
                      updateVolumeFromPageX(event.nativeEvent.pageX);
                    }}
                    style={styles.volumeTouchArea}
                  >
                    <View pointerEvents="none" style={styles.volumeTrackBg} />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.volumeFill,
                        { width: `${volume * 100}%` },
                      ]}
                    />
                    <View
                      pointerEvents="none"
                      style={[
                        styles.volumeThumb,
                        {
                          left: sliderThumbLeft(
                            volume,
                            volumeTrackWidth,
                            12,
                          ),
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          <TextAction
            label={stopping ? "Ending…" : "End session"}
            align="center"
            onPress={requestStop}
            disabled={stopping}
            containerStyle={styles.endAction}
            textStyle={styles.endText}
          />
        </Animated.View>
      </Animated.View>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  armFooter: { paddingHorizontal: 24, paddingBottom: 8, gap: 4 },
  armStart: {
    height: 54,
    borderRadius: 16,
    backgroundColor: PAPER.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  armStartText: { fontFamily: NEU_FONTS.label, fontSize: 17, color: "#FFFFFF" },
  flex1: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: PAPER.gutter,
  },
  secondaryText: {
    color: PAPER.inkMuted,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
  },
  errorTitle: {
    color: PAPER.ink,
    fontSize: 24,
    fontFamily: NEU_FONTS.heading,
    textAlign: "center",
  },
  linkText: {
    color: PAPER.accentInk,
  },

  header: {
    alignItems: "center",
    paddingHorizontal: PAPER.gutter,
    paddingTop: 12,
  },
  goalTitle: {
    color: PAPER.ink,
    fontSize: 17,
    fontFamily: NEU_FONTS.label,
    maxWidth: 300,
  },
  modeEyebrow: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1,
    marginTop: 6,
  },
  modeDescription: {
    color: PAPER.inkMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 3,
    maxWidth: 300,
  },

  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 8,
  },
  dial: {
    width: RING_DIAL_SIZE,
    height: RING_DIAL_SIZE,
    borderRadius: RING_DIAL_SIZE / 2,
    backgroundColor: PAPER.surface,
  },
  ringWell: {
    width: RING_DIAL_SIZE,
    height: RING_DIAL_SIZE,
    borderRadius: RING_DIAL_SIZE / 2,
    overflow: "hidden",
  },
  ringSvg: {
    position: "absolute",
  },
  objectStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 34,
  },
  timerText: {
    color: PAPER.ink,
    fontSize: 48,
    lineHeight: 56,
    fontFamily: NEU_FONTS.heading,
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
    marginTop: 18,
  },
  statusText: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
  },
  growText: {
    color: PAPER.accentInk,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
    marginTop: 6,
  },
  dialHint: {
    color: PAPER.inkFaint,
    fontSize: 12,
    fontFamily: NEU_FONTS.body,
    marginTop: 4,
  },
  cyclesCompleted: {
    color: PAPER.inkMuted,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 4,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 14,
  },
  pauseButtonTouch: {
    minWidth: 112,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseButton: {
    minWidth: 108,
    height: 48,
    borderRadius: 999,
    backgroundColor: PAPER.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  pauseButtonLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },
  breakPillTouch: {
    minHeight: PAPER.hitTarget,
    justifyContent: "center",
  },
  breakPill: {
    height: 40,
    borderRadius: 999,
    backgroundColor: PAPER.surface,
    borderWidth: 1,
    borderColor: PAPER.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  breakPillLabel: {
    color: PAPER.accentInk,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },
  inlineAction: {
    minWidth: 60,
  },

  bottomSection: {
    paddingHorizontal: PAPER.gutter,
    paddingBottom: 4,
  },
  musicCard: {
    backgroundColor: PAPER.surface,
    borderRadius: PAPER.radius,
    borderWidth: 1,
    borderColor: PAPER.line,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  sectionLabel: {
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginLeft: 2,
  },
  soundScroll: {
    marginBottom: 4,
  },
  soundScrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    gap: 2,
  },

  soundPillTouch: {
    minHeight: PAPER.hitTarget,
    minWidth: PAPER.hitTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  soundPill: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PAPER.line,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAPER.surface,
  },
  soundPillSelected: {
    borderColor: PAPER.accent,
    backgroundColor: PAPER.accentWash,
  },
  soundPillLabel: {
    color: PAPER.inkMuted,
    fontSize: 12,
    fontFamily: NEU_FONTS.body,
  },
  soundPillLabelSelected: {
    color: PAPER.accentInk,
    fontFamily: NEU_FONTS.label,
  },

  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  volumeLabel: {
    fontSize: 12,
    fontFamily: NEU_FONTS.body,
    color: PAPER.inkMuted,
  },
  volumeTrack: {
    flex: 1,
    height: PAPER.hitTarget,
    justifyContent: "center",
  },
  volumeTouchArea: {
    flex: 1,
    height: PAPER.hitTarget,
    justifyContent: "center",
  },
  volumeTrackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: PAPER.sunken,
  },
  volumeFill: {
    position: "absolute",
    left: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: PAPER.accent,
  },
  volumeThumb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    top: (PAPER.hitTarget - 12) / 2,
    backgroundColor: PAPER.accent,
  },

  endAction: {
    alignSelf: "center",
    marginTop: 4,
  },
  endText: {
    color: PAPER.inkMuted,
    fontSize: 16,
  },
});
