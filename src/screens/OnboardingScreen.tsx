import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import MapView, {
  Circle as MapCircle,
  Marker,
  type MapPressEvent,
} from "react-native-maps";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInUp,
  FadeOut,
  interpolate,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useReducedMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { NeumorphicSurface } from "../components/NeumorphicSurface";
import { PAPER } from "../theme/paper";
import { CategoryCards, ValueStepper } from "../components/CategoryCards";
import { TextAction } from "../components/ui/TextAction";
import { MinimalTextInput } from "../components/ui/MinimalTextInput";
import { LocationIcon, BellIcon } from "../components/TabIcons";
import { useAppStore } from "../store";
import { completePendingOnboarding } from "../lib/onboarding";
import { regionForRadius } from "../lib/mapRegion";
import {
  GEOFENCE_RADIUS_OPTIONS,
  getUserPlaceSearchContext,
  resolveUserPlaceSearchContext,
  searchPlaces,
  type PlaceSearchContext,
  type PlaceSuggestion,
} from "../lib/placeSearch";
import { hapticLight, hapticMedium } from "../lib/haptics";
import {
  CHECKIN_CATEGORIES,
  FOCUS_CATEGORIES,
  type FocusStyle,
  type PendingOnboarding,
  DEFAULT_MIN_VISIT_MINUTES,
  MIN_VISIT_MINUTES_OPTIONS,
} from "../types";
import type { RootStackParamList } from "../navigation/types";
import { NEU, NEU_FONTS } from "../theme/neumorphism";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PAGES = [
  "welcome",
  "focusShowcase",
  "focusStyle",
  "focusGoal",
  "checkinShowcase",
  "checkinLocation",
  "checkinGoal",
  "permissions",
] as const;

type PageKey = (typeof PAGES)[number];

const PAGE_SECTIONS: Record<PageKey, string> = {
  welcome: "Welcome",
  focusShowcase: "Focus Timer",
  focusStyle: "Focus Timer",
  focusGoal: "Focus Timer",
  checkinShowcase: "Auto Check-In",
  checkinLocation: "Auto Check-In",
  checkinGoal: "Auto Check-In",
  permissions: "Ready to begin",
};

const NUMBER_WHEEL_ITEM_WIDTH = 62;
const NUMBER_WHEEL_WIDTH = SCREEN_WIDTH - 48;

function NumberWheelItem({
  value,
  index,
  scrollX,
}: {
  value: number;
  index: number;
  scrollX: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const center = index * NUMBER_WHEEL_ITEM_WIDTH;
    const input = [
      center - NUMBER_WHEEL_ITEM_WIDTH * 2,
      center,
      center + NUMBER_WHEEL_ITEM_WIDTH * 2,
    ];
    return {
      opacity: interpolate(
        scrollX.value,
        input,
        [0.22, 1, 0.22],
        Extrapolation.CLAMP,
      ),
      transform: [
        { perspective: 700 },
        {
          rotateY: `${interpolate(
            scrollX.value,
            input,
            [58, 0, -58],
            Extrapolation.CLAMP,
          )}deg`,
        },
        {
          scale: interpolate(
            scrollX.value,
            input,
            [0.72, 1, 0.72],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          width: NUMBER_WHEEL_ITEM_WIDTH,
          height: 76,
          alignItems: "center",
          justifyContent: "center",
        },
        animatedStyle,
      ]}
    >
      <Text
        style={{
          color: NEU.textPrimary,
          fontSize: 30,
          fontFamily: NEU_FONTS.heading,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
    </Animated.View>
  );
}

function HorizontalNumberWheel({
  value,
  onChange,
  min,
  max,
  accessibilityLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  accessibilityLabel: string;
}) {
  const values = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, index) => min + index),
    [max, min],
  );
  const initialIndex = Math.max(0, Math.min(values.length - 1, value - min));
  const scrollX = useSharedValue(initialIndex * NUMBER_WHEEL_ITEM_WIDTH);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const commitOffset = useCallback(
    (offset: number) => {
      const index = Math.max(
        0,
        Math.min(values.length - 1, Math.round(offset / NUMBER_WHEEL_ITEM_WIDTH)),
      );
      const next = values[index];
      if (next !== value) {
        onChange(next);
        hapticLight();
      }
    },
    [onChange, value, values],
  );

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: `${value} hours per week` }}
      accessibilityActions={[
        { name: "increment", label: "Increase weekly target" },
        { name: "decrement", label: "Decrease weekly target" },
      ]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === "increment" ? 1 : -1;
        onChange(Math.max(min, Math.min(max, value + delta)));
      }}
      style={{
        width: NUMBER_WHEEL_WIDTH,
        height: 92,
        alignSelf: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: (NUMBER_WHEEL_WIDTH - NUMBER_WHEEL_ITEM_WIDTH) / 2,
          width: NUMBER_WHEEL_ITEM_WIDTH,
          height: 64,
          borderTopWidth: 2,
          borderBottomWidth: 2,
          borderColor: NEU.accent,
        }}
      />
      <Animated.FlatList
        horizontal
        data={values}
        keyExtractor={(item) => String(item)}
        renderItem={({ item, index }) => (
          <NumberWheelItem value={item} index={index} scrollX={scrollX} />
        )}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: NUMBER_WHEEL_ITEM_WIDTH,
          offset: NUMBER_WHEEL_ITEM_WIDTH * index,
          index,
        })}
        contentContainerStyle={{
          paddingHorizontal: (NUMBER_WHEEL_WIDTH - NUMBER_WHEEL_ITEM_WIDTH) / 2,
        }}
        snapToInterval={NUMBER_WHEEL_ITEM_WIDTH}
        decelerationRate="fast"
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={(event) =>
          commitOffset(event.nativeEvent.contentOffset.x)
        }
        onScrollEndDrag={(event) => {
          if (Math.abs(event.nativeEvent.velocity?.x ?? 0) < 0.05) {
            commitOffset(event.nativeEvent.contentOffset.x);
          }
        }}
      />
    </View>
  );
}

