import React, { useMemo, useEffect, useRef, useCallback, useState } from "react";
import { View, Text, Dimensions, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import Svg, { Circle, Line } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { usePageRefreshAnimation } from "../hooks/usePageRefreshAnimation";
import { useRefreshPermissionWarnings } from "../hooks/useRefreshPermissionWarnings";
import {
  buildConstellation,
  projectPoint,
  type Constellation,
} from "../lib/constellation";
import type { Session } from "../types";
import type { MainTabParamList } from "../navigation/types";
import { NeumorphicSurface } from "../components/NeumorphicSurface";
import { TextAction } from "../components/ui/TextAction";
import { NEU } from "../theme/neumorphism";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const EMPTY_SESSIONS: Session[] = [];

// ---------- Types for projected data ----------

interface ProjectedStar {
  sessionId: string;
  goalId: string;
  x: number;
  y: number;
  r: number;
  opacity: number;
  z: number;
  durationMinutes: number;
  rating: number | null;
  startTime: string;
}

interface ProjectedLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
  width: number;
  z: number;
}

// ---------- Tooltip ----------

function Tooltip({
  star,
  visible,
}: {
  star: ProjectedStar | null;
  visible: boolean;
}) {
  if (!star || !visible) return null;

  const date = new Date(star.startTime).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <NeumorphicSurface
      style={[
        styles.tooltip,
        {
          left: Math.min(SCREEN_WIDTH - 120, Math.max(10, star.x - 40)),
          top: Math.max(10, star.y - star.r - 48),
        },
      ]}
      radius={12}
      contentPadding={10}
    >
      <Text style={styles.tooltipTitle}>{star.durationMinutes} min</Text>
      <Text style={styles.tooltipSub}>
        {date} · {star.rating === null ? "Unrated" : `${star.rating}/5`}
      </Text>
    </NeumorphicSurface>
  );
}

// ---------- Main screen ----------

