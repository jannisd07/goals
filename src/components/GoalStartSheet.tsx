/**
 * Start sheet in the paper look used by Stats and Settings: white sheet,
 * hairline options, selection shown by a green outline and label rather than a
 * filled pill. The start button is the only solid green element.
 *
 * A focus session starts with what it grows: first the category — nothing is
 * preselected there, the last one is not remembered as a choice — then the object
 * itself with its picture, so the plant you picked is the one growing in the
 * timer ring. Session length and style follow underneath. Check-in goals confirm
 * the visit and show the minimum stay that makes it count. Special objects are
 * not offered here: they only come from the rewards roadmap.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { formatMinVisitDuration } from "../types";
import { GoalGlyph } from "./GoalGlyphs";
import { GrowObjectArt } from "./grow/GrowObjectArt";
import { useAppStore } from "../store";
import {
  GROW_CATEGORIES,
  GROW_OBJECTS,
  categoryCount,
  categoryRoom,
  describeGrowLevel,
  growCategoryInfo,
  growCopies,
  type IslandObjectLevels,
} from "../lib/growRewards";
import { categoryLimit, islandGrowth, islandStageFor } from "../lib/islandScene";
import { instancesOf, nextInstanceId } from "../lib/islandInstances";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";
import type { FocusStyle, Goal, GrowCategory } from "../types";

const LENGTHS = [15, 25, 35, 45, 60, 90];

type Step = "category" | "setup";

interface Props {
  visible: boolean;
  goal: Goal | null;
  initialMinutes: number;
  initialStyle: FocusStyle;
  /** Open visit for a check-in goal, if any. */
  checkInActive?: boolean;
  onClose: () => void;
  onStartFocus: (
    minutes: number,
    style: FocusStyle,
    growCategory: GrowCategory,
    growObjectKey: string,
  ) => void;
  onToggleCheckIn: () => void;
}