const DEFAULT_PIN_REGION = {
  latitude: 51.1657,
  longitude: 10.4515,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

function FeatureChapter({
  number,
  name,
  description,
  reduceMotion,
  onReveal,
}: {
  number: 1 | 2;
  name: string;
  description: string;
  reduceMotion: boolean;
  onReveal: () => void;
}) {
  return (
    <Pressable
      onPress={onReveal}
      accessibilityRole="button"
      accessibilityLabel={`Feature ${number}: ${name}`}
      accessibilityHint="Shows this feature now"
      style={{
        width: SCREEN_WIDTH,
        height: "100%",
      }}
    >
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(180)}
        exiting={reduceMotion ? undefined : FadeOut.duration(260)}
        style={{
          flex: 1,
          width: SCREEN_WIDTH,
          paddingHorizontal: 32,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Animated.Text
          entering={
            reduceMotion
              ? undefined
              : FadeInUp.delay(40).duration(360).easing(Easing.out(Easing.cubic))
          }
          style={{
            color: NEU.accent,
            fontSize: 15,
            fontFamily: NEU_FONTS.label,
            letterSpacing: 2.4,
            textTransform: "uppercase",
          }}
        >
          Feature {number}
        </Animated.Text>
        <Animated.Text
          entering={
            reduceMotion
              ? undefined
              : FadeInUp.delay(100).duration(400).easing(Easing.out(Easing.cubic))
          }
          style={{
            color: NEU.textPrimary,
            fontSize: 42,
            fontFamily: NEU_FONTS.heading,
            letterSpacing: -1,
            textAlign: "center",
            marginTop: 12,
          }}
        >
          {name}
        </Animated.Text>
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.delay(180).duration(280)}
          style={{
            width: 48,
            height: 4,
            borderRadius: 2,
            backgroundColor: NEU.accent,
            marginVertical: 22,
          }}
        />
        <Animated.Text
          entering={
            reduceMotion
              ? undefined
              : FadeInUp.delay(200).duration(400).easing(Easing.out(Easing.cubic))
          }
          style={{
            color: NEU.textSecondary,
            fontSize: 17,
            fontFamily: NEU_FONTS.body,
            lineHeight: 25,
            textAlign: "center",
            maxWidth: 310,
          }}
        >
          {description}
        </Animated.Text>
        <Animated.Text
          entering={reduceMotion ? undefined : FadeIn.delay(420).duration(300)}
          style={{
            color: NEU.textSecondary,
            fontSize: 13,
            fontFamily: NEU_FONTS.label,
            marginTop: 32,
          }}
        >
          Tap to explore
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function OnboardingPageFrame({
  index,
  scrollX,
  reduceMotion,
  children,
}: {
  index: number;
  scrollX: SharedValue<number>;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: 1, transform: [{ translateX: 0 }] };
    }
    const center = index * SCREEN_WIDTH;
    return {
      opacity: interpolate(
        scrollX.value,
        [center - SCREEN_WIDTH, center, center + SCREEN_WIDTH],
        [0.55, 1, 0.55],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateX: interpolate(
            scrollX.value,
            [center - SCREEN_WIDTH, center, center + SCREEN_WIDTH],
            [18, 0, -18],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  }, [index, reduceMotion, scrollX]);

  return (
    <Animated.View
      style={[
        {
          width: SCREEN_WIDTH,
          height: "100%",
        },
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function RevealedPage({
  children,
  reduceMotion,
}: {
  children: React.ReactNode;
  reduceMotion: boolean;
}) {
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(380)}
      style={{ width: SCREEN_WIDTH, height: "100%" }}
    >
      {children}
    </Animated.View>
  );
}

function OnboardingProgress({
  total,
  current,
  section,
}: {
  total: number;
  current: number;
  section: string;
}) {
  const remaining = Math.max(0, total - current - 1);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${section}. Step ${current + 1} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
      style={{
        paddingHorizontal: 32,
        paddingTop: 8,
        paddingBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 9,
        }}
      >
        <Text
          style={{
            color: NEU.textPrimary,
            fontSize: 13,
            fontFamily: NEU_FONTS.label,
          }}
        >
          {section}
        </Text>
        <Text
          style={{
            color: NEU.textSecondary,
            fontSize: 13,
            fontFamily: NEU_FONTS.body,
            fontVariant: ["tabular-nums"],
          }}
        >
          {current + 1} of {total}
        </Text>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: NEU.track,
          overflow: "hidden",
          flexDirection: "row",
        }}
      >
        <View
          style={{
            flex: current + 1,
            backgroundColor: NEU.accent,
            borderRadius: 2,
          }}
        />
        {remaining > 0 ? <View style={{ flex: remaining }} /> : null}
      </View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function FocusRingAnimation({ reduceMotion }: { reduceMotion: boolean }) {
  const RING = 150;
  const STROKE = 6;
  const R = (RING - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reduceMotion
      ? 0.72
      : withTiming(0.72, {
          duration: 1800,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
  }, [progress, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
      <Svg width={RING} height={RING}>
        <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={NEU.track} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          stroke={NEU.accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color: NEU.textPrimary, fontSize: 30, fontFamily: NEU_FONTS.heading }}>25:00</Text>
        <Text style={{ color: NEU.textSecondary, fontSize: 13, fontFamily: NEU_FONTS.body }}>Deep Work</Text>
      </View>
    </View>
  );
}

function PinPulseAnimation({ reduceMotion }: { reduceMotion: boolean }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = reduceMotion
      ? 1
      : withRepeat(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
          2,
          false,
        );
  }, [pulse, reduceMotion]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + pulse.value * 0.9 }],
    opacity: 0.5 * (1 - pulse.value),
  }));

  return (
    <View style={{ width: 150, height: 150, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: NEU.accent,
          },
          haloStyle,
        ]}
      />
      <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z"
          fill={NEU.accent}
        />
        <Circle cx="12" cy="9" r="2.5" fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

function PageShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollView
      alwaysBounceVertical={false}
      style={{ width: SCREEN_WIDTH, height: "100%" }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 12,
      }}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {eyebrow ? (
        <Text
          style={{
            color: NEU.accent,
            fontSize: 13,
            fontFamily: NEU_FONTS.label,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            marginTop: 14,
            marginBottom: 6,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text
        accessibilityRole="header"
        style={{
          color: NEU.textPrimary,
          fontSize: 28,
          fontFamily: NEU_FONTS.heading,
          letterSpacing: -0.3,
          marginTop: eyebrow ? 0 : 18,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: NEU.textSecondary,
            fontSize: 16,
            fontFamily: NEU_FONTS.body,
            marginTop: 8,
            lineHeight: 23,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
    </ScrollView>
  );
}

function FocusStyleCard({
  title,
  behavior,
  description,
  selected,
  onPress,
}: {
  title: string;
  behavior: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${behavior}`}
      accessibilityHint={description}
      style={({ pressed }) => ({
        marginBottom: 18,
        borderRadius: NEU.radiusLarge,
        borderWidth: 1,
        borderColor: selected ? PAPER.accent : PAPER.line,
        backgroundColor: selected ? PAPER.accentWash : PAPER.surface,
        paddingHorizontal: 20,
        paddingVertical: 20,
        opacity: pressed ? 0.74 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text
          style={{
            color: selected ? PAPER.accentInk : PAPER.ink,
            fontSize: 18,
            fontFamily: NEU_FONTS.label,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: PAPER.accentInk,
            fontSize: 12,
            fontFamily: NEU_FONTS.label,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          {behavior}
        </Text>
      </View>
      <Text
        style={{
          color: PAPER.inkMuted,
          fontSize: 16,
          fontFamily: NEU_FONTS.body,
          lineHeight: 24,
          marginTop: 8,
        }}
      >
        {description}
      </Text>
    </Pressable>
  );
}

type PermissionState = "unknown" | "granted" | "denied";

function PermissionRow({
  icon,
  title,
  description,
  state,
  onRequest,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  state: PermissionState;
  onRequest: () => void;
}) {
  return (
    <NeumorphicSurface radius={NEU.radiusLarge} contentPadding={16} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ marginRight: 12 }}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: NEU.textPrimary, fontSize: 16, fontFamily: NEU_FONTS.label }}>{title}</Text>
          <Text
            style={{
              color: NEU.textSecondary,
              fontSize: 13,
              fontFamily: NEU_FONTS.body,
              marginTop: 3,
              lineHeight: 18,
            }}
          >
            {description}
          </Text>
        </View>
        {state === "granted" ? (
          <Text style={{ color: NEU.accent, fontSize: 16, fontFamily: NEU_FONTS.label, marginLeft: 10 }}>
            Done
          </Text>
        ) : (
          <TextAction
            label={state === "denied" ? "Settings" : "Allow"}
            onPress={onRequest}
            containerStyle={{ marginLeft: 10, minWidth: 60 }}
          textStyle={{ color: NEU.textPrimary }}
            />
        )}
      </View>
    </NeumorphicSurface>
  );
}

export function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const listRef = useRef<FlatList<PageKey>>(null);
  const checkinMapRef = useRef<MapView>(null);
  const checkinSearchRequestRef = useRef(0);
  const [pageIndex, setPageIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const pagerScrollX = useSharedValue(0);
  const onPagerScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      pagerScrollX.value = event.contentOffset.x;
    },
  });

  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const isAppVisible = useAppStore((s) => s.isAppVisible);
  const userConfig = useAppStore((s) => s.userConfig);
  const setUserConfig = useAppStore((s) => s.setUserConfig);
  const setPendingOnboarding = useAppStore((s) => s.setPendingOnboarding);
  const setFocusStyleStore = useAppStore((s) => s.setFocusStyle);

  const [focusStyle, setFocusStyle] = useState<FocusStyle>("interval");
  const [focusCategory, setFocusCategory] = useState<string | null>("studying");
  const [focusHours, setFocusHours] = useState(8);
  const [checkinCategory, setCheckinCategory] = useState<string | null>(null);
  const [checkinSessions, setCheckinSessions] = useState(3);
  const [checkinMinVisit, setCheckinMinVisit] = useState(DEFAULT_MIN_VISIT_MINUTES);
  const [checkinSearchQuery, setCheckinSearchQuery] = useState("");
  const [checkinSearchResults, setCheckinSearchResults] = useState<PlaceSuggestion[]>([]);
  const [checkinSelectedPlace, setCheckinSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [checkinRadius, setCheckinRadius] = useState(30);
  const [checkinSearching, setCheckinSearching] = useState(false);
  const [checkinSearchAttempted, setCheckinSearchAttempted] = useState(false);
  const [checkinSearchedWorldwide, setCheckinSearchedWorldwide] = useState(false);
  const [searchContext, setSearchContext] = useState<PlaceSearchContext>(
    getUserPlaceSearchContext,
  );
  const [locatingPin, setLocatingPin] = useState(false);
  const [pinLocationMessage, setPinLocationMessage] = useState<string | null>(null);
  const [revealedChapters, setRevealedChapters] = useState<Set<PageKey>>(() => new Set());
  const [notifState, setNotifState] = useState<PermissionState>("unknown");
  const [locationState, setLocationState] = useState<PermissionState>("unknown");
  const [saving, setSaving] = useState(false);

  // Post-auth mode: user already has an account (e.g. signed in on a fresh device)
  // but onboarding_complete is false. Same tour, but the last page saves directly.
  const postAuth = isAuthenticated && Boolean(userConfig);

  const pages = useMemo<PageKey[]>(() => [...PAGES], []);
  const currentPage = pages[pageIndex];
  const chapterRevealing =
    (currentPage === "focusShowcase" || currentPage === "checkinShowcase") &&
    !revealedChapters.has(currentPage);

  const revealChapter = useCallback((page: PageKey) => {
    setRevealedChapters((current) => {
      if (current.has(page)) return current;
      const next = new Set(current);
      next.add(page);
      return next;
    });
  }, []);

  useEffect(() => {
    const page = pages[pageIndex];
    if (
      !isAppVisible ||
      (page !== "focusShowcase" && page !== "checkinShowcase") ||
      revealedChapters.has(page)
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      revealChapter(page);
    // Reduced Motion removes the movement, not the information. Keep the
    // chapter title perceptible, while a tap can always reveal it immediately.
    }, reduceMotion ? 250 : 1200);

    return () => clearTimeout(timeout);
  }, [
    isAppVisible,
    pageIndex,
    pages,
    reduceMotion,
    revealChapter,
    revealedChapters,
  ]);

  useEffect(() => {
    if (!isAppVisible) return;
    const timeout = setTimeout(() => {
      AccessibilityInfo.announceForAccessibility(
        `${PAGE_SECTIONS[currentPage]}. Step ${pageIndex + 1} of ${pages.length}.`,
      );
    }, reduceMotion ? 0 : 320);
    return () => clearTimeout(timeout);
  }, [currentPage, isAppVisible, pageIndex, pages.length, reduceMotion]);

  const refreshPermissionStates = useCallback(async () => {
    const [notifications, foreground, background] = await Promise.all([
      Notifications.getPermissionsAsync(),
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
    ]);
    setNotifState(
      notifications.status === "granted"
        ? "granted"
        : notifications.status === "denied"
          ? "denied"
          : "unknown",
    );
    setLocationState(
      foreground.status === "granted" && background.status === "granted"
        ? "granted"
        : foreground.status === "denied" || background.status === "denied"
          ? "denied"
          : "unknown",
    );
  }, []);

  useEffect(() => {
    void refreshPermissionStates();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPermissionStates();
    });
    return () => subscription.remove();
  }, [refreshPermissionStates]);

  const runCheckinPlaceSearch = useCallback(
    async (queryInput: string, worldwide = false) => {
      if (checkinSearching) return;
      const query = queryInput.trim();
      if (query.length < 2 || checkinSelectedPlace) {
        checkinSearchRequestRef.current += 1;
        setCheckinSearchResults([]);
        setCheckinSearching(false);
        return;
      }

      const requestId = checkinSearchRequestRef.current + 1;
      checkinSearchRequestRef.current = requestId;
      setCheckinSearching(true);
      setCheckinSearchAttempted(true);
      setCheckinSearchedWorldwide(worldwide);

      try {
        const resolvedContext = await resolveUserPlaceSearchContext(searchContext);
        setSearchContext(resolvedContext);
        const results = await searchPlaces(
          query,
          resolvedContext,
          worldwide ? "worldwide" : "country",
        );
        if (checkinSearchRequestRef.current !== requestId) return;
        setCheckinSearchResults(results.slice(0, 3));
      } catch {
        if (checkinSearchRequestRef.current !== requestId) return;
        setCheckinSearchResults([]);
      } finally {
        if (checkinSearchRequestRef.current === requestId) {
          setCheckinSearching(false);
        }
      }
    },
    [checkinSearching, checkinSelectedPlace, searchContext],
  );

  const animateMapToPlace = useCallback(
    (place: PlaceSuggestion) => {
      checkinMapRef.current?.animateToRegion(
        regionForRadius(place.latitude, place.longitude, checkinRadius),
        320,
      );
    },
    [checkinRadius],
  );

  // Re-frame the map when the radius changes, so the circle stays readable.
  useEffect(() => {
    if (!checkinSelectedPlace) return;
    animateMapToPlace(checkinSelectedPlace);
  }, [animateMapToPlace, checkinSelectedPlace]);

  const selectCheckinPlace = useCallback(
    (place: PlaceSuggestion) => {
      checkinSearchRequestRef.current += 1;
      setCheckinSelectedPlace(place);
      setCheckinSearching(false);
      setCheckinSearchResults([]);
      setCheckinSearchAttempted(false);
      setPinLocationMessage(null);
      animateMapToPlace(place);
      hapticLight();
    },
    [animateMapToPlace],
  );

  const pinCheckinCoordinate = useCallback(
    async (latitude: number, longitude: number) => {
      const coordinateLabel = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      const pinnedPlace: PlaceSuggestion = {
        title: "Pinned location",
        displayName: coordinateLabel,
        latitude,
        longitude,
        hasExplicitName: false,
      };

      checkinSearchRequestRef.current += 1;
      setCheckinSelectedPlace(pinnedPlace);
      setCheckinSearching(false);
      setCheckinSearchResults([]);
      setCheckinSearchAttempted(false);
      setPinLocationMessage(null);
      animateMapToPlace(pinnedPlace);
      hapticLight();

      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (!address) return;

        const streetLine = [address.street, address.streetNumber].filter(Boolean).join(" ");
        const addressParts = [
          address.name,
          streetLine,
          address.city,
          address.postalCode,
          address.region,
          address.country,
        ].filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);

        const resolvedPlace: PlaceSuggestion = {
          title: address.name || address.street || address.city || "Pinned location",
          displayName: addressParts.join(", ") || coordinateLabel,
          latitude,
          longitude,
          hasExplicitName: Boolean(address.name || address.street),
        };

        setCheckinSelectedPlace((current) =>
          current?.latitude === latitude && current.longitude === longitude
            ? resolvedPlace
            : current,
        );
      } catch {
        // Coordinates remain valid even if the device cannot resolve an address.
      }
    },
    [animateMapToPlace],
  );

  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      void pinCheckinCoordinate(latitude, longitude);
    },
    [pinCheckinCoordinate],
  );

  const handleUseCurrentLocation = useCallback(async () => {
    setLocatingPin(true);
    setPinLocationMessage(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationState("denied");
        setPinLocationMessage("Allow location access, or tap the map to place the pin manually.");
        return;
      }

      const background = await Location.getBackgroundPermissionsAsync();
      setLocationState(background.granted ? "granted" : "unknown");
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await pinCheckinCoordinate(position.coords.latitude, position.coords.longitude);
    } catch {
      setPinLocationMessage("Current location is unavailable. Search or tap the map instead.");
    } finally {
      setLocatingPin(false);
    }
  }, [pinCheckinCoordinate]);

  const buildPending = useCallback(
    (): PendingOnboarding => ({
      focus_style: focusStyle,
      focus_category: focusCategory,
      focus_hours: focusHours,
      checkin_category: checkinCategory,
      checkin_target_sessions: checkinSessions,
      checkin_min_visit_minutes: checkinMinVisit,
      checkin_location:
        checkinCategory && checkinSelectedPlace
          ? {
              latitude: checkinSelectedPlace.latitude,
              longitude: checkinSelectedPlace.longitude,
              radius_meters: checkinRadius,
              address: checkinSelectedPlace.displayName,
            }
          : null,
      display_name: "",
    }),
    [
      focusStyle,
      focusCategory,
      focusHours,
      checkinCategory,
      checkinSessions,
      checkinMinVisit,
      checkinSelectedPlace,
      checkinRadius,
    ],
  );

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(pages.length - 1, index));
      listRef.current?.scrollToIndex({ index: clamped, animated: !reduceMotion });
      setPageIndex(clamped);
    },
    [pages.length, reduceMotion],
  );

  const handleMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setPageIndex((prev) => (prev === index ? prev : index));
  }, []);

  const requestNotifications = useCallback(async () => {
    if (notifState === "denied") {
      void Linking.openSettings();
      return;
    }
    const result = await Notifications.requestPermissionsAsync();
    setNotifState(result.granted ? "granted" : "denied");
    hapticLight();
  }, [notifState]);

  const requestLocation = useCallback(async () => {
    if (locationState === "denied") {
      void Linking.openSettings();
      return;
    }
    const fg = await Location.requestForegroundPermissionsAsync();
    let bg: Location.LocationPermissionResponse | null = null;
    if (fg.status === "granted") {
      bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    }
    setLocationState(
      fg.status === "granted" && bg?.status === "granted" ? "granted" : "denied",
    );
    hapticLight();
  }, [locationState]);

  const handleFinishPreAuth = useCallback(() => {
    setPendingOnboarding(buildPending());
    setFocusStyleStore(focusStyle);
    navigation.navigate("Auth");
  }, [buildPending, focusStyle, navigation, setFocusStyleStore, setPendingOnboarding]);

  const handleFinishPostAuth = useCallback(async () => {
    if (!userConfig) return;
    const userId = userConfig.id;
    setSaving(true);
    const pending = buildPending();
    setFocusStyleStore(focusStyle);

    try {
      await completePendingOnboarding(userId, pending);

      const current = useAppStore.getState();
      if (!current.isAuthenticated || current.userConfig?.id !== userId) return;
      setPendingOnboarding(null);
      setUserConfig({
        ...current.userConfig,
        focus_style: pending.focus_style,
        onboarding_complete: true,
      });
      hapticMedium();
    } catch (error) {
      const current = useAppStore.getState();
      if (!current.isAuthenticated || current.userConfig?.id !== userId) return;
      console.error("Failed to complete onboarding:", error);
      Alert.alert(
        "Setup could not be saved",
        "Check your connection and try Finish again. Nothing was discarded.",
      );
    } finally {
      setSaving(false);
    }
  }, [buildPending, focusStyle, setFocusStyleStore, setPendingOnboarding, setUserConfig, userConfig]);

  const isLast = pageIndex === pages.length - 1;

  const primaryLabel = useMemo(() => {
    const page = pages[pageIndex];
    if (page === "welcome") return "Continue";
    if (page === "permissions") {
      // Signing in and signing up are the same door now: the first time with
      // Apple or Google creates the account (CLAUDE.md §10.1).
      return postAuth ? (saving ? "Please wait..." : "Finish") : "Sign In";
    }
    return "Continue";
  }, [pageIndex, pages, postAuth, saving]);

  const footerRightLabel =
    (currentPage === "checkinLocation" && !checkinSelectedPlace) ||
    (currentPage === "checkinGoal" && (!checkinSelectedPlace || !checkinCategory))
      ? "Skip"
      : primaryLabel;

  const handleSkipAutoCheckin = useCallback(() => {
    setCheckinCategory(null);
    setCheckinSelectedPlace(null);
    setCheckinSearchQuery("");
    setCheckinSearchResults([]);
    setCheckinSearchAttempted(false);
    setCheckinSearchedWorldwide(false);
    setPinLocationMessage(null);
    goTo(pages.indexOf("permissions"));
  }, [goTo, pages]);

  const handlePrimary = useCallback(() => {
    if (chapterRevealing) return;
    hapticLight();
    const page = pages[pageIndex];
    if (
      (page === "checkinLocation" && !checkinSelectedPlace) ||
      (page === "checkinGoal" && (!checkinSelectedPlace || !checkinCategory))
    ) {
      handleSkipAutoCheckin();
      return;
    }
    if (!isLast) {
      goTo(pageIndex + 1);
      return;
    }
    if (postAuth) {
      void handleFinishPostAuth();
    } else {
      handleFinishPreAuth();
    }
  }, [
    pages,
    pageIndex,
    checkinSelectedPlace,
    checkinCategory,
    handleSkipAutoCheckin,
    goTo,
    handleFinishPostAuth,
    handleFinishPreAuth,
    isLast,
    postAuth,
    chapterRevealing,
  ]);

  const renderPage = useCallback(
    ({ item }: ListRenderItemInfo<PageKey>) => {
      if (item === "focusShowcase" && !revealedChapters.has(item)) {
        return (
          <FeatureChapter
            number={1}
            name="Focus Timer"
            description="First, set up focused work and the weekly goal your timer should measure."
            reduceMotion={reduceMotion}
            onReveal={() => revealChapter(item)}
          />
        );
      }

      if (item === "checkinShowcase" && !revealedChapters.has(item)) {
        return (
          <FeatureChapter
            number={2}
            name="Auto Check-In"
            description="Next, set up a separate location feature that counts visits instead of time."
            reduceMotion={reduceMotion}
            onReveal={() => revealChapter(item)}
          />
        );
      }

      switch (item) {
        case "welcome":
          return (
            <PageShell
              title="Welcome to Goals"
              subtitle="Two calm tools help you turn intention into visible progress."
            >
              <View style={{ marginTop: 28, gap: 18 }}>
                {[
                  ["Focus without friction", "Use Intervals or an open-ended Flowtime stopwatch."],
                  ["Track the right places", "Optional Auto Check-In counts visits at one place you pin."],
                  ["See progress grow", "Weekly stats and your island turn completed sessions into momentum."],
                  ["Your choices stay yours", "Location is optional and used only for features you enable."],
                ].map(([title, description], index) => (
                  <Animated.View
                    key={title}
                    entering={
                      reduceMotion
                        ? undefined
                        : FadeInUp.delay(80 + index * 70).duration(380)
                    }
                    style={{ flexDirection: "row", gap: 14 }}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: NEU.accent,
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 1,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 13,
                          fontFamily: NEU_FONTS.label,
                        }}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: NEU.textPrimary,
                          fontSize: 17,
                          fontFamily: NEU_FONTS.label,
                        }}
                      >
                        {title}
                      </Text>
                      <Text
                        style={{
                          color: NEU.textSecondary,
                          fontSize: 15,
                          lineHeight: 21,
                          fontFamily: NEU_FONTS.body,
                          marginTop: 3,
                        }}
                      >
                        {description}
                      </Text>
                    </View>
                  </Animated.View>
                ))}
                <Animated.View
                  entering={
                    reduceMotion
                      ? undefined
                      : FadeIn.delay(420).duration(320)
                  }
                  style={{
                    marginTop: 2,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: NEU.track,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <Text
                    style={{
                      color: NEU.textPrimary,
                      fontSize: 14,
                      fontFamily: NEU_FONTS.label,
                    }}
                  >
                    About 2 minutes
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      color: NEU.textSecondary,
                      fontSize: 14,
                      fontFamily: NEU_FONTS.body,
                      textAlign: "right",
                    }}
                  >
                    Change anything later in Settings
                  </Text>
                </Animated.View>
              </View>
            </PageShell>
          );
        case "focusShowcase":
          return (
            <RevealedPage reduceMotion={reduceMotion}>
              <PageShell
                eyebrow="Feature 1 · Focus Timer"
                title="Focus with intention"
                subtitle="This feature measures focused minutes. Set the timer style and weekly target before moving to Auto Check-In."
              >
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <FocusRingAnimation reduceMotion={reduceMotion} />
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontSize: 16,
                      fontFamily: NEU_FONTS.body,
                      textAlign: "center",
                      marginTop: 24,
                      lineHeight: 24,
                      maxWidth: 300,
                    }}
                  >
                    Start one timer, work in intervals or Flowtime, and every completed session
                    counts toward your weekly focus target.
                  </Text>
                </View>
              </PageShell>
            </RevealedPage>
          );
        case "checkinShowcase":
          return (
            <RevealedPage reduceMotion={reduceMotion}>
              <PageShell
                eyebrow="Feature 2 · Auto Check-In"
                title="Track places automatically"
                subtitle="Your Focus Timer setup is complete. This separate feature counts visits when you arrive at one pinned place."
              >
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <PinPulseAnimation reduceMotion={reduceMotion} />
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontSize: 16,
                      fontFamily: NEU_FONTS.body,
                      textAlign: "center",
                      marginTop: 22,
                      lineHeight: 23,
                    }}
                  >
                    Focus Timer measures time. Auto Check-In measures visits.
                  </Text>
                </View>
              </PageShell>
            </RevealedPage>
          );
        case "focusStyle":
          return (
            <PageShell
              eyebrow="Feature 1 · Focus Timer"
              title="How do you work best?"
              subtitle="Choose how the timer handles focus and breaks. You can change this later in Settings."
            >
              <View style={{ marginTop: 24 }}>
                <FocusStyleCard
                  title="Intervals"
                  behavior="Set time"
                  description="Pick a length, like 25 minutes. When it's up, a short break starts on its own."
                  selected={focusStyle === "interval"}
                  onPress={() => {
                    setFocusStyle("interval");
                    hapticLight();
                  }}
                />
                <FocusStyleCard
                  title="Flowtime"
                  behavior="No limit"
                  description="The clock runs until you stop it. The longer you focused, the longer your break."
                  selected={focusStyle === "flowtime"}
                  onPress={() => {
                    setFocusStyle("flowtime");
                    hapticLight();
                  }}
                />
              </View>
            </PageShell>
          );
        case "focusGoal":
          return (
            <PageShell
              eyebrow="Feature 1 · Focus Timer"
              title="What are you focusing on?"
              subtitle="Choose the activity whose focused minutes should count toward a weekly target."
            >
              <View style={{ marginTop: 22 }}>
                <CategoryCards
                  categories={FOCUS_CATEGORIES}
                  selectedKey={focusCategory}
                  onSelect={(category) => {
                    setFocusCategory(category.key);
                    hapticLight();
                  }}
                />
                <Text
                  style={{
                    color: NEU.textSecondary,
                    fontSize: 13,
                    fontFamily: NEU_FONTS.label,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    marginTop: 10,
                    marginBottom: 12,
                  }}
                >
                  Weekly target
                </Text>
                <HorizontalNumberWheel
                  value={focusHours}
                  onChange={setFocusHours}
                  min={1}
                  max={40}
                  accessibilityLabel="Weekly focus hours"
                />
                <Text
                  style={{
                    color: NEU.textSecondary,
                    fontSize: 14,
                    fontFamily: NEU_FONTS.body,
                    textAlign: "center",
                    marginTop: 2,
                  }}
                >
                  hours per week
                </Text>
              </View>
            </PageShell>
          );
        case "checkinLocation":
          return (
            <PageShell
              eyebrow="Feature 2 · Auto Check-In"
              title="Pin your check-in place"
              subtitle="Optional. Tap the map or drag the pin to the exact entrance where a visit should count."
            >
              <View style={{ marginTop: 14 }}>
                <MinimalTextInput
                  value={checkinSearchQuery}
                  onChangeText={(text) => {
                    checkinSearchRequestRef.current += 1;
                    setCheckinSearchQuery(text);
                    setCheckinSelectedPlace(null);
                    setCheckinSearching(false);
                    setCheckinSearchAttempted(false);
                    setCheckinSearchedWorldwide(false);
                  }}
                  placeholder="Search place or address"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="search"
                  onSubmitEditing={() => void runCheckinPlaceSearch(checkinSearchQuery)}
                  rightAccessory={
                    checkinSearching ? (
                      <ActivityIndicator size="small" color={NEU.accent} />
                    ) : (
                      <TextAction
                        label="Search"
                        onPress={() => void runCheckinPlaceSearch(checkinSearchQuery)}
                        textStyle={{ fontSize: 13 }}
                      />
                    )
                  }
                />
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="OpenStreetMap contributor attribution"
                  onPress={() => void Linking.openURL("https://www.openstreetmap.org/copyright")}
                  style={{ alignSelf: "flex-end", paddingVertical: 6 }}
                >
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontFamily: NEU_FONTS.body,
                      fontSize: 11,
                    }}
                  >
                    Search © OpenStreetMap contributors
                  </Text>
                </Pressable>

                {checkinSearchResults.length > 0 ? (
                  <>
                    <Text
                      style={{
                        color: NEU.textSecondary,
                        fontSize: 12,
                        fontFamily: NEU_FONTS.label,
                        marginTop: 6,
                      }}
                    >
                      {checkinSearchedWorldwide || !searchContext.countryCode
                        ? "Worldwide results"
                        : `Results in ${searchContext.countryName ?? "your country"}`}
                    </Text>
                    <NeumorphicSurface
                      radius={NEU.radiusLarge}
                      contentPadding={6}
                      style={{ marginTop: 6 }}
                    >
                      {checkinSearchResults.slice(0, 2).map((place, index) => (
                        <Pressable
                          key={`${place.displayName}-${place.latitude}-${place.longitude}`}
                          onPress={() => selectCheckinPlace(place)}
                          accessibilityRole="button"
                          accessibilityLabel={`Pin ${place.title}`}
                          style={{
                            minHeight: 54,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            justifyContent: "center",
                            borderTopWidth: index > 0 ? 1 : 0,
                            borderTopColor: NEU.track,
                          }}
                        >
                          <Text
                            style={{
                              color: NEU.textPrimary,
                              fontSize: 16,
                              fontFamily: NEU_FONTS.label,
                            }}
                          >
                            {place.title}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: NEU.textSecondary,
                              fontSize: 13,
                              fontFamily: NEU_FONTS.body,
                              marginTop: 2,
                            }}
                          >
                            {place.displayName}
                          </Text>
                        </Pressable>
                      ))}
                    </NeumorphicSurface>
                  </>
                ) : null}

                <View
                  style={{
                    minHeight: 44,
                    marginTop: 2,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontSize: 13,
                      fontFamily: NEU_FONTS.label,
                    }}
                  >
                    Tap map or drag the pin
                  </Text>
                  <TextAction
                    label={locatingPin ? "Locating..." : "My location"}
                    align="right"
                    onPress={() => void handleUseCurrentLocation()}
                    disabled={locatingPin}
                    containerStyle={{ minWidth: 110 }}
                    textStyle={{ fontSize: 14 }}
                  />
                </View>

                <View
                  style={{
                    height: 195,
                    borderRadius: NEU.radiusLarge,
                    borderWidth: 1,
                    borderColor: NEU.track,
                    overflow: "hidden",
                    backgroundColor: NEU.card,
                  }}
                >
                  <MapView
                    ref={checkinMapRef}
                    style={{ flex: 1 }}
                    initialRegion={DEFAULT_PIN_REGION}
                    onPress={handleMapPress}
                    pitchEnabled={false}
                    rotateEnabled={false}
                    accessibilityLabel="Map for pinning the Auto Check-In location"
                  >
                    {checkinSelectedPlace ? (
                      <>
                        <MapCircle
                          center={{
                            latitude: checkinSelectedPlace.latitude,
                            longitude: checkinSelectedPlace.longitude,
                          }}
                          radius={checkinRadius}
                          fillColor={`rgba(${NEU.accentRgb}, 0.16)`}
                          strokeColor={NEU.accent}
                          strokeWidth={2}
                        />
                        <Marker
                          coordinate={{
                            latitude: checkinSelectedPlace.latitude,
                            longitude: checkinSelectedPlace.longitude,
                          }}
                          draggable
                          pinColor={NEU.accent}
                          title={checkinSelectedPlace.title}
                          description={checkinSelectedPlace.displayName}
                          onDragEnd={(event) => {
                            const { latitude, longitude } = event.nativeEvent.coordinate;
                            void pinCheckinCoordinate(latitude, longitude);
                          }}
                        />
                      </>
                    ) : null}
                  </MapView>
                </View>

                {checkinSelectedPlace ? (
                  <View style={{ marginTop: 10 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: NEU.textPrimary,
                        fontSize: 15,
                        fontFamily: NEU_FONTS.label,
                      }}
                    >
                      {checkinSelectedPlace.title}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: NEU.textSecondary,
                        fontSize: 13,
                        fontFamily: NEU_FONTS.body,
                        marginTop: 2,
                      }}
                    >
                      {checkinSelectedPlace.displayName}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: NEU.textSecondary,
                          fontSize: 13,
                          fontFamily: NEU_FONTS.label,
                        }}
                      >
                        Detection radius
                      </Text>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        {GEOFENCE_RADIUS_OPTIONS.map((option) => {
                          const selected = checkinRadius === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              onPress={() => {
                                setCheckinRadius(option.value);
                                hapticLight();
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Radius ${option.label}`}
                              accessibilityState={{ selected }}
                              style={{
                                minWidth: 52,
                                minHeight: 44,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <View
                                pointerEvents="none"
                                style={{
                                  minWidth: 48,
                                  height: 32,
                                  paddingHorizontal: 10,
                                  borderRadius: 16,
                                  borderWidth: 1,
                                  borderColor: selected ? PAPER.accent : PAPER.line,
                                  backgroundColor: selected ? PAPER.accentWash : PAPER.surface,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text
                                  style={{
                                    color: selected ? PAPER.accentInk : PAPER.ink,
                                    fontSize: 13,
                                    fontFamily: NEU_FONTS.label,
                                  }}
                                >
                                  {option.label}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <TextAction
                      label="Skip Auto Check-In"
                      align="center"
                      onPress={handleSkipAutoCheckin}
                      containerStyle={{ alignSelf: "center", width: 180 }}
                      textStyle={{ fontSize: 14 }}
                    />
                  </View>
                ) : checkinSearchAttempted && !checkinSearching ? (
                  <View style={{ marginTop: 8 }}>
                    <Text
                      style={{
                        color: NEU.textSecondary,
                        fontSize: 14,
                        fontFamily: NEU_FONTS.body,
                      }}
                    >
                      {checkinSearchedWorldwide
                        ? "No matching place found. Try a full address, use your location, or pin it on the map."
                        : `No matching place found in ${searchContext.countryName ?? "your country"}.`}
                    </Text>
                    {!checkinSearchedWorldwide && searchContext.countryCode ? (
                      <TextAction
                        label="Search Worldwide"
                        onPress={() => void runCheckinPlaceSearch(checkinSearchQuery, true)}
                        containerStyle={{ marginTop: 2, minWidth: 140 }}
                        textStyle={{ fontSize: 14 }}
                      />
                    ) : null}
                  </View>
                ) : pinLocationMessage ? (
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontSize: 13,
                      fontFamily: NEU_FONTS.body,
                      lineHeight: 18,
                      marginTop: 8,
                    }}
                  >
                    {pinLocationMessage}
                  </Text>
                ) : (
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontSize: 13,
                      fontFamily: NEU_FONTS.body,
                      lineHeight: 18,
                      marginTop: 8,
                    }}
                  >
                    Search to move the map, use your location, or tap any exact point to pin it.
                  </Text>
                )}
              </View>
            </PageShell>
          );
        case "checkinGoal":
          return (
            <PageShell
              eyebrow="Feature 2 · Auto Check-In"
              title="What should visits count as?"
              subtitle={
                checkinSelectedPlace
                  ? `Finish the optional setup for ${checkinSelectedPlace.title}.`
                  : "Choose a place first, or skip Auto Check-In for now."
              }
            >
              {checkinSelectedPlace ? (
                <View style={{ marginTop: 22 }}>
                  <CategoryCards
                    categories={CHECKIN_CATEGORIES}
                    selectedKey={checkinCategory}
                    onSelect={(category) => {
                      setCheckinCategory((current) => (current === category.key ? null : category.key));
                      hapticLight();
                    }}
                  />
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontSize: 13,
                      fontFamily: NEU_FONTS.label,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      marginTop: 10,
                      marginBottom: 12,
                    }}
                  >
                    Visits per week
                  </Text>
                  <ValueStepper
                    value={checkinSessions}
                    onChange={setCheckinSessions}
                    min={1}
                    max={14}
                    unit="visits / week"
                    accessibilityLabel="Weekly visit target"
                  />
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontSize: 13,
                      fontFamily: NEU_FONTS.label,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      marginTop: 22,
                      marginBottom: 12,
                    }}
                  >
                    Minimum stay
                  </Text>
                  {/* Six options sit in two rows of three, so none is clipped on
                      a 375pt iPhone. */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 0 }}>
                    {MIN_VISIT_MINUTES_OPTIONS.map((option) => {
                      const selected = checkinMinVisit === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => {
                            setCheckinMinVisit(option.value);
                            hapticLight();
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Minimum stay ${option.label}`}
                          accessibilityState={{ selected }}
                          style={{
                            width: "31%",
                            minHeight: 44,
                            alignItems: "stretch",
                            justifyContent: "center",
                          }}
                        >
                          <View
                            pointerEvents="none"
                            style={{
                              height: 34,
                              paddingHorizontal: 4,
                              borderRadius: 17,
                              borderWidth: 1,
                              borderColor: selected ? PAPER.accent : PAPER.line,
                              backgroundColor: selected ? PAPER.accentWash : PAPER.surface,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: selected ? PAPER.accentInk : PAPER.ink,
                                fontSize: 13,
                                fontFamily: NEU_FONTS.label,
                              }}
                            >
                              {option.label}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontSize: 16,
                      lineHeight: 22,
                      fontFamily: NEU_FONTS.body,
                      marginTop: 12,
                    }}
                  >
                    Shorter visits are discarded. Walking past the place never
                    becomes a session. You can change this later in Settings.
                  </Text>
                </View>
              ) : (
                <NeumorphicSurface
                  radius={NEU.radiusLarge}
                  contentPadding={20}
                  style={{ marginTop: 24 }}
                >
                  <Text
                    style={{
                      color: NEU.textPrimary,
                      fontSize: 16,
                      fontFamily: NEU_FONTS.label,
                    }}
                  >
                    No place selected
                  </Text>
                  <Text
                    style={{
                      color: NEU.textSecondary,
                      fontSize: 14,
                      fontFamily: NEU_FONTS.body,
                      lineHeight: 20,
                      marginTop: 6,
                    }}
                  >
                    Go back to search for a place, or use Skip to continue without Auto Check-In.
                  </Text>
                </NeumorphicSurface>
              )}
            </PageShell>
          );
        case "permissions":
          const autoCheckInConfigured = Boolean(checkinSelectedPlace && checkinCategory);
          return (
            <PageShell
              title="Permissions"
              subtitle={
                autoCheckInConfigured
                  ? "Location powers Auto Check-In only. Notifications can support timers, reminders, and check-in summaries."
                  : "Notifications can support timer summaries and reminders. You skipped Auto Check-In, so Goals will not ask for location."
              }
            >
              <View style={{ marginTop: 24 }}>
                {autoCheckInConfigured ? (
                  <PermissionRow
                    icon={<LocationIcon size={22} color={NEU.accent} strokeWidth={1.8} />}
                    title="Location"
                    description="Powers Auto Check-In at your chosen places. Used in the background, never shared."
                    state={locationState}
                    onRequest={() => void requestLocation()}
                  />
                ) : null}
                <PermissionRow
                  icon={<BellIcon size={22} color={NEU.accent} strokeWidth={1.8} />}
                  title="Notifications"
                  description="Session summaries and streak reminders. No spam."
                  state={notifState}
                  onRequest={() => void requestNotifications()}
                />
                <Text
                  style={{
                    color: NEU.textSecondary,
                    fontSize: 13,
                    fontFamily: NEU_FONTS.body,
                    lineHeight: 18,
                    marginTop: 4,
                  }}
                >
                  You can continue without granting these — features stay off until you allow them in
                  Settings.
                </Text>
              </View>
            </PageShell>
          );
        default:
          return null;
      }
    },
    [
      checkinCategory,
      checkinMinVisit,
      checkinRadius,
      checkinSearchAttempted,
      checkinSearchQuery,
      checkinSearchResults,
      checkinSearching,
      checkinSearchedWorldwide,
      checkinSelectedPlace,
      checkinSessions,
      focusCategory,
      focusHours,
      focusStyle,
      locatingPin,
      locationState,
      notifState,
      pinLocationMessage,
      postAuth,
      reduceMotion,
      revealChapter,
      revealedChapters,
      handleMapPress,
      handleSkipAutoCheckin,
      handleUseCurrentLocation,
      pinCheckinCoordinate,
      runCheckinPlaceSearch,
      requestLocation,
      requestNotifications,
      selectCheckinPlace,
    ],
  );

  // The first chapter must not mount behind the native splash screen. Reanimated
  // entering transitions begin at mount time; rendering it earlier makes
  // Feature 1 appear static while Feature 2 still animates normally.
  if (!isAppVisible) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: NEU.pageSolid }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: NEU.pageSolid }} edges={["top", "bottom"]}>
      <OnboardingProgress
        total={pages.length}
        current={pageIndex}
        section={PAGE_SECTIONS[currentPage]}
      />

      <Animated.FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(item) => item}
        renderItem={(info: ListRenderItemInfo<PageKey>) => (
          <OnboardingPageFrame
            index={info.index}
            scrollX={pagerScrollX}
            reduceMotion={reduceMotion}
          >
            {renderPage(info)}
          </OnboardingPageFrame>
        )}
        horizontal
        pagingEnabled
        // Pages with their own horizontal controls (steppers, map) must not
        // compete with the pager, otherwise their taps are swallowed.
        scrollEnabled={
          !chapterRevealing &&
          currentPage !== "focusGoal" &&
          currentPage !== "checkinGoal" &&
          currentPage !== "checkinLocation"
        }
        showsHorizontalScrollIndicator={false}
        onScroll={onPagerScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
      />

      <View
        style={{
          minHeight: 60,
          paddingHorizontal: 32,
          paddingTop: 4,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {chapterRevealing ? (
          <View style={{ minWidth: 72, minHeight: 44 }} />
        ) : pageIndex > 0 ? (
          <TextAction label="Back" onPress={() => goTo(pageIndex - 1)} />
        ) : !postAuth ? (
          <TextAction label="I have an account" onPress={() => navigation.navigate("Auth")} textStyle={{ color: NEU.textPrimary }} />
        ) : (
          <View style={{ minWidth: 72, minHeight: 44 }} />
        )}
        {chapterRevealing ? (
          <View style={{ minWidth: 72, minHeight: 44 }} />
        ) : (
          <TextAction
            label={footerRightLabel}
            align="right"
            onPress={handlePrimary}
            disabled={saving}
          textStyle={{ color: NEU.textPrimary }}
            />
        )}
      </View>
    </SafeAreaView>
  );
}
