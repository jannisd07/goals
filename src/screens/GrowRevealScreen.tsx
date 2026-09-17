/**
 * The moment after a session: what grew, at the size the session earned, and
 * the button that puts it on the island.
 *
 * Opened right after End Session (category chosen before the session) and from
 * the Auto Check-In notification (category picked here first). Each object is
 * on the island at most once: the reward adds an object that is not there yet
 * or grows one that is, by as many steps as the session's size allows
 * (island/WACHSTUM.md §14.3). The island stays on this device until the island
 * system exists.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PaperScreen } from "../components/paper/PaperUI";
import { GrowObjectArt } from "../components/grow/GrowObjectArt";
import { useGrowHistory } from "../hooks/useGrowHistory";
import { hapticLight, hapticSuccess } from "../lib/haptics";
import {
  GROW_CATEGORIES,
  asGrowCategory,
  categoryRoom,
  computeGrowSize,
  defaultGrowOption,
  describeGrowLevel,
  describeGrowOption,
  describeGrowSize,
  growCategoryInfo,
  growVisualScale,
  growOptions,
  type GrowCategory,
  type GrowOption,
  type IslandObjectLevels,
  type CategoryRoom,
} from "../lib/growRewards";
import { categoryLimit, islandGrowth, islandStageFor } from "../lib/islandScene";
import { addPendingGrow, readPendingGrows, removePendingGrow } from "../lib/pendingGrows";
import { describeInstance } from "../lib/islandInstances";
import { useAppStore } from "../store";
import type { RootStackParamList } from "../navigation/types";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";

type RevealRoute = RouteProp<RootStackParamList, "GrowReveal">;
type RevealNav = NativeStackNavigationProp<RootStackParamList>;
type Phase = "choose" | "adding" | "added";

const EMPTY_HISTORY: number[] = [];
const EMPTY_ISLAND: IslandObjectLevels = {};
const HERO_SIZE = 190;
const OPTION_ART_SIZE = 56;
const CONFETTI_PIECES = 18;
/** Only for the confetti burst; everything else uses PAPER. */
const CONFETTI_COLORS = [PAPER.accent, "#E8A33D", "#4A90D9", "#E07A5F", "#9B7BD4"];

/**
 * How big a choice is drawn: the level it would reach, as a share of the level
 * this object tops out at. A first stage is a sprout, a last stage full height.
 */
function optionScale(option: GrowOption): number {
  return growVisualScale(option.toLevel / Math.max(1, option.object.maxLevel));
}

/**
 * `toNext` is how many levels the island still needs to grow. A locked category
 * names that distance instead of only saying no (island/WACHSTUM.md §15.14).
 */
function roomLabel(room: CategoryRoom, toNext: number | null): string {
  if (room.add > 0 && room.grow > 0) return `${room.add} new · ${room.grow} to grow`;
  if (room.add > 0) return `${room.add} new`;
  if (room.grow > 0) return `${room.grow} to grow`;
  // Nothing to do here, but for two very different reasons.
  return room.locked > 0
    ? toNext && toNext > 0
      ? `${toNext} to grow the island`
      : "Island too small"
    : "Fully grown";
}

function ConfettiPiece({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const angle = (index / CONFETTI_PIECES) * Math.PI * 2;
  const distance = 95 + (index % 3) * 30;
  const spin = index % 2 === 0 ? 1 : -1;
  const style = useAnimatedStyle(() => ({
    opacity: progress.value === 0 ? 0 : 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      {
        translateY:
          Math.sin(angle) * distance * progress.value + 50 * progress.value * progress.value,
      },
      { rotate: `${progress.value * 300 * spin}deg` },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.confetti,
        { backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length] },
        style,
      ]}
    />
  );
}