export function GoalStartSheet({
  visible,
  goal,
  initialMinutes,
  initialStyle,
  checkInActive = false,
  onClose,
  onStartFocus,
  onToggleCheckIn,
}: Props) {
  const { height: screenHeight } = useWindowDimensions();
  const lastGrowObjectKey = useAppStore((state) => state.focusGrowObjectKey);
  const userId = useAppStore((state) => state.userConfig?.id ?? null);
  const storedIsland = useAppStore((state) =>
    userId ? state.islandObjectsByUser[userId] : undefined,
  );

  const [minutes, setMinutes] = useState(initialMinutes);
  const [style, setStyle] = useState<FocusStyle>(initialStyle);
  // Nothing is picked when the sheet opens: the category is a fresh decision each time.
  const [growCategory, setGrowCategory] = useState<GrowCategory | null>(null);
  const [objectKey, setObjectKey] = useState<string | null>(lastGrowObjectKey);
  const [step, setStep] = useState<Step>("category");

  useEffect(() => {
    if (!visible) return;
    setMinutes(initialMinutes);
    setStyle(initialStyle);
    setGrowCategory(null);
    setObjectKey(lastGrowObjectKey);
    setStep("category");
  }, [visible, initialMinutes, initialStyle, lastGrowObjectKey]);

  /** Levels of the island objects, in the shape the catalog helpers expect. */
  const islandLevels = useMemo<IslandObjectLevels>(() => {
    const levels: Record<string, { level: number }> = {};
    for (const entry of Object.values(storedIsland ?? {})) {
      levels[entry.objectKey] = { level: entry.level };
    }
    return levels;
  }, [storedIsland]);

  const islandStage = useMemo(() => islandStageFor(islandLevels), [islandLevels]);
  // A locked object names the distance, not just the wall (island/WACHSTUM.md §15.14).
  const toNextIsland = useMemo(() => islandGrowth(islandLevels).toNext, [islandLevels]);
  const lockedLabel =
    toNextIsland && toNextIsland > 0 ? `${toNextIsland} to grow the island` : "Island too small";
  const objects = useMemo(() => {
    if (!growCategory) return [];
    // Nothing new fits once the category has filled the island at this size.
    const noRoomLeft =
      categoryCount(growCategory, islandLevels) >= categoryLimit(islandStage, growCategory);
    return GROW_OBJECTS[growCategory].map((object) => {
      // With copies allowed, an object is only finished when every one of them
      // is standing and grown; the tile shows the copy the session would work on.
      const standing = instancesOf(islandLevels, object.key);
      const growing = standing.find(
        (id) => (islandLevels[id]?.level ?? 0) < object.maxLevel,
      );
      const room = growing === undefined
        ? nextInstanceId(islandLevels, object.key, growCopies(object)) !== null
        : true;
      const level = growing
        ? Math.max(0, Math.min(object.maxLevel, islandLevels[growing]?.level ?? 0))
        : 0;
      const locked = level === 0 && noRoomLeft && room;
      return {
        object,
        maxed: !room,
        locked,
        state: !room
          ? "Fully grown"
          : level === 0
            ? locked
              ? lockedLabel
              : standing.length > 0
                ? "Another one"
                : "New"
            : describeGrowLevel(object, level),
      };
    });
  }, [growCategory, islandLevels, islandStage, lockedLabel]);

  // Nothing selectable has two very different causes, and the player can only
  // act on one of them.
  const categoryFullReason = objects.some((entry) => entry.locked)
    ? "No room for a new one until your island grows. Pick another category to keep growing."
    : "Everything here is fully grown. Pick another category to keep growing.";

  // A remembered object from another category, or a fully grown one, falls back
  // to the first object here that can still take a reward.
  const selectedKey =
    objects.find((entry) => entry.object.key === objectKey && !entry.maxed && !entry.locked)
      ?.object.key ??
    objects.find((entry) => !entry.maxed && !entry.locked)?.object.key ??
    null;

  if (!goal) return null;
  const isFocus = goal.type === "focus";
  const categoryInfo = growCategory ? growCategoryInfo(growCategory) : null;
  const scrollMaxHeight = Math.round(screenHeight * 0.52);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.badge}>
              <GoalGlyph category={goal.category} type={goal.type} size={26} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{goal.name}</Text>
              <Text style={styles.sub}>
                {!isFocus
                  ? "Auto Check-In"
                  : step === "category" || !categoryInfo
                    ? "What should grow?"
                    : `Growing a ${categoryInfo.noun}`}
              </Text>
            </View>
          </View>

          {isFocus ? (
            step === "category" || !growCategory || !categoryInfo ? (
              <ScrollView
                style={{ maxHeight: scrollMaxHeight }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.label}>WHAT SHOULD GROW?</Text>
                <View style={styles.grid}>
                  {GROW_CATEGORIES.map((info) => {
                    const room = categoryRoom(
                      info.key,
                      islandLevels,
                      categoryLimit(islandStage, info.key),
                    );
                    const full = room.add + room.grow === 0;
                    const on = info.key === growCategory;
                    return (
                      <Pressable
                        key={info.key}
                        onPress={() => {
                          setGrowCategory(info.key);
                          // Keeps the remembered object when it belongs to this category.
                          setObjectKey(lastGrowObjectKey);
                          setStep("setup");
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${info.label}, ${
                          full
                            ? room.locked > 0
                              ? "island too small"
                              : "fully grown"
                            : `${room.add} new, ${room.grow} can grow`
                        }`}
                        style={[styles.categoryTile, on && styles.tileOn]}
                      >
                        <GrowObjectArt category={info.key} size={44} />
                        <Text style={[styles.tileName, on && styles.tileNameOn]}>{info.label}</Text>
                        <Text style={styles.tileState} numberOfLines={1}>
                          {full
                            ? room.locked > 0
                              ? lockedLabel
                              : "Fully grown"
                            : `${room.add} new · ${room.grow} can grow`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              <>
                <ScrollView
                  style={{ maxHeight: scrollMaxHeight }}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.stepHead}>
                    <Text style={[styles.label, styles.labelInline]}>
                      PICK A {categoryInfo.noun.toUpperCase()}
                    </Text>
                    <Pressable
                      onPress={() => setStep("category")}
                      accessibilityRole="button"
                      accessibilityLabel="Change category"
                      style={styles.changeTouch}
                    >
                      <Text style={styles.changeText}>Change</Text>
                    </Pressable>
                  </View>

                  <View style={styles.grid}>
                    {objects.map(({ object, state, maxed, locked }) => {
                      const on = object.key === selectedKey;
                      return (
                        <Pressable
                          key={object.key}
                          onPress={() => setObjectKey(object.key)}
                          disabled={maxed || locked}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on, disabled: maxed || locked }}
                          accessibilityLabel={`${object.name}, ${maxed ? "fully grown" : state}`}
                          style={[
                            styles.objectTile,
                            on && styles.tileOn,
                            (maxed || locked) && styles.tileOff,
                          ]}
                        >
                          <GrowObjectArt
                            category={growCategory}
                            objectKey={object.key}
                            size={46}
                          />
                          <Text
                            style={[styles.tileName, on && styles.tileNameOn]}
                            numberOfLines={1}
                          >
                            {object.name}
                          </Text>
                          <Text style={styles.tileState} numberOfLines={1}>
                            {maxed ? "Fully grown" : state}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/*
                    Flowtime has no length to pick and says nothing about it here:
                    the target is set by turning the ring on the timer, where it can
                    also be changed later. A length would promise an end the mode
                    does not have (Jannis, 2026-09-15).
                  */}
                  {style === "interval" ? (
                    <>
                      <Text style={styles.label}>SESSION LENGTH</Text>
                      <View style={styles.grid}>
                        {LENGTHS.map((m) => {
                          const on = m === minutes;
                          return (
                            <Pressable
                              key={m}
                              onPress={() => setMinutes(m)}
                              accessibilityRole="button"
                              accessibilityState={{ selected: on }}
                              accessibilityLabel={`${m} minutes`}
                              style={[styles.pill, on && styles.tileOn]}
                            >
                              <Text style={[styles.pillText, on && styles.tileNameOn]}>
                                {m} min
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}

                  <Text style={styles.label}>STYLE</Text>
                  <View style={styles.row}>
                    {(["interval", "flowtime"] as FocusStyle[]).map((s) => {
                      const on = s === style;
                      return (
                        <Pressable
                          key={s}
                          onPress={() => setStyle(s)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          style={[styles.styleBox, on && styles.tileOn]}
                        >
                          <Text style={[styles.styleTitle, on && styles.tileNameOn]}>
                            {s === "interval" ? "Intervals" : "Flowtime"}
                          </Text>
                          <Text style={[styles.styleSub, on && styles.styleSubOn]}>
                            {s === "interval" ? "Set time" : "No limit"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                {selectedKey ? null : (
                  <Text style={styles.note}>
                    {categoryFullReason}
                  </Text>
                )}
                <Pressable
                  onPress={() =>
                    selectedKey && onStartFocus(minutes, style, growCategory, selectedKey)
                  }
                  disabled={!selectedKey}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !selectedKey }}
                  style={[styles.cta, !selectedKey && styles.ctaOff]}
                >
                  <Text style={styles.ctaText}>
                    {style === "interval" ? `Start ${minutes} min` : "Set your target"}
                  </Text>
                </Pressable>
              </>
            )
          ) : (
            <>
              <Text style={styles.body}>
                {checkInActive
                  ? `A visit is running. End it to log the time and grow something for your island — after ${formatMinVisitDuration(goal.min_visit_minutes)} it counts.`
                  : `Visits shorter than ${formatMinVisitDuration(goal.min_visit_minutes)} are not counted, so passing by never becomes a session. Every counted visit grows something for your island.`}
              </Text>
              <Pressable
                onPress={onToggleCheckIn}
                accessibilityRole="button"
                style={[styles.cta, checkInActive && styles.ctaEnd]}
              >
                <Text style={styles.ctaText}>
                  {checkInActive ? "End check-in" : "Check in now"}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  wrap: { flex: 1, justifyContent: "flex-end", padding: 12 },
  card: {
    backgroundColor: PAPER.surface,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  badge: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: PAPER.accentWash,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: NEU_FONTS.heading, color: PAPER.ink, letterSpacing: -0.3 },
  sub: { fontSize: 14, fontFamily: NEU_FONTS.body, color: PAPER.inkMuted, marginTop: 1 },
  label: {
    fontSize: 11, fontFamily: NEU_FONTS.label, color: PAPER.inkFaint,
    letterSpacing: 1, marginBottom: 10,
  },
  labelInline: { marginBottom: 0 },
  stepHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10,
  },
  changeTouch: { minHeight: 44, justifyContent: "center", paddingLeft: 12 },
  changeText: { fontSize: 15, fontFamily: NEU_FONTS.label, color: PAPER.accentInk },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  row: { flexDirection: "row", gap: 8, marginBottom: 20 },
  categoryTile: {
    flexBasis: "47%", flexGrow: 1, minHeight: 108, paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: PAPER.radius, borderWidth: 1, borderColor: PAPER.line,
    backgroundColor: PAPER.surface, alignItems: "center", justifyContent: "center", gap: 4,
  },
  objectTile: {
    flexBasis: "30%", flexGrow: 1, minHeight: 112, paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: PAPER.radius, borderWidth: 1, borderColor: PAPER.line,
    backgroundColor: PAPER.surface, alignItems: "center", justifyContent: "center", gap: 4,
  },
  tileOn: { borderColor: PAPER.accent, backgroundColor: PAPER.accentWash },
  tileOff: { opacity: 0.45 },
  tileName: { fontSize: 14, fontFamily: NEU_FONTS.label, color: PAPER.ink, textAlign: "center" },
  tileNameOn: { color: PAPER.accentInk, fontFamily: NEU_FONTS.heading },
  tileState: { fontSize: 11, fontFamily: NEU_FONTS.body, color: PAPER.inkFaint, textAlign: "center" },
  pill: {
    minWidth: 84, minHeight: 44, paddingHorizontal: 14,
    borderRadius: PAPER.radius, borderWidth: 1, borderColor: PAPER.line,
    backgroundColor: PAPER.surface,
    alignItems: "center", justifyContent: "center", flexGrow: 1,
  },
  pillText: {
    fontSize: 15, fontFamily: NEU_FONTS.label, color: PAPER.inkMuted,
    fontVariant: ["tabular-nums"],
  },
  styleBox: {
    flex: 1, minHeight: 62, borderRadius: PAPER.radius, borderWidth: 1, borderColor: PAPER.line,
    backgroundColor: PAPER.surface,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 8,
  },
  styleTitle: { fontSize: 16, fontFamily: NEU_FONTS.label, color: PAPER.ink },
  styleSub: { fontSize: 13, fontFamily: NEU_FONTS.body, color: PAPER.inkMuted, marginTop: 2 },
  styleSubOn: { color: PAPER.accentInk },
  body: {
    fontSize: 15, lineHeight: 22, color: PAPER.inkMuted, fontFamily: NEU_FONTS.body,
    marginBottom: 20,
  },
  note: {
    fontSize: 13, lineHeight: 19, color: PAPER.inkMuted, fontFamily: NEU_FONTS.body,
    marginBottom: 10,
  },
  cta: {
    minHeight: 54, borderRadius: PAPER.radius, backgroundColor: PAPER.accent,
    alignItems: "center", justifyContent: "center",
  },
  ctaOff: { opacity: 0.45 },
  ctaEnd: { backgroundColor: PAPER.ink },
  ctaText: { fontSize: 17, fontFamily: NEU_FONTS.label, color: "#FFFFFF" },
  cancel: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 4 },
  cancelText: { fontSize: 16, fontFamily: NEU_FONTS.label, color: PAPER.inkMuted },
});
