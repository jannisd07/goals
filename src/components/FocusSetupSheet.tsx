import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CYCLES_BEFORE_LONG_BREAK, type FocusStyle } from "../types";
import {
  MAX_SESSION_MINUTES,
  MIN_SESSION_MINUTES,
  computeAdaptiveBreakMinutes,
  sessionMinutesToRatio,
  sessionRatioToMinutes,
} from "../lib/pomodoro";
import { PopupCard } from "./ui/PopupCard";
import { PrimaryButton } from "./ui/PrimaryButton";
import { TextAction } from "./ui/TextAction";
import { FocusModeSwitch } from "./ui/FocusModeSwitch";
import { hapticLight } from "../lib/haptics";
import { sliderRatioFromPageX, sliderThumbLeft } from "../lib/sliders";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

const PRESET_MINUTES = [15, 25, 45, 60];

interface FocusSetupSheetProps {
  visible: boolean;
  goalName: string;
  initialMinutes: number;
  initialStyle: FocusStyle;
  baseBreakMinutes?: number;
  onClose: () => void;
  onConfirm: (minutes: number, style: FocusStyle) => void;
}

/**
 * Pre-session popup, opened via long-press on the Start pill (one-tap starts
 * directly with the last configuration). Lets the user pick focus style and,
 * for intervals, the block length.
 */
