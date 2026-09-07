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
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  FadeIn,
  FadeInUp,
  FadeInDown,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, G } from "react-native-svg";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { usePomodoro } from "../hooks/usePomodoro";
import { useAmbientSound } from "../hooks/useAmbientSound";
import { useGoals } from "../hooks/useGoals";
import { useAppStore } from "../store";
import { hapticLight } from "../lib/haptics";
import {
  circularSliderAngleFromPoint,
  sliderRatioFromPageX,
  sliderThumbLeft,
} from "../lib/sliders";
import { formatTimer } from "../lib/time";
import { AMBIENT_SOUNDS } from "../types";
import type { AmbientSoundKey } from "../types";
import type { RootStackParamList } from "../navigation/types";
import { PauseIcon, PlayIcon } from "../components/TabIcons";
import { NeumorphicSurface } from "../components/NeumorphicSurface";
import { TextAction } from "../components/ui/TextAction";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 260;
const RING_DIAL_SIZE = RING_SIZE;
const RING_STROKE = 6;
const RING_RADIUS = (RING_DIAL_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_CENTER = RING_DIAL_SIZE / 2;
const FLOW_TARGET_MIN_MINUTES = 5;
const FLOW_TARGET_MAX_MINUTES = 240;
const FLOW_TARGET_STEP_MINUTES = 5;

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
  const { goalId, sessionLengthMinutes } = route.params;

  const goals = useAppStore((s) => s.goals);
  const goalsQuery = useGoals();
  const requestedGoal = goals.find((g) => g.id === goalId);

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

  const { currentSound, selectSound, volume, setVolume } = useAmbientSound();
  const [startError, setStartError] = useState(false);
  const [starting, setStarting] = useState(!activeSession);
  const [stopping, setStopping] = useState(false);
  const [startAttempt, setStartAttempt] = useState(0);
  const [volumeTrackWidth, setVolumeTrackWidth] = useState(0);
  const [isAdjustingTarget, setIsAdjustingTarget] = useState(false);
  const volumeTrackRef = React.useRef<View>(null);
  const volumeTrackLeftRef = React.useRef(0);
  const stoppingRef = React.useRef(false);
  const lastFlowTargetRef = React.useRef<number | null>(null);
  const flowTargetDragRef = React.useRef<{
    lastAngle: number;
    continuousMinutes: number;
  } | null>(null);

  const pomodoro = activeSession?.pomodoro;
  const isFlowtime = pomodoro?.mode === "flowtime";
  const onBreak = Boolean(pomodoro?.is_break || pomodoro?.is_long_break);
  const elapsed = pomodoro?.elapsed_seconds ?? 0;
  const totalFocusedSeconds = pomodoro?.focused_seconds ?? 0;
  const minimumFlowTargetMinutes = FLOW_TARGET_MIN_MINUTES;
  const maximumFlowTargetMinutes = Math.max(
    FLOW_TARGET_MAX_MINUTES,
    Math.ceil(totalFocusedSeconds / (FLOW_TARGET_STEP_MINUTES * 60)) *
      FLOW_TARGET_STEP_MINUTES +
      60,
  );
  const storedFlowTargetMinutes = Math.round(
    ((pomodoro?.duration_seconds && pomodoro.duration_seconds > 0
      ? pomodoro.duration_seconds
      : sessionLengthMinutes * 60) / 60) /
      FLOW_TARGET_STEP_MINUTES,
  ) * FLOW_TARGET_STEP_MINUTES;
  const flowTargetMinutes = Math.max(
    minimumFlowTargetMinutes,
    storedFlowTargetMinutes || 25,
  );
  const flowTargetSeconds = flowTargetMinutes * 60;

  // Interval focus + any break count down; flowtime focus counts up.
  const countsDown = !isFlowtime;
  const duration = onBreak
    ? pomodoro?.break_duration_seconds ?? 300
    : isFlowtime
      ? flowTargetSeconds
      : pomodoro?.duration_seconds ?? 1500;
  const progress =
    isFlowtime && onBreak
      ? 0
      : isFlowtime && !onBreak
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
      if (!isFlowtime || onBreak) return false;
      const angle = circularSliderAngleFromPoint(x, y, RING_DIAL_SIZE);
      if (angle === null) return false;
      flowTargetDragRef.current = {
        lastAngle: angle,
        continuousMinutes: flowTargetMinutes,
      };
      setIsAdjustingTarget(true);
      return true;
    },
    [flowTargetMinutes, isFlowtime, onBreak],
  );

  const moveFlowTargetDrag = useCallback(
    (x: number, y: number) => {
      const drag = flowTargetDragRef.current;
      if (!drag || !isFlowtime || onBreak) return;
      const angle = circularSliderAngleFromPoint(x, y, RING_DIAL_SIZE);
      if (angle === null) return;

      const fullTurn = Math.PI * 2;
      let delta = angle - drag.lastAngle;
      if (delta > Math.PI) delta -= fullTurn;
      if (delta < -Math.PI) delta += fullTurn;

      drag.lastAngle = angle;
      drag.continuousMinutes = Math.min(
        maximumFlowTargetMinutes,
        Math.max(
          minimumFlowTargetMinutes,
          drag.continuousMinutes +
            (delta / fullTurn) *
              (maximumFlowTargetMinutes - minimumFlowTargetMinutes),
        ),
      );

      const nextTarget =
        Math.round(drag.continuousMinutes / FLOW_TARGET_STEP_MINUTES) *
        FLOW_TARGET_STEP_MINUTES;
      setFlowtimeTarget(nextTarget);
      if (lastFlowTargetRef.current !== nextTarget) {
        lastFlowTargetRef.current = nextTarget;
        hapticLight();
      }
    },
    [
      isFlowtime,
      maximumFlowTargetMinutes,
      minimumFlowTargetMinutes,
      onBreak,
      setFlowtimeTarget,
    ],
  );

  const endFlowTargetDrag = useCallback(() => {
    flowTargetDragRef.current = null;
    lastFlowTargetRef.current = null;
    setIsAdjustingTarget(false);
  }, []);

  const nudgeFlowTarget = useCallback(
    (direction: -1 | 1) => {
      const nextTarget = Math.min(
        maximumFlowTargetMinutes,
        Math.max(
          minimumFlowTargetMinutes,
          flowTargetMinutes + direction * FLOW_TARGET_STEP_MINUTES,
        ),
      );
      setFlowtimeTarget(nextTarget);
      hapticLight();
    },
    [
      flowTargetMinutes,
      maximumFlowTargetMinutes,
      minimumFlowTargetMinutes,
      setFlowtimeTarget,
    ],
  );

  // A screen opened through Home's Resume action already owns an active
  // session. Mark it as started immediately so clearing that session during
  // End Session cannot trigger the auto-start effect again while the native
  // back transition is still unmounting this screen.
  const hasStartedRef = React.useRef(Boolean(activeSession));
  useEffect(() => {
    if (requestedGoal && !activeSession && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setStarting(true);
      setStartError(false);
      void startFocusSession(requestedGoal, sessionLengthMinutes).then((started) => {
        setStarting(false);
        if (!started) setStartError(true);
      });
    }
  }, [requestedGoal, activeSession, startFocusSession, sessionLengthMinutes, startAttempt]);

  const handleStop = useCallback(async () => {
    if (!activeSession?.pomodoro || stoppingRef.current) return;
    stoppingRef.current = true;
    setStopping(true);
    const duration = await stopFocusSession();
    if (duration === null) {
      stoppingRef.current = false;
      setStopping(false);
      return;
    }
    navigation.goBack();
  }, [activeSession, navigation, stopFocusSession]);

  const requestStop = useCallback(() => {
    const focusedSeconds = activeSession?.pomodoro?.focused_seconds ?? 0;
    const roundedMinutes = Math.max(1, Math.round(focusedSeconds / 60));
    Alert.alert(
      focusedSeconds > 0 ? "End focus session?" : "Cancel focus session?",
      focusedSeconds > 0
        ? `${roundedMinutes} ${roundedMinutes === 1 ? "minute" : "minutes"} of focus will be saved.`
        : "No focus time has been recorded yet.",
      [
        { text: "Keep Focusing", style: "cancel" },
        {
          text: focusedSeconds > 0 ? "End Session" : "Cancel Session",
          style: "destructive",
          onPress: () => void handleStop(),
        },
      ],
    );
  }, [activeSession?.pomodoro?.focused_seconds, handleStop]);

  if (!goalName) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          {goalsQuery.isLoading || goalsQuery.isFetching ? (
            <>
              <ActivityIndicator size="large" color={NEU.accent} />
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
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!activeSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          {starting && !startError ? (
            <>
              <ActivityIndicator size="large" color={NEU.accent} />
              <Text style={[styles.secondaryText, { marginTop: 16 }]}>
                Starting session…
              </Text>
            </>
          ) : (
            <>
              <Text
                style={{
                  color: NEU.textPrimary,
                  fontSize: 24,
                  fontFamily: NEU_FONTS.heading,
                  textAlign: "center",
                }}
              >
                Session could not start
              </Text>
              <Text
                style={[
                  styles.secondaryText,
                  { marginTop: 10, textAlign: "center", maxWidth: 300, lineHeight: 23 },
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
              />
              <TextAction
                label="Back"
                align="center"
                onPress={() => navigation.goBack()}
                containerStyle={{ marginTop: 4 }}
              />
            </>
          )}
        </View>
      </SafeAreaView>
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
      : "One continuous Flowtime session"
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
      ? "No automatic end — take a break when your focus naturally drops."
      : `${Math.round(duration / 60)}-minute block — your break starts automatically.`;
  const flowTargetReached =
    isFlowtime && !onBreak && totalFocusedSeconds >= flowTargetSeconds;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.flex1}>
        {/* Top bar */}
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.topBar}
        >
          <View style={styles.topBarSpacer} />
          <View style={styles.topBarSpacer} />
        </Animated.View>

        {/* Center content: ring + timer */}
        <View style={styles.centerArea}>
          <Animated.View
            entering={FadeInDown.duration(400).delay(180)}
            style={styles.modeHeader}
          >
            <Text style={styles.modeEyebrow}>{modeEyebrow}</Text>
            <Text style={styles.modeDescription}>{modeDescription}</Text>
          </Animated.View>

          <Animated.View
            entering={FadeIn.duration(600).delay(300)}
            style={styles.ringOuterWrap}
          >
            <NeumorphicSurface
              radius={RING_SIZE / 2}
              contentPadding={0}
              lightShadowOpacity={0.52}
              darkShadowOpacity={0.62}
              style={styles.ringContainer}
            >
                <View style={styles.ringFace}>
                <View
                  accessible={isFlowtime && !onBreak}
                  accessibilityRole={isFlowtime && !onBreak ? "adjustable" : undefined}
                  accessibilityLabel={
                    isFlowtime && !onBreak ? "Flowtime focus target" : undefined
                  }
                  accessibilityHint={
                    isFlowtime && !onBreak
                      ? "Drag clockwise for longer or counterclockwise for shorter."
                      : undefined
                  }
                  accessibilityValue={
                    isFlowtime && !onBreak
                      ? {
                          min: minimumFlowTargetMinutes,
                          max: maximumFlowTargetMinutes,
                          now: flowTargetMinutes,
                          text: `${flowTargetMinutes} minutes`,
                        }
                      : undefined
                  }
                  accessibilityActions={
                    isFlowtime && !onBreak
                      ? [
                          { name: "increment", label: "Increase focus target" },
                          { name: "decrement", label: "Decrease focus target" },
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
                    isFlowtime &&
                    !onBreak &&
                    circularSliderAngleFromPoint(
                      event.nativeEvent.locationX,
                      event.nativeEvent.locationY,
                      RING_DIAL_SIZE,
                    ) !== null
                  }
                  onMoveShouldSetResponder={() => isFlowtime && !onBreak}
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
                  <Svg
                    width={RING_DIAL_SIZE}
                    height={RING_DIAL_SIZE}
                    style={styles.ringSvg}
                  >
                    <G
                      transform={`rotate(-90 ${RING_CENTER} ${RING_CENTER})`}
                    >
                      <Circle
                        cx={RING_CENTER}
                        cy={RING_CENTER}
                        r={RING_RADIUS}
                        stroke={NEU.track}
                        strokeWidth={RING_STROKE}
                        fill="none"
                      />
                      <AnimatedCircle
                        cx={RING_CENTER}
                        cy={RING_CENTER}
                        r={RING_RADIUS}
                        stroke={NEU.accent}
                        strokeWidth={RING_STROKE}
                        fill="none"
                        strokeDasharray={`${RING_CIRCUMFERENCE}`}
                        strokeLinecap="round"
                        animatedProps={animatedProps}
                      />
                    </G>
                  </Svg>
                </View>

                <View pointerEvents="none" style={styles.ringContent}>
                  <Text style={styles.timerText}>
                    {formatTimer(timerSeconds)}
                  </Text>
                  <Text style={styles.cycleLabel}>{statusLabel}</Text>
                  <Text
                    style={styles.goalNameSmall}
                    numberOfLines={1}
                  >
                    {goalName}
                  </Text>
                  {isFlowtime && !onBreak ? (
                    <Text style={styles.dialHint}>
                      {isAdjustingTarget
                        ? `Release for ${flowTargetMinutes} min target`
                        : flowTargetReached
                          ? "Target reached · keep going or take a break"
                          : `${flowTargetMinutes} min visual target · drag ring`}
                    </Text>
                  ) : null}
                </View>
              </View>
            </NeumorphicSurface>
          </Animated.View>

          {pomodoro && (
            <Animated.Text
              entering={FadeIn.duration(400).delay(400)}
              style={styles.cyclesCompleted}
            >
              {sessionProgressLabel}
            </Animated.Text>
          )}

          {/* Controls */}
          <Animated.View
            entering={FadeInUp.duration(400).delay(500)}
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
              />
            ) : null}
          </Animated.View>
        </View>

        {/* Bottom section: sounds + end */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(600)}
          style={styles.bottomSection}
        >
          <Text style={styles.sectionLabel}>Focus Music</Text>
          <ScrollView
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

          {/* Volume slider */}
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

          <TextAction
            label={stopping ? "Ending…" : "End Session"}
            align="center"
            onPress={requestStop}
            disabled={stopping}
            containerStyle={styles.endAction}
          />
        </Animated.View>
      </Animated.View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEU.bg,
  },
  flex1: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: NEU.textSecondary,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topBarSpacer: {
    flex: 1,
  },

  centerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 20,
  },
  modeHeader: {
    width: RING_SIZE,
    alignItems: "center",
    marginBottom: 16,
  },
  modeEyebrow: {
    color: NEU.accent,
    fontSize: 12,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1.2,
  },
  modeDescription: {
    color: NEU.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 5,
  },

  ringOuterWrap: {
    marginBottom: 20,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
  },
  ringFace: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  ringWell: {
    width: RING_DIAL_SIZE,
    height: RING_DIAL_SIZE,
    borderRadius: RING_DIAL_SIZE / 2,
    backgroundColor: NEU.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  ringSvg: {
    position: "absolute",
  },
  ringContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: {
    color: NEU.textPrimary,
    fontSize: 48,
    fontFamily: NEU_FONTS.heading,
    letterSpacing: 2,
    lineHeight: 56,
  },
  cycleLabel: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  goalNameSmall: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
    maxWidth: RING_DIAL_SIZE - 52,
    textAlign: "center",
  },
  dialHint: {
    color: NEU.accent,
    fontSize: 12,
    fontFamily: NEU_FONTS.label,
    marginTop: 8,
    letterSpacing: 0.2,
  },

  cyclesCompleted: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    marginBottom: 24,
  },

  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
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
    backgroundColor: NEU.accent,
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
    minHeight: NEU.hitTarget,
    justifyContent: "center",
  },
  breakPill: {
    height: 34,
    borderRadius: 999,
    backgroundColor: NEU.card,
    borderWidth: 1,
    borderColor: NEU.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  breakPillLabel: {
    color: NEU.accent,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
  },
  inlineAction: {
    minWidth: 60,
  },

  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionLabel: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  soundScroll: {
    marginBottom: 12,
  },
  soundScrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    gap: 2,
  },

  soundPillTouch: {
    minHeight: NEU.hitTarget,
    minWidth: NEU.hitTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  soundPill: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NEU.track,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEU.card,
  },
  soundPillSelected: {
    borderColor: NEU.accent,
    backgroundColor: NEU.accent,
  },
  soundPillLabel: {
    color: NEU.textPrimary,
    fontSize: 12,
    fontFamily: NEU_FONTS.body,
  },
  soundPillLabelSelected: {
    color: "#FFFFFF",
  },

  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  volumeLabel: {
    fontSize: 12,
    fontFamily: NEU_FONTS.body,
    color: NEU.textSecondary,
  },
  volumeTrack: {
    flex: 1,
    height: NEU.hitTarget,
    justifyContent: "center",
  },
  volumeTouchArea: {
    flex: 1,
    height: NEU.hitTarget,
    justifyContent: "center",
  },
  volumeTrackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: NEU.track,
  },
  volumeFill: {
    position: "absolute",
    left: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: NEU.accent,
  },
  volumeThumb: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    top: (NEU.hitTarget - 12) / 2,
    backgroundColor: NEU.accent,
  },

  endAction: {
    alignSelf: "center",
    marginTop: 4,
  },
});