export function GardenScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const isFocused = useIsFocused();
  const refreshKey = usePageRefreshAnimation();
  useRefreshPermissionWarnings(refreshKey);

  // Camera state
  const camAzRef = useRef(-0.35);
  const camElRef = useRef(0.4);
  const savedAzRef = useRef(0);
  const savedElRef = useRef(0);
  const autoRotateRef = useRef(true);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastProjectionAtRef = useRef(0);

  // Container center
  const [center, setCenter] = useState({
    x: SCREEN_WIDTH / 2,
    y: Math.round((SCREEN_HEIGHT - 180) * 0.48),
  });

  // Projected data for rendering
  const [projectedStars, setProjectedStars] = useState<ProjectedStar[]>([]);
  const [projectedLines, setProjectedLines] = useState<ProjectedLine[]>([]);

  // Tooltip
  const [tooltipStar, setTooltipStar] = useState<ProjectedStar | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const nextX = e.nativeEvent.layout.width / 2;
      const nextY = e.nativeEvent.layout.height / 2;
      setCenter((current) =>
        current.x === nextX && current.y === nextY
          ? current
          : { x: nextX, y: nextY },
      );
    },
    [],
  );

  // ---------- Fetch sessions ----------

  const { data: sessionData, isLoading, isError, refetch } = useQuery({
    queryKey: ["garden", "sessions"],
    queryFn: async (): Promise<Session[]> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return [];

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", user.id)
        .not("end_time", "is", null)
        .order("start_time", { ascending: false })
        .limit(250);

      if (error) throw error;
      return ((data ?? []) as Session[]).reverse();
    },
    retry: 1,
  });
  // Keep the empty value referentially stable while the query is loading.
  // A fresh `[]` on every render changes `constellation` and `projectAll`,
  // which restarts the projection effect and can create an update-depth loop.
  const sessions = sessionData ?? EMPTY_SESSIONS;

  useEffect(
    () => () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // ---------- Build constellation (memoized) ----------

  const constellation: Constellation = useMemo(
    () => buildConstellation(sessions),
    [sessions],
  );

  // ---------- Projection function ----------

  const projectAll = useCallback(
    (cx: number, cy: number) => {
      const az = camAzRef.current;
      const el = camElRef.current;
      const zoom = 1.0;

      const stars: ProjectedStar[] = constellation.stars.map((s) => {
        const p = projectPoint(s.x, s.y, s.z, az, el, zoom, cx, cy);
        const r = Math.max(0.5, s.radius * p.scale);
        const baseAlpha = 0.6 + 0.3 * Math.min(1, (p.z + 300) / 600);
        return {
          sessionId: s.sessionId,
          goalId: s.goalId,
          x: p.x,
          y: p.y,
          r,
          opacity: Math.max(0, Math.min(1, baseAlpha)),
          z: p.z,
          durationMinutes: s.durationMinutes,
          rating: s.rating,
          startTime: s.startTime,
        };
      });

      const lines: ProjectedLine[] = constellation.lines.map((l) => {
        const pa = projectPoint(l.ax, l.ay, l.az, az, el, zoom, cx, cy);
        const pb = projectPoint(l.bx, l.by, l.bz, az, el, zoom, cx, cy);
        const avgScale = (pa.scale + pb.scale) / 2;
        return {
          id: `${l.aId}-${l.bId}`,
          x1: pa.x,
          y1: pa.y,
          x2: pb.x,
          y2: pb.y,
          opacity: Math.max(0, Math.min(0.15, 0.05 * avgScale)),
          width: 1.5 * avgScale,
          z: (pa.z + pb.z) / 2,
        };
      });

      // Sort back-to-front
      stars.sort((a, b) => a.z - b.z);

      setProjectedStars(stars);
      setProjectedLines(lines);
    },
    [constellation],
  );

  // ---------- Animation loop ----------

  useEffect(() => {
    if (!isFocused) return;
    let active = true;

    const tick = (timestamp: number) => {
      if (!active) return;
      if (
        autoRotateRef.current &&
        timestamp - lastProjectionAtRef.current >= 1000 / 30
      ) {
        lastProjectionAtRef.current = timestamp;
        camAzRef.current += 0.0012;
        projectAll(center.x, center.y);
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    // Initial projection
    projectAll(center.x, center.y);
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [projectAll, center, isFocused]);

  // ---------- Pan gesture ----------

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          autoRotateRef.current = false;
          if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
          savedAzRef.current = camAzRef.current;
          savedElRef.current = camElRef.current;
        })
        .onUpdate((e) => {
          camAzRef.current = savedAzRef.current + e.translationX * 0.005;
          camElRef.current = Math.max(
            -1.4,
            Math.min(1.4, savedElRef.current + e.translationY * 0.005),
          );
          projectAll(center.x, center.y);
        })
        .onEnd(() => {
          resumeTimerRef.current = setTimeout(() => {
            autoRotateRef.current = true;
          }, 5000);
        }),
    [projectAll, center],
  );

  // ---------- Tap gesture for tooltips ----------

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((e) => {
        const mx = e.x;
        const my = e.y;

        // Check front-to-back (stars are sorted back-to-front, so iterate reversed)
        for (let i = projectedStars.length - 1; i >= 0; i--) {
          const s = projectedStars[i];
          const hitR = Math.max(8, s.r + 6);
          const dx = mx - s.x;
          const dy = my - s.y;
          if (dx * dx + dy * dy < hitR * hitR) {
            setTooltipStar(s);
            setTooltipVisible(true);
            if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
            tooltipTimerRef.current = setTimeout(
              () => setTooltipVisible(false),
              2500,
            );
            return;
          }
        }
        setTooltipVisible(false);
      }).runOnJS(true),
    [projectedStars],
  );

  const composed = useMemo(
    () => Gesture.Exclusive(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  // ---------- Goal cluster count ----------

  const goalCount = useMemo(() => {
    const goals = new Set(sessions.map((s) => s.goal_id));
    return goals.size;
  }, [sessions]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.fill}>
          <View style={styles.headerRow}>
            <TextAction
              label="Back"
              onPress={() => navigation.navigate("Home")}
              containerStyle={styles.backAction}
            />
            <Text style={styles.counter}>
              {sessions.length === 250 ? "Latest 250" : sessions.length} sessions · {goalCount}{" "}
              {goalCount === 1 ? "cluster" : "clusters"}
            </Text>
          </View>

          <GestureDetector gesture={composed}>
            <View
              accessible={sessions.length > 0}
              accessibilityRole={sessions.length > 0 ? "image" : undefined}
              accessibilityLabel={
                sessions.length > 0
                  ? `Island constellation with ${sessions.length} completed ${
                      sessions.length === 1 ? "session" : "sessions"
                    } across ${goalCount} ${goalCount === 1 ? "goal" : "goals"}`
                  : undefined
              }
              accessibilityHint={
                sessions.length > 0
                  ? "Drag to rotate the constellation. Pinch to zoom."
                  : undefined
              }
              style={styles.constellationArea}
              onLayout={handleLayout}
            >
              {/* SVG layer for lines and dots */}
              <Svg
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                {/* Lines (behind stars) */}
                {projectedLines.map((l) => (
                  <Line
                    key={l.id}
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke="rgba(0,0,0,1)"
                    strokeOpacity={l.opacity}
                    strokeWidth={l.width}
                  />
                ))}

                {/* Stars (sorted back-to-front) */}
                {projectedStars.map((s) => (
                  <Circle
                    key={s.sessionId}
                    cx={s.x}
                    cy={s.y}
                    r={s.r}
                    fill={`rgba(15,15,18,${s.opacity.toFixed(2)})`}
                  />
                ))}
              </Svg>

              {/* Empty state */}
              {isLoading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Loading your constellation…</Text>
                </View>
              ) : isError ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>The island could not be loaded.</Text>
                  <TextAction
                    label="Try Again"
                    align="center"
                    onPress={() => void refetch()}
                    containerStyle={{ marginTop: 10 }}
                  />
                </View>
              ) : sessions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    Complete sessions to grow your constellation
                  </Text>
                </View>
              ) : null}

              {/* Tooltip overlay */}
              <Tooltip star={tooltipStar} visible={tooltipVisible} />
            </View>
          </GestureDetector>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NEU.bg,
  },
  safe: {
    flex: 1,
    backgroundColor: NEU.bg,
  },
  fill: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  backAction: {
    marginLeft: -4,
  },
  counter: {
    color: NEU.textSecondary,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: "Outfit_500Medium",
  },
  constellationArea: {
    flex: 1,
    backgroundColor: NEU.bg,
    overflow: "hidden",
  },
  emptyState: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: NEU.textSecondary,
    fontSize: 16,
    fontFamily: "Outfit_500Medium",
  },
  tooltip: {
    position: "absolute",
  },
  tooltipTitle: {
    color: NEU.textPrimary,
    fontSize: 13,
    fontFamily: "Outfit_600SemiBold",
  },
  tooltipSub: {
    color: NEU.textSecondary,
    fontSize: 13,
    fontFamily: "Outfit_500Medium",
    marginTop: 1,
  },
});