export function FocusSetupSheet({
  visible,
  goalName,
  initialMinutes,
  initialStyle,
  baseBreakMinutes = 5,
  onClose,
  onConfirm,
}: FocusSetupSheetProps) {
  const [style, setStyle] = useState<FocusStyle>(initialStyle);
  const [ratio, setRatio] = useState(sessionMinutesToRatio(initialMinutes));
  const [sliderWidth, setSliderWidth] = useState(0);
  const sliderRef = useRef<View>(null);
  const sliderLeftRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setStyle(initialStyle);
    setRatio(sessionMinutesToRatio(initialMinutes));
  }, [visible, initialMinutes, initialStyle]);

  const minutes = useMemo(() => sessionRatioToMinutes(ratio), [ratio]);
  const breakPlan = useMemo(
    () => computeAdaptiveBreakMinutes(minutes, baseBreakMinutes),
    [minutes, baseBreakMinutes],
  );

  const updateByPageX = useCallback(
    (pageX: number) => {
      const nextRatio = sliderRatioFromPageX(
        pageX,
        sliderLeftRef.current,
        sliderWidth,
      );
      if (nextRatio !== null) setRatio(nextRatio);
    },
    [sliderWidth],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => updateByPageX(event.nativeEvent.pageX),
        onPanResponderMove: (event) => updateByPageX(event.nativeEvent.pageX),
      }),
    [updateByPageX],
  );

  const thumbLeft = ratio * sliderWidth;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close focus setup"
        />

        <PopupCard>
          <Text style={styles.title}>Focus Session</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {goalName}
          </Text>

          <Text style={styles.modePrompt}>Choose how time should move</Text>
          <FocusModeSwitch value={style} onChange={setStyle} style={styles.modeSwitch} />

          {style === "interval" ? (
            <>
              <View style={styles.modeExplanation}>
                <Text style={styles.modeExplanationTitle}>Structured focus block</Text>
                <Text style={styles.modeExplanationText}>
                  Counts down and starts a planned break automatically.
                </Text>
              </View>

              <Text style={styles.value}>{minutes} min block</Text>

              {/* Presets */}
              <View style={styles.presetRow}>
                {PRESET_MINUTES.map((preset) => {
                  const active = minutes === preset;
                  return (
                    <Pressable
                      key={preset}
                      onPress={() => {
                        setRatio(sessionMinutesToRatio(preset));
                        hapticLight();
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${preset} minutes`}
                      style={styles.presetTouch}
                    >
                      <View style={[styles.preset, active && styles.presetActive]}>
                        <Text style={[styles.presetLabel, active && styles.presetLabelActive]}>
                          {preset}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Slider */}
              <View
                ref={sliderRef}
                style={styles.sliderTouchArea}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Session length"
                accessibilityValue={{
                  min: MIN_SESSION_MINUTES,
                  max: MAX_SESSION_MINUTES,
                  now: minutes,
                  text: `${minutes} minutes`,
                }}
                accessibilityActions={[
                  { name: "increment", label: "Increase session length" },
                  { name: "decrement", label: "Decrease session length" },
                ]}
                onAccessibilityAction={(event) => {
                  const delta = event.nativeEvent.actionName === "increment" ? 0.05 : -0.05;
                  setRatio((current) => Math.max(0, Math.min(1, current + delta)));
                }}
                onLayout={(event) => {
                  setSliderWidth(Math.max(0, event.nativeEvent.layout.width));
                  sliderRef.current?.measureInWindow((x) => {
                    sliderLeftRef.current = x;
                  });
                }}
                {...panResponder.panHandlers}
              >
                <View pointerEvents="none" style={styles.sliderTrack} />
                <View
                  pointerEvents="none"
                  style={[styles.sliderFill, { width: thumbLeft }]}
                />
                <View
                  pointerEvents="none"
                  style={[
                    styles.sliderThumb,
                    {
                      left: sliderThumbLeft(ratio, sliderWidth, 24),
                    },
                  ]}
                />
              </View>

              <Text style={styles.hint}>
                Breaks: {breakPlan.shortBreakMinutes}m short · {breakPlan.longBreakMinutes}m long
                every {CYCLES_BEFORE_LONG_BREAK} blocks
              </Text>
            </>
          ) : (
            <View style={styles.flowtimeBox}>
              <Text style={styles.flowtimeTitle}>Open-ended focus</Text>
              <Text style={styles.flowtimeText}>
                Starts at 00:00 and counts up. You decide when to tap Break; Goals then suggests
                a recovery of about one fifth of your focus time.
              </Text>
              <View style={styles.flowTargetNote}>
                <Text style={styles.flowTargetTitle}>
                  Ring target · {minutes} min
                </Text>
                <Text style={styles.flowTargetText}>
                  Visual guide only. Drag the ring during focus; the timer never stops at the target.
                </Text>
              </View>
            </View>
          )}

          <View style={styles.actionColumn}>
            <PrimaryButton
              label={style === "interval" ? "Start Interval" : "Start Flowtime"}
              onPress={() => onConfirm(minutes, style)}
            />
            <TextAction label="Cancel" align="center" onPress={onClose} containerStyle={styles.cancel} />
          </View>
        </PopupCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.32)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: NEU.textPrimary,
    fontSize: 22,
    fontFamily: NEU_FONTS.heading,
    textAlign: "center",
  },
  subtitle: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 2,
  },
  modePrompt: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.label,
    textAlign: "center",
    marginTop: 16,
  },
  modeSwitch: {
    marginTop: 10,
  },
  modeExplanation: {
    borderLeftWidth: 2,
    borderLeftColor: NEU.accent,
    paddingLeft: 12,
    marginTop: 16,
  },
  modeExplanationTitle: {
    color: NEU.textPrimary,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },
  modeExplanationText: {
    color: NEU.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: NEU_FONTS.body,
    marginTop: 2,
  },
  value: {
    color: NEU.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontFamily: NEU_FONTS.heading,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginBottom: 6,
  },
  presetTouch: {
    minHeight: NEU.hitTarget,
    justifyContent: "center",
  },
  preset: {
    minWidth: 52,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NEU.track,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NEU.card,
    paddingHorizontal: 12,
  },
  presetActive: {
    borderColor: NEU.accent,
    backgroundColor: NEU.accent,
  },
  presetLabel: {
    color: NEU.textPrimary,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
  },
  presetLabelActive: {
    color: "#FFFFFF",
  },
  sliderTouchArea: {
    minHeight: NEU.hitTarget,
    justifyContent: "center",
  },
  sliderTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: NEU.track,
  },
  sliderFill: {
    position: "absolute",
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: NEU.accent,
  },
  sliderThumb: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: NEU.accent,
  },
  hint: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 10,
  },
  flowtimeBox: {
    marginTop: 16,
    marginBottom: 4,
    borderLeftWidth: 2,
    borderLeftColor: NEU.accent,
    paddingLeft: 14,
  },
  flowtimeTitle: {
    color: NEU.textPrimary,
    fontSize: 16,
    fontFamily: NEU_FONTS.label,
  },
  flowtimeText: {
    color: NEU.textSecondary,
    fontSize: 16,
    fontFamily: NEU_FONTS.body,
    lineHeight: 23,
    marginTop: 8,
  },
  flowTargetNote: {
    marginTop: 14,
  },
  flowTargetTitle: {
    color: NEU.accent,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
  },
  flowTargetText: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: NEU_FONTS.body,
    lineHeight: 18,
    marginTop: 3,
  },
  actionColumn: {
    marginTop: 18,
  },
  cancel: {
    marginTop: 4,
    alignSelf: "center",
  },
});
