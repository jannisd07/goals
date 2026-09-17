/**
 * The focus ring, and in Flowtime the thing you turn to set your target.
 *
 * Two jobs on one circle, kept apart so neither can be misread:
 *
 *   * The **accent arc** is always progress — how much of the target is worked.
 *     It never moves because you turned the ring.
 *   * The **target marker** is a short notch on the rail, sitting where the
 *     target is on the scale. Turning moves that notch, not the arc.
 *
 * The scale itself only appears while you are turning (and before the session
 * starts, when setting the target is the whole point). Otherwise the ring stays
 * the quiet progress ring CLAUDE.md §9.1 asks for. That is the trick that makes
 * a non-linear scale readable without cluttering a running timer: ticks sit
 * where the steps are, so the crowding at the short end and the wide spacing at
 * the long end are visible rather than surprising.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";
import {
  FLOW_TARGET_LABELLED,
  FLOW_TARGET_STEPS,
  FLOW_TARGET_SWEEP,
  flowTargetTurn,
  formatFlowTarget,
} from "../../lib/flowTarget";
import { PAPER } from "../../theme/paper";
import { NEU_FONTS } from "../../theme/neumorphism";

interface Props {
  size: number;
  stroke: number;
  /** The accent arc, handed in by the screen so it can be animated there. */
  arc: React.ReactNode;
  /** Where the target sits on the scale, 0 at the top and 1 after a full turn. */
  targetTurn?: number;
  /** Ticks and labels: on while turning, and while the target is still being set. */
  showScale?: boolean;
  /** What grows in the middle. */
  children?: React.ReactNode;
}

/**
  * How far inside the tick a label sits. Tight to the rail on purpose: the middle
  * of the dial belongs to the growing object, and a label drifting inwards starts
  * to collide with it.
  */
const LABEL_GAP = 11;

export function FocusDial({ size, stroke, arc, targetTurn, showScale, children }: Props) {
  const centre = size / 2;
  const radius = (size - stroke) / 2;

  const ticks = React.useMemo(() => {
    if (!showScale) return [];
    const last = FLOW_TARGET_STEPS.length - 1;
    return FLOW_TARGET_STEPS.map((minutes, index) => {
      const turn = (index / last) * FLOW_TARGET_SWEEP;
      const angle = turn * Math.PI * 2 - Math.PI / 2;
      const labelled = FLOW_TARGET_LABELLED.includes(minutes);
      const length = labelled ? 9 : 5;
      const inner = radius - stroke / 2 - 3;
      return {
        minutes,
        labelled,
        x1: centre + Math.cos(angle) * (inner - length),
        y1: centre + Math.sin(angle) * (inner - length),
        x2: centre + Math.cos(angle) * inner,
        y2: centre + Math.sin(angle) * inner,
        labelX: centre + Math.cos(angle) * (inner - length - LABEL_GAP),
        labelY: centre + Math.sin(angle) * (inner - length - LABEL_GAP),
      };
    });
  }, [showScale, centre, radius, stroke]);

  const marker = React.useMemo(() => {
    if (targetTurn === undefined) return null;
    const angle = targetTurn * Math.PI * 2 - Math.PI / 2;
    const outer = radius + stroke / 2 + 4;
    const inner = radius - stroke / 2 - 4;
    return {
      x1: centre + Math.cos(angle) * inner,
      y1: centre + Math.sin(angle) * inner,
      x2: centre + Math.cos(angle) * outer,
      y2: centre + Math.sin(angle) * outer,
    };
  }, [targetTurn, centre, radius, stroke]);

  return (
    <>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G transform={`rotate(-90 ${centre} ${centre})`}>
          <Circle
            cx={centre}
            cy={centre}
            r={radius}
            stroke={PAPER.sunken}
            strokeWidth={stroke}
            fill="none"
          />
          {arc}
        </G>
        {ticks.map((tick) => (
          <Line
            key={`tick-${tick.minutes}`}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={tick.labelled ? PAPER.ink : PAPER.lineStrong}
            strokeWidth={tick.labelled ? 1.6 : 1}
            strokeLinecap="round"
            opacity={tick.labelled ? 0.55 : 0.4}
          />
        ))}
        {marker ? (
          <Line
            x1={marker.x1}
            y1={marker.y1}
            x2={marker.x2}
            y2={marker.y2}
            stroke={PAPER.accent}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}
      </Svg>

      {/* Labels as text, not SVG: the same font as everything else, no extra glyph work. */}
      {ticks
        .filter((tick) => tick.labelled)
        .map((tick) => (
          <View
            key={`label-${tick.minutes}`}
            pointerEvents="none"
            style={[
              styles.label,
              { left: tick.labelX - 22, top: tick.labelY - 8 },
            ]}
          >
            <Text style={styles.labelText}>{formatFlowTarget(tick.minutes)}</Text>
          </View>
        ))}

      {children}
    </>
  );
}

/** Where a target sits on the ring, for the marker and the arc while setting up. */
export function turnOf(minutes: number): number {
  return flowTargetTurn(minutes);
}

const styles = StyleSheet.create({
  label: {
    position: "absolute",
    width: 44,
    alignItems: "center",
  },
  labelText: {
    fontFamily: NEU_FONTS.label,
    fontSize: 10,
    letterSpacing: 0.2,
    color: PAPER.inkMuted,
  },
});
