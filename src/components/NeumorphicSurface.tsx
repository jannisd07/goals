import React from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
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

  // Island look: a plain white card. The former dual neumorphic shadows are
  // gone; the shadow-opacity props stay in the signature so the 13 call sites
  // keep working untouched.
  void lightShadowOpacity;
  void darkShadowOpacity;

  return (
    <View style={[styles.layoutWrap, cornerRadii, outer]}>
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
    backgroundColor: NEU.card,
  },
  fill: {
    flex: 1,
  },
});
