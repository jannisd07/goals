import React, { useId } from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { NEU } from "../theme/neumorphism";

interface SurfaceProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  bottomRadius?: number;
  lightShadowOpacity?: number;
  darkShadowOpacity?: number;
  contentPadding?: number;
}

const OUTER_LAYOUT_KEYS = [
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginHorizontal",
  "marginVertical",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "zIndex",
] as const;

function splitStyle(style: ViewStyle | undefined) {
  if (!style) return { outer: {}, inner: {} };
  const outer: ViewStyle = {};
  const inner: ViewStyle = {};

  (Object.keys(style) as (keyof ViewStyle)[]).forEach((key) => {
    if ((OUTER_LAYOUT_KEYS as readonly string[]).includes(key)) {
      (outer as Record<string, unknown>)[key] = style[key];
    } else {
      (inner as Record<string, unknown>)[key] = style[key];
    }
  });

  return { outer, inner };
}

function RaisedShadows({
  radius,
  bottomRadius = radius,
  lightShadowOpacity = 1,
  darkShadowOpacity = 1,
  fill,
  soft = false,
  surfaceColor = NEU.bg,
}: {
  radius: number;
  bottomRadius?: number;
  lightShadowOpacity?: number;
  darkShadowOpacity?: number;
  fill: boolean;
  soft?: boolean;
  surfaceColor?: string;
}) {
  const cornerRadii = {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: bottomRadius,
    borderBottomRightRadius: bottomRadius,
  };

  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.shadowLayer,
          styles.darkShadow,
          soft && styles.softDarkShadow,
          cornerRadii,
          { backgroundColor: surfaceColor, shadowOpacity: darkShadowOpacity },
          fill && styles.fill,
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.shadowLayer,
          styles.lightShadow,
          soft && styles.softLightShadow,
          cornerRadii,
          { backgroundColor: surfaceColor, shadowOpacity: lightShadowOpacity },
          fill && styles.fill,
        ]}
      />
    </>
  );
}

export function NeumorphicInsetOverlay({
  radius = NEU.radius,
  strength = 1,
}: {
  radius?: number;
  strength?: number;
}) {
  const id = useId().replace(/:/g, "");
  const safeStrength = Math.max(0, Math.min(1, strength));
  const clipId = `neu-inset-clip-${id}`;
  const darkTop = `neu-inset-dark-top-${id}`;
  const darkLeft = `neu-inset-dark-left-${id}`;
  const lightBottom = `neu-inset-light-bottom-${id}`;
  const lightRight = `neu-inset-light-right-${id}`;

  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <ClipPath id={clipId}>
          <Rect width="100%" height="100%" rx={radius} ry={radius} />
        </ClipPath>
        <LinearGradient id={darkTop} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={NEU.dark} stopOpacity={0.72 * safeStrength} />
          <Stop offset="1" stopColor={NEU.dark} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={darkLeft} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={NEU.dark} stopOpacity={0.72 * safeStrength} />
          <Stop offset="1" stopColor={NEU.dark} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={lightBottom} x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor={NEU.light} stopOpacity={0.9 * safeStrength} />
          <Stop offset="1" stopColor={NEU.light} stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id={lightRight} x1="1" y1="0" x2="0" y2="0">
          <Stop offset="0" stopColor={NEU.light} stopOpacity={0.9 * safeStrength} />
          <Stop offset="1" stopColor={NEU.light} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect width="100%" height={NEU.insetBlur} fill={`url(#${darkTop})`} />
        <Rect width={NEU.insetBlur} height="100%" fill={`url(#${darkLeft})`} />
        <Rect
          y="72%"
          width="100%"
          height="28%"
          fill={`url(#${lightBottom})`}
        />
        <Rect
          x="78%"
          width="22%"
          height="100%"
          fill={`url(#${lightRight})`}
        />
      </G>
    </Svg>
  );
}

export function NeumorphicSurface({
  children,
  style,
  radius = NEU.radiusLarge,
  bottomRadius = radius,
  lightShadowOpacity = 1,
  darkShadowOpacity = 1,
  contentPadding = 16,
}: SurfaceProps) {
  const { outer, inner } = splitStyle(StyleSheet.flatten(style));
  const shouldFill = outer.flex != null || outer.height != null;
  const cornerRadii = {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: bottomRadius,
    borderBottomRightRadius: bottomRadius,
  };

  return (
    <View style={[styles.layoutWrap, cornerRadii, outer]}>
      <RaisedShadows
        radius={radius}
        bottomRadius={bottomRadius}
        lightShadowOpacity={lightShadowOpacity}
        darkShadowOpacity={darkShadowOpacity}
        fill={shouldFill}
        surfaceColor={NEU.card}
      />
      <View
        style={[
          styles.surface,
          cornerRadii,
          { backgroundColor: NEU.card },
          shouldFill && styles.fill,
        ]}
      >
        <View style={[shouldFill && styles.fill, { padding: contentPadding }, inner]}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layoutWrap: {
    backgroundColor: "transparent",
  },
  shadowLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NEU.bg,
  },
  darkShadow: {
    shadowColor: NEU.dark,
    shadowOffset: { width: NEU.raisedDistance, height: NEU.raisedDistance },
    shadowOpacity: 1,
    shadowRadius: NEU.raisedBlur,
    elevation: 8,
  },
  lightShadow: {
    shadowColor: NEU.light,
    shadowOffset: { width: -NEU.raisedDistance, height: -NEU.raisedDistance },
    shadowOpacity: 1,
    shadowRadius: NEU.raisedBlur,
  },
  softDarkShadow: {
    shadowOpacity: 0.72,
  },
  softLightShadow: {
    shadowOpacity: 0.82,
  },
  surface: {
    overflow: "hidden",
    backgroundColor: NEU.bg,
  },
  fill: {
    flex: 1,
  },
});