function Rays() {
  const center = 130;
  const radius = 180;
  return (
    <Animated.View entering={FadeIn.duration(700)} pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 260 250">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const b = a + Math.PI / 20;
          return (
            <Path
              key={i}
              d={`M${center} ${center} L${center + Math.cos(a) * radius} ${center + Math.sin(a) * radius} L${center + Math.cos(b) * radius} ${center + Math.sin(b) * radius} Z`}
              fill={PAPER.accentWash}
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

function OptionCard({
  option,
  category,
  selected,
  disabled,
  onPress,
}: {
  option: GrowOption;
  category: GrowCategory;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const unavailable = disabled || option.maxed || option.locked;
  const detail = describeGrowOption(option);
  return (
    <View style={styles.optionCell}>
      <Pressable
        onPress={onPress}
        disabled={unavailable}
        accessibilityRole="button"
        accessibilityLabel={`${option.object.name}, ${detail}`}
        accessibilityState={{ selected, disabled: unavailable }}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View
          style={[
            styles.optionCard,
            selected && styles.optionCardOn,
            (option.maxed || option.locked) && styles.optionCardMaxed,
          ]}
        >
          <View style={[styles.optionArt, { transform: [{ scale: optionScale(option) }] }]}>
            <GrowObjectArt
              category={category}
              objectKey={option.object.key}
              level={option.toLevel}
              size={OPTION_ART_SIZE}
            />
          </View>
          <Text style={[styles.optionName, selected && styles.optionTextOn]} numberOfLines={2}>
            {option.object.name}
          </Text>
          <Text style={[styles.optionDetail, selected && styles.optionTextOn]} numberOfLines={1}>
            {detail}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export function GrowRevealScreen() {
  const route = useRoute<RevealRoute>();
  const navigation = useNavigation<RevealNav>();
  const { sessionId, goalId, goalName, durationSeconds } = route.params;
  const userId = useAppStore((state) => state.userConfig?.id ?? null);
  const storedIsland = useAppStore((state) =>
    userId ? state.islandObjectsByUser[userId] : undefined,
  );
  const alreadyApplied = useAppStore((state) =>
    userId ? (state.appliedGrowSessionsByUser[userId]?.includes(sessionId) ?? false) : false,
  );
  const applyGrowReward = useAppStore((state) => state.applyGrowReward);
  const setLastCompletedSessionId = useAppStore((state) => state.setLastCompletedSessionId);
  const reduceMotion = useReducedMotion();

  const history = useGrowHistory(goalId, sessionId);
  const [category, setCategory] = useState<GrowCategory | null>(() =>
    asGrowCategory(route.params.category),
  );
  /** Opened by the "Change …" button; see `showPicker` below. */
  const [changing, setChanging] = useState(false);
  const [objectKey, setObjectKey] = useState<string | null>(
    () => (typeof route.params.objectKey === "string" ? route.params.objectKey : null),
  );
  const [phase, setPhase] = useState<Phase>("choose");
  // Frozen when the reward is applied, so options and hero keep showing what was chosen.
  const [chosen, setChosen] = useState<{ option: GrowOption; island: IslandObjectLevels } | null>(
    null,
  );
  const appliedHere = useRef(false);

  // The reward is earned; this screen only decides what it becomes. So make sure
  // it is written down as waiting before anything else can go wrong — if the
  // write after the session failed, or the app is killed on this screen, the
  // reward is still there on the next start. Keyed by session, so writing it
  // twice changes nothing.
  useEffect(() => {
    if (alreadyApplied) return;
    void addPendingGrow({
      sessionId,
      goalId,
      goalName,
      durationSeconds,
      endedAt: new Date().toISOString(),
      category: asGrowCategory(route.params.category),
      objectKey: typeof route.params.objectKey === "string" ? route.params.objectKey : null,
    }).catch(() => undefined);
    // Only on the way in: later changes belong to the player's choice, not here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backstopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const island = chosen?.island ?? storedIsland ?? EMPTY_ISLAND;
  const size = useMemo(
    () => computeGrowSize(durationSeconds, history.data ?? EMPTY_HISTORY),
    [durationSeconds, history.data],
  );
  // The island only has room for so many objects per category; the rest waits
  // for the next island size (src/lib/islandScene.ts).
  const islandStage = useMemo(() => islandStageFor(island), [island]);
  const growth = useMemo(() => islandGrowth(island), [island]);
  const toNextIsland = growth.toNext;
  const options = useMemo(
    () =>
      category
        ? growOptions(category, size.tier, island, categoryLimit(islandStage, category))
        : [],
    [category, size.tier, island, islandStage],
  );
  const selected =
    chosen?.option ??
    options.find(
      (option) => option.object.key === objectKey && !option.maxed && !option.locked,
    ) ??
    defaultGrowOption(options);
  const rooms = useMemo(
    () =>
      GROW_CATEGORIES.map((info) => ({
        info,
        room: categoryRoom(info.key, island, categoryLimit(islandStage, info.key)),
      })),
    [island, islandStage],
  );
  const islandFull = rooms.every(({ room }) => room.add + room.grow === 0);
  // Opened again for a reward that is already on the island (the pending entry outlived it).
  const staleReveal = alreadyApplied && !appliedHere.current;
  const baseScale = selected ? optionScale(selected) : 1;

  const heroScale = useSharedValue(1);
  const heroOpacity = useSharedValue(1);
  const heroLift = useSharedValue(0);
  const burst = useSharedValue(0);

  /**
   * Only something *new* may be put down by hand. When an object grows it keeps
   * the place it already has — moving it would quietly rearrange an island the
   * player laid out, and growing is not the moment to ask about that. Moving
   * things is its own mode, reached from Home.
   *
   * Water is never placed by hand: a boat or a dock belongs to a fixed slot in
   * the water, and the placing screen only knows about things that stand on
   * land. Offering it there led to a screen where nothing could be picked up.
   */
  const canPlaceByHand = selected?.action === "add" && category !== "water";

  // The moment is over once it has been read. Nothing to press: the object is on
  // the island, so the screen hands the player back to Home by itself — and to
  // the next reward first, if one is waiting.
  useEffect(() => {
    if (phase !== "added") return;
    // A new object gets a choice instead of a hand-back: it can be placed by
    // hand, and a screen that walks away from that offer after a second would
    // make the offer worthless. Growing has no such choice — an object that is
    // already standing keeps its place — so that case still leaves on its own.
    if (canPlaceByHand) return;
    leaveTimer.current = setTimeout(() => void finish(), reduceMotion ? 700 : 1250);
    // This screen has no button on it, so it must not be able to stay: if
    // looking up the next reward ever stalls, this gets the player out anyway.
    backstopTimer.current = setTimeout(() => close(true), reduceMotion ? 2600 : 3200);
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      if (backstopTimer.current) clearTimeout(backstopTimer.current);
    };
    // `finish` is rebuilt on every render; the phase is what decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduceMotion, canPlaceByHand]);

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (backstopTimer.current) clearTimeout(backstopTimer.current);
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
  }, []);

  // Pop the object in whenever a new one is shown.
  const selectedKey = selected?.object.key ?? null;
  useEffect(() => {
    if (!selectedKey || phase !== "choose" || history.isLoading) return;
    if (reduceMotion) {
      heroScale.value = 1;
      heroOpacity.value = 1;
      return;
    }
    heroOpacity.value = 0;
    heroScale.value = 0.4;
    heroOpacity.value = withTiming(1, { duration: 220 });
    heroScale.value = withSpring(1, { damping: 11, stiffness: 140 });
  }, [selectedKey, phase, history.isLoading, reduceMotion, heroOpacity, heroScale]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ translateY: heroLift.value }, { scale: heroScale.value * baseScale }],
  }));

  const close = (rate: boolean) => {
    // The rating follows the island moment, for focus sessions and visits alike.
    if (rate) setLastCompletedSessionId(sessionId);
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("MainTabs");
  };

  /**
   * Done with this reward. If more are waiting they follow straight away instead
   * of one per visit to Home — several sessions in a row should not feel like a
   * queue the player has to keep coming back to. The rating waits for the last.
   */
  const finish = async () => {
    const next = (await readPendingGrows().catch(() => [])).find(
      (grow) => grow.sessionId !== sessionId,
    );
    if (!next) {
      close(true);
      return;
    }
    navigation.replace("GrowReveal", {
      sessionId: next.sessionId,
      goalId: next.goalId,
      goalName: next.goalName,
      durationSeconds: next.durationSeconds,
      category: next.category,
      objectKey: next.objectKey,
    });
  };

  const dropAndClose = (rate: boolean) => {
    void removePendingGrow(sessionId).catch(() => undefined);
    close(rate);
  };

  const handleAdd = () => {
    if (!userId || !category || !selected || selected.maxed || selected.locked) return;
    if (phase !== "choose") return;
    appliedHere.current = true;
    setChosen({ option: selected, island });
    applyGrowReward(userId, {
      sessionId,
      category,
      objectKey: selected.object.key,
      // Which copy: a second leafy tree starts from a seed of its own.
      instanceId: selected.instanceId,
      toLevel: selected.toLevel,
    });
    void removePendingGrow(sessionId).catch(() => undefined);
    hapticSuccess();

    if (reduceMotion) {
      setPhase("added");
      return;
    }
    setPhase("adding");
    burst.value = 0;
    burst.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) });
    heroScale.value = withSequence(
      withTiming(1.2, { duration: 180 }),
      withTiming(0.15, { duration: 520, easing: Easing.in(Easing.cubic) }),
    );
    heroLift.value = withDelay(180, withTiming(-170, { duration: 520, easing: Easing.in(Easing.cubic) }));
    heroOpacity.value = withDelay(460, withTiming(0, { duration: 240 }));
    phaseTimer.current = setTimeout(() => setPhase("added"), 820);
  };

  // No "Later" here on purpose (Jannis, 2026-09-15): the reward is earned and
  // the choice takes one tap, so putting it off only creates a queue to come
  // back to. Nothing is lost by dropping it — a reward still waits and places
  // itself if the app is killed on this screen (src/lib/growDelivery.ts).
  const topBar = (
    <View style={styles.topBar}>
      <View style={styles.topSide} />
      <Text style={styles.topTitle} numberOfLines={1}>
        {goalName}
      </Text>
      <View style={[styles.topSide, styles.topSideRight]} />
    </View>
  );

  /**
   * After something new appeared: the island already gave it a place, and this is
   * the offer to choose one instead. Done stays the plain way out, so nobody has
   * to place anything who does not want to.
   */
  const doneFooter = (onPress: () => void) => (
    <View style={styles.footer}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
      >
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Done</Text>
        </View>
      </Pressable>
    </View>
  );

  if (history.isLoading) {
    return (
      <PaperScreen edges={["top", "bottom"]}>
        {topBar}
        <View style={styles.centered}>
          <ActivityIndicator color={PAPER.accent} />
          <Text style={styles.subline}>Measuring your session…</Text>
        </View>
      </PaperScreen>
    );
  }

  if (phase === "choose" && staleReveal) {
    return (
      <PaperScreen edges={["top", "bottom"]}>
        {topBar}
        <View style={styles.centered}>
          <Text style={styles.headline} accessibilityRole="header">
            Already on your island
          </Text>
          <Text style={styles.subline}>This session's reward was added earlier.</Text>
        </View>
        {doneFooter(() => dropAndClose(false))}
      </PaperScreen>
    );
  }

  if (history.isError) {
    return (
      <PaperScreen edges={["top", "bottom"]}>
        {topBar}
        <View style={styles.centered}>
          <Text style={styles.headline}>Size not available</Text>
          <Text style={styles.subline}>
            Your earlier sessions could not be loaded, so the size of this reward is unknown.
          </Text>
          <Pressable
            onPress={() => void history.refetch()}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <View style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Try again</Text>
            </View>
          </Pressable>
        </View>
        {/* This screen has no header and no back gesture, so it must always
            offer a way out — offline with a reward already added, the header
            link is hidden and "Try again" would be the only button. */}
        {doneFooter(() => close(false))}
      </PaperScreen>
    );
  }

  if (phase === "choose" && islandFull) {
    // Nothing can take the reward right now, and the two reasons are nothing
    // alike. If the island is only still too small, the reward keeps waiting and
    // lands by itself once there is room — a session's reward is never thrown
    // away. A finished island is the other case: there is genuinely nowhere left
    // for it to go, and saying so is the end of a collection, not a loss. The
    // session still counts for everything a session counts for.
    const waitingForRoom = rooms.some(({ room }) => room.locked > 0);
    return (
      <PaperScreen edges={["top", "bottom"]}>
        {topBar}
        <View style={styles.centered}>
          <Text style={styles.headline} accessibilityRole="header">
            {waitingForRoom ? "No room on the island yet" : "Your island is finished"}
          </Text>
          <Text style={styles.subline}>
            {waitingForRoom
              ? "This reward is kept and lands by itself as soon as your island grows."
              : `All ${growth.total} levels are grown — every object, every copy, at its full size. Nothing is left for this one to grow, and the session still counts towards your hours, your streak and your stats.`}
          </Text>
        </View>
        {doneFooter(() => (waitingForRoom ? close(true) : dropAndClose(true)))}
      </PaperScreen>
    );
  }

  if (!category || !selected) {
    const fullCategory = category ? growCategoryInfo(category) : null;
    const fullCategoryRoom = category
      ? rooms.find((entry) => entry.info.key === category)?.room
      : null;
    return (
      <PaperScreen edges={["top", "bottom"]}>
        {topBar}
        <ScrollView contentContainerStyle={styles.stepContent} bounces={false}>
          <Animated.Text entering={FadeInDown.duration(360)} style={styles.headline} accessibilityRole="header">
            Something grew
          </Animated.Text>
          <View style={styles.sizeBadge}>
            <Text style={styles.sizeBadgeText}>{size.label}</Text>
          </View>
          <Text style={styles.subline}>{describeGrowSize(size, durationSeconds)}</Text>
          {fullCategory ? (
            <Text style={styles.note}>
              {fullCategoryRoom && fullCategoryRoom.locked > 0
                ? toNextIsland && toNextIsland > 0
                  ? `${fullCategory.label} has no room yet — ${toNextIsland} more levels grow your island. Pick another category for now.`
                  : `${fullCategory.label} has no room until your island grows. Pick another category.`
                : `Everything in ${fullCategory.label} is fully grown. Pick another category.`}
            </Text>
          ) : null}
          <Text style={styles.question}>What should it become?</Text>
          <View style={styles.categoryGrid}>
            {rooms.map(({ info, room }, index) => {
              const full = room.add + room.grow === 0;
              const label = roomLabel(room, toNextIsland);
              return (
                <Animated.View
                  key={info.key}
                  entering={reduceMotion ? undefined : FadeInDown.duration(320).delay(80 + index * 60)}
                  style={styles.categoryCell}
                >
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setCategory(info.key);
                      setObjectKey(null);
                    }}
                    disabled={full}
                    accessibilityRole="button"
                    accessibilityLabel={`${info.label}, ${label}`}
                    accessibilityState={{ disabled: full }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View style={[styles.categoryCard, full && styles.categoryCardFull]}>
                      <GrowObjectArt category={info.key} size={56} />
                      <Text style={styles.categoryLabel}>{info.label}</Text>
                      <Text style={styles.categoryRoom}>{label}</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </ScrollView>
      </PaperScreen>
    );
  }

  const info = growCategoryInfo(category);
  const isNew = selected.action === "add";

  if (phase === "added") {
    return (
      <PaperScreen edges={["top", "bottom"]}>
        {topBar}
        {/*
          Growing leaves on its own and a tap only means "I have read it".
          Something new waits instead, because it comes with a choice.
        */}
        <Pressable
          onPress={() => {
            if (!canPlaceByHand) void finish();
          }}
          accessibilityRole={canPlaceByHand ? undefined : "button"}
          accessibilityLabel={canPlaceByHand ? undefined : "Continue"}
          style={styles.centered}
        >
          <Animated.Text
            entering={reduceMotion ? undefined : FadeInDown.duration(320)}
            style={styles.headline}
            accessibilityRole="header"
          >
            {isNew ? "Added to your island" : "It grew on your island"}
          </Animated.Text>
          <Animated.Text
            entering={reduceMotion ? undefined : FadeInDown.duration(320).delay(90)}
            style={styles.subline}
          >
            {`${describeInstance(selected.object.name, selected.instanceId)} · ${describeGrowLevel(selected.object, selected.toLevel)}`}
          </Animated.Text>
          {canPlaceByHand ? (
            <Animated.Text
              entering={reduceMotion ? undefined : FadeInDown.duration(320).delay(160)}
              style={styles.note}
            >
              It found itself a spot. You can put it somewhere else instead.
            </Animated.Text>
          ) : null}
        </Pressable>
        {canPlaceByHand ? (
          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                hapticLight();
                navigation.navigate("IslandPlace", {
                  objectKey: selected.object.key,
                  level: selected.toLevel,
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="Place it yourself"
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <View style={styles.cta}>
                <Text style={styles.ctaText}>Place it yourself</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => void finish()}
              accessibilityRole="button"
              accessibilityLabel="Leave it where it is"
              style={({ pressed }) => [styles.secondaryTouch, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Text style={styles.secondaryText}>Leave it where it is</Text>
            </Pressable>
          </View>
        ) : null}
      </PaperScreen>
    );
  }

  const busy = phase !== "choose";
  const growable = options.filter((option) => option.action === "grow");
  const addable = options.filter((option) => option.action === "add");
  /**
   * The picker stays closed when the session already knows what it grew.
   *
   * You pick the object before a focus session and then watch it grow in the
   * ring for an hour; opening the reveal on a grid of everything else invites
   * you to undo that at the last second, and buries what you actually earned.
   * It opens on request — or on its own when the choice could not be honoured,
   * because then the screen has to show why something else is standing there.
   */
  const presetObject =
    typeof route.params.objectKey === "string" ? route.params.objectKey : null;
  const showPicker = changing || presetObject === null || selected.object.key !== presetObject;
  const renderOption = (option: GrowOption) => (
    <OptionCard
      key={option.object.key}
      option={option}
      category={category}
      selected={option.object.key === selected.object.key}
      disabled={busy}
      onPress={() => {
        hapticLight();
        setObjectKey(option.object.key);
      }}
    />
  );
  const ctaLabel = busy
    ? isNew
      ? "Adding…"
      : "Growing…"
    : isNew
      ? "Add to island"
      : "Grow on island";

  return (
    <PaperScreen edges={["top", "bottom"]}>
      {topBar}
      <ScrollView contentContainerStyle={styles.stepContent} bounces={false}>
        <Text style={styles.headline} accessibilityRole="header">
          {`Your ${info.noun} grew`}
        </Text>
        <View style={styles.sizeBadge}>
          <Text style={styles.sizeBadgeText}>{size.label}</Text>
        </View>
        <Text style={styles.subline}>{describeGrowSize(size, durationSeconds)}</Text>

        <View style={styles.heroStage}>
          {reduceMotion ? null : <Rays />}
          <View pointerEvents="none" style={styles.confettiOrigin}>
            {Array.from({ length: CONFETTI_PIECES }, (_, index) => (
              <ConfettiPiece key={index} index={index} progress={burst} />
            ))}
          </View>
          <Animated.View style={[styles.hero, heroStyle]}>
            <GrowObjectArt
              category={category}
              objectKey={selected.object.key}
              level={selected.toLevel}
              size={HERO_SIZE}
            />
          </Animated.View>
        </View>
        <Text style={styles.objectName}>{selected.object.name}</Text>
        <Text style={styles.objectDetail}>{describeGrowOption(selected)}</Text>

        {showPicker && growable.length > 0 ? (
          <>
            <Text style={styles.pickLabel}>GROW ON YOUR ISLAND</Text>
            <View style={styles.optionGrid}>{growable.map(renderOption)}</View>
          </>
        ) : null}
        {showPicker && addable.length > 0 ? (
          <>
            <Text style={styles.pickLabel}>ADD NEW</Text>
            <View style={styles.optionGrid}>{addable.map(renderOption)}</View>
          </>
        ) : null}

        {busy ? null : showPicker ? (
          <Pressable
            onPress={() => {
              setCategory(null);
              setObjectKey(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Choose a different category"
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <View style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Choose a different category</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              hapticLight();
              setChanging(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Change ${info.noun}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <View style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>{`Change ${info.noun}`}</Text>
            </View>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleAdd}
          disabled={busy || !userId}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: busy || !userId }}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <View style={[styles.cta, (busy || !userId) && styles.ctaBusy]}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </View>
        </Pressable>
      </View>
    </PaperScreen>
  );
}

const styles = StyleSheet.create({
  secondaryTouch: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  secondaryText: { fontFamily: NEU_FONTS.label, fontSize: 16, color: PAPER.accent },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PAPER.gutter,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topSide: { width: 72 },
  topSideRight: { alignItems: "flex-end" },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: PAPER.inkMuted,
    fontSize: 15,
    fontFamily: NEU_FONTS.label,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: PAPER.gutter + 8,
    gap: 10,
  },
  stepContent: {
    alignItems: "center",
    paddingHorizontal: PAPER.gutter,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headline: {
    color: PAPER.ink,
    fontSize: 28,
    fontFamily: NEU_FONTS.heading,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subline: {
    color: PAPER.inkMuted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 6,
  },
  note: {
    color: PAPER.inkMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 8,
  },
  sizeBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: PAPER.accentWash,
    borderWidth: 1,
    borderColor: PAPER.accent,
  },
  sizeBadgeText: { color: PAPER.accentInk, fontSize: 13, fontFamily: NEU_FONTS.heading },
  question: {
    color: PAPER.ink,
    fontSize: 18,
    fontFamily: NEU_FONTS.label,
    marginTop: 28,
    marginBottom: 14,
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    width: "100%",
  },
  categoryCell: { width: "47%" },
  categoryCard: {
    minHeight: 136,
    borderRadius: PAPER.radiusLg,
    borderWidth: 1,
    borderColor: PAPER.line,
    backgroundColor: PAPER.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  categoryCardFull: { opacity: 0.5 },
  categoryLabel: { color: PAPER.ink, fontSize: 16, fontFamily: NEU_FONTS.label },
  categoryRoom: { color: PAPER.inkMuted, fontSize: 13, fontFamily: NEU_FONTS.body },

  heroStage: {
    width: 260,
    height: 250,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  hero: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    transformOrigin: "bottom",
  },
  confettiOrigin: {
    position: "absolute",
    top: 125,
    left: 130,
    width: 0,
    height: 0,
  },
  confetti: {
    position: "absolute",
    width: 9,
    height: 13,
    borderRadius: 2,
    marginLeft: -4.5,
    marginTop: -6.5,
  },
  objectName: {
    color: PAPER.ink,
    fontSize: 20,
    fontFamily: NEU_FONTS.heading,
    marginTop: 2,
  },
  objectDetail: {
    color: PAPER.accentInk,
    fontSize: 14,
    fontFamily: NEU_FONTS.label,
    marginTop: 2,
  },
  pickLabel: {
    alignSelf: "flex-start",
    color: PAPER.inkFaint,
    fontSize: 11,
    fontFamily: NEU_FONTS.label,
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 10,
  },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  optionCell: { width: "31%" },
  optionCard: {
    minHeight: 128,
    borderRadius: PAPER.radius,
    borderWidth: 1,
    borderColor: PAPER.line,
    backgroundColor: PAPER.surface,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  optionCardOn: { borderColor: PAPER.accent, borderWidth: 2, backgroundColor: PAPER.accentWash },
  optionCardMaxed: { opacity: 0.5 },
  optionArt: { width: OPTION_ART_SIZE, height: OPTION_ART_SIZE, transformOrigin: "bottom" },
  optionName: {
    color: PAPER.ink,
    fontSize: 12,
    fontFamily: NEU_FONTS.label,
    textAlign: "center",
    marginTop: 6,
  },
  optionDetail: {
    color: PAPER.inkMuted,
    fontSize: 11,
    fontFamily: NEU_FONTS.body,
    textAlign: "center",
    marginTop: 2,
  },
  optionTextOn: { color: PAPER.accentInk },
  secondaryAction: {
    minHeight: PAPER.hitTarget,
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 12,
  },
  secondaryActionText: { color: PAPER.accentInk, fontSize: 15, fontFamily: NEU_FONTS.label },

  smallIsland: { width: 220, height: 120, marginBottom: 12 },
  // Scaled from the ground, so a small object still stands on the island.
  smallIslandObject: {
    position: "absolute",
    left: 67,
    bottom: 26,
    transformOrigin: "bottom",
  },

  footer: { paddingHorizontal: PAPER.gutter, paddingBottom: 8, paddingTop: 8 },
  cta: {
    minHeight: 56,
    borderRadius: PAPER.radius,
    backgroundColor: PAPER.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaBusy: { opacity: 0.6 },
  ctaText: { color: "#FFFFFF", fontSize: 17, fontFamily: NEU_FONTS.label },
});
