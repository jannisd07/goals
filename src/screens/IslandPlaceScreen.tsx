/**
 * Moving things on the island.
 *
 * One gesture, start to finish: put a finger on something, drag it, let go. Where
 * you let go is where it stands. If it cannot stand there it simply stays in your
 * hand and the next drag carries on — nothing is rejected, nothing snaps back.
 * A tick at the bottom keeps the whole set of moves and returns to Home.
 *
 * Two ways in, the same gesture:
 *
 *   * **Placing.** Opened from the reveal when something *new* appeared. Only
 *     that object can be moved; everything else is scenery.
 *   * **Rearranging.** Opened from Home with no object named. Anything on the
 *     island can be picked up, one after another.
 *
 * Growing never opens this. An object that already stands keeps its place —
 * rearranging is a decision of its own, not a side effect of a session ending.
 *
 * Moves are held here until the tick, so backing out changes nothing. One
 * coordinate system for everything on screen: `ppp` points per artwork pixel with
 * the visible window `view`. The background image is laid out with exactly that
 * window, the SVG uses it as its viewBox, and a touch is turned back into a cell
 * with the same two numbers — so nothing can drift apart.
 */

import React, { useMemo, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Path, Polygon } from "react-native-svg";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scenePaths } from "../components/island/spritePaths";
import { spriteReach } from "../components/island/islandSprites";
import { CheckIcon } from "../components/TabIcons";
import { HOME_ISLAND_STAGES } from "../lib/homeIslandStages";
import { hapticLight, hapticSuccess } from "../lib/haptics";
import {
  islandPieces,
  islandStageFor,
  spriteNameFor,
  standingObjects,
  type IslandStage,
} from "../lib/islandScene";
import {
  groundCells,
  resolveSpots,
  seedForUser,
  spotFits,
  stageZones,
  type PlacedObject,
  type Spot,
} from "../lib/islandPlacement";
import { cellAt, cellCentre, type StageZones } from "../lib/islandZones";
import { useAppStore } from "../store";
import type { RootStackParamList } from "../navigation/types";
import { NEU_FONTS } from "../theme/neumorphism";
import { PAPER } from "../theme/paper";

/**
 * How far from a picture a touch may land and still mean it, in artwork pixels.
 * A fingertip is far wider than a pixel, and a sapling is only a few pixels of
 * green — without this a thin object would be almost impossible to pick up.
 */
const GRAB_SLOP = 6;

type PlaceRoute = RouteProp<RootStackParamList, "IslandPlace">;
type PlaceNav = NativeStackNavigationProp<RootStackParamList>;

/** How much of the screen width the island fills — close, but not cut off. */
const ISLAND_ON_SCREEN = 0.96;

interface Held {
  /** Which copy is in hand — two leafy trees are two different things to move. */
  id: string;
  /** What it looks like: sprite and footprint. */
  key: string;
  level: number;
}

/** The four corners of a cell in artwork pixels, for the marker under the object. */
function cellDiamond(zones: StageZones, cell: Spot): string {
  const centre = cellCentre(zones, cell.i, cell.j);
  return [
    [centre.x - 4, centre.y + 2],
    [centre.x, centre.y],
    [centre.x + 4, centre.y + 2],
    [centre.x, centre.y + 4],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

export function IslandPlaceScreen() {
  const route = useRoute<PlaceRoute>();
  const navigation = useNavigation<PlaceNav>();
  const insets = useSafeAreaInsets();
  const asked = route.params ?? {};
  /** Named object: only that one moves. Nothing named: everything moves. */
  const only = typeof asked.objectKey === "string" ? asked.objectKey : null;

  const userId = useAppStore((state) => state.userConfig?.id ?? null);
  const island = useAppStore((state) =>
    userId ? (state.islandObjectsByUser[userId] ?? {}) : {},
  );
  const storedSpots = useAppStore((state) =>
    userId ? (state.islandSpotsByUser[userId] ?? {}) : {},
  );
  const placeIslandObject = useAppStore((state) => state.placeIslandObject);

  const [frame, setFrame] = useState({ width: 0, height: 0 });
  /** Moves made here, kept until the tick. */
  const [moves, setMoves] = useState<Record<string, Spot>>({});
  const [held, setHeld] = useState<Held | null>(null);
  const [hover, setHover] = useState<Spot | null>(null);

  /**
   * The gesture runs ahead of React: taking hold of something and dragging it
   * happen inside one touch, and the second event would still see the state from
   * before the first. These carry it.
   */
  const heldRef = useRef<Held | null>(null);
  const hoverRef = useRef<Spot | null>(null);
  const lastCell = useRef<string>("");

  const stage = islandStageFor(island) as IslandStage;
  const zones = useMemo(() => stageZones(stage), [stage]);
  const seed = seedForUser(userId);

  /** Where everything stands right now, moves included. */
  const spots = useMemo(() => ({ ...storedSpots, ...moves }), [storedSpots, moves]);

  const standing = useMemo(() => {
    const all = standingObjects(island);
    const resolved = resolveSpots(stage, all, spots, seed);
    return all
      .filter((object) => resolved[object.id])
      .map((object) => ({ ...object, spot: resolved[object.id] }));
  }, [island, stage, spots, seed]);

  /** Everything except what is in hand — that one is drawn as the ghost. */
  const scene = useMemo(() => {
    const rest = { ...island };
    if (held) delete (rest as Record<string, unknown>)[held.id];
    return scenePaths(islandPieces(stage, rest, spots, seed));
  }, [island, held, stage, spots, seed]);

  /** What the object in hand must not overlap. */
  const others = useMemo<PlacedObject[]>(
    () => standing.filter((object) => object.id !== held?.id),
    [standing, held],
  );

  /** How wide the island itself is in artwork pixels — the thing to zoom to. */
  const islandWidth = useMemo(() => {
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    zones.rows.forEach((row, rowIndex) => {
      for (let column = 0; column < row.length; column += 1) {
        if (row[column] === "." || row[column] === "S" || row[column] === "D") continue;
        const centre = cellCentre(zones, zones.iMin + rowIndex, zones.jMin + column);
        left = Math.min(left, centre.x);
        right = Math.max(right, centre.x);
      }
    });
    return Number.isFinite(left) ? Math.max(40, right - left) : zones.artW;
  }, [zones]);

  /** The camera: which artwork pixels are on screen, and how big one of them is. */
  const view = useMemo(() => {
    if (frame.width <= 0 || frame.height <= 0) return null;
    const ppp = (frame.width * ISLAND_ON_SCREEN) / islandWidth;
    const window = { w: frame.width / ppp, h: frame.height / ppp };
    return {
      asset: HOME_ISLAND_STAGES[stage - 1].background,
      ppp,
      artW: zones.artW,
      artH: zones.artH,
      x: zones.originX - window.w / 2,
      // A little above centre, so the footer does not sit on the island.
      y: zones.originY - window.h * 0.46,
      w: window.w,
      h: window.h,
    };
  }, [frame, stage, zones, islandWidth]);

  const ghost = useMemo(() => {
    if (!held || !hover) return null;
    const centre = cellCentre(zones, hover.i, hover.j);
    return {
      paths: scenePaths([
        { sprite: `${held.key}_${held.level}`, x: centre.x, y: centre.y },
      ]),
      cells: groundCells(held.key, held.level, hover),
      valid: spotFits(zones, others, held.key, held.level, hover),
    };
  }, [held, hover, zones, others]);

  /**
   * Everything that can be taken hold of, nearest first with its picture and the
   * pixel it stands on. Nearest first because that is the drawing order read
   * backwards: what is painted last is in front, and what is in front is what a
   * finger on it means.
   */
  const pickable = useMemo(
    () =>
      standing
        .filter((object) => only === null || object.id === only || object.key === only)
        .map((object) => ({
          object,
          sprite: spriteNameFor(object.key, object.level, object.variant),
          centre: cellCentre(zones, object.spot.i, object.spot.j),
        }))
        .sort((a, b) => b.centre.y - a.centre.y),
    [standing, only, zones],
  );

  const cellFrom = (x: number, y: number): Spot | null =>
    view ? cellAt(zones, view.x + x / view.ppp, view.y + y / view.ppp) : null;

  /**
   * Which object a touch means. The picture decides, not the ground: a house is
   * drawn tall and upwards from its cell, so asking which cell was touched made
   * you grab a house by its doorstep. Anything drawn wins outright, nearest
   * first; only if nothing was hit does the nearest picture within a fingertip
   * of the touch get it.
   */
  const objectAt = (x: number, y: number) => {
    if (!view) return null;
    const pointX = view.x + x / view.ppp;
    const pointY = view.y + y / view.ppp;
    let near: (typeof pickable)[number]["object"] | null = null;
    let nearest = GRAB_SLOP;
    for (const entry of pickable) {
      const reach = spriteReach(entry.sprite, entry.centre.x, entry.centre.y, pointX, pointY);
      if (reach === null) continue;
      if (reach === 0) return entry.object;
      if (reach < nearest) {
        nearest = reach;
        near = entry.object;
      }
    }
    return near;
  };

  const hoverAt = (cell: Spot) => {
    const name = `${cell.i},${cell.j}`;
    if (name === lastCell.current) return;
    lastCell.current = name;
    hoverRef.current = cell;
    hapticLight();
    setHover(cell);
  };

  /** Start of a touch: take hold of whatever is under it, unless already holding. */
  const grab = (x: number, y: number) => {
    const cell = cellFrom(x, y);
    if (heldRef.current) {
      if (!cell) return;
      // Something stayed in hand because it had nowhere to go — carry on with it.
      hoverAt(cell);
      return;
    }
    const hit = objectAt(x, y);
    if (!hit) return;
    const next = { id: hit.id, key: hit.key, level: hit.level };
    heldRef.current = next;
    hoverRef.current = hit.spot;
    lastCell.current = `${hit.spot.i},${hit.spot.j}`;
    hapticLight();
    setHeld(next);
    setHover(hit.spot);
  };

  const dragTo = (x: number, y: number) => {
    if (!heldRef.current) return;
    const cell = cellFrom(x, y);
    if (cell) hoverAt(cell);
  };

  /** Letting go puts it down — or keeps it in hand when it may not stand there. */
  const release = () => {
    const object = heldRef.current;
    const cell = hoverRef.current;
    if (!object || !cell) return;
    if (!spotFits(zones, others, object.key, object.level, cell)) return;
    heldRef.current = null;
    hoverRef.current = null;
    lastCell.current = "";
    hapticSuccess();
    setMoves((current) => ({ ...current, [object.id]: cell }));
    setHeld(null);
    setHover(null);
  };

  const gesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => runOnJS(grab)(event.x, event.y))
    .onUpdate((event) => runOnJS(dragTo)(event.x, event.y))
    .onFinalize(() => runOnJS(release)());

  const keep = () => {
    if (!userId) return;
    // Something still in hand has no place yet: confirming here would drop it
    // silently and the player would count one change more than the island got.
    if (heldRef.current) {
      hapticLight();
      return;
    }
    for (const [key, spot] of Object.entries(moves)) placeIslandObject(userId, key, spot);
    hapticSuccess();
    // Confirming ends the errand, so it ends on the island — never back on the
    // screen that sent us here.
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("MainTabs");
  };

  const moved = Object.keys(moves).length;
  const hint = held
    ? ghost?.valid
      ? "Let go to put it down."
      : "It cannot stand here — put it down before you confirm."
    : only
      ? "Drag it where you want it."
      : "Drag anything on your island.";

  const viewBox = view ? `${view.x} ${view.y} ${view.w} ${view.h}` : "0 0 1 1";

  return (
    <View style={styles.root}>
      <View
        style={styles.canvas}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setFrame({ width, height });
        }}
      >
        {view ? (
          <GestureDetector gesture={gesture}>
            <View style={StyleSheet.absoluteFill}>
              <Image
                source={view.asset}
                style={{
                  position: "absolute",
                  left: -view.x * view.ppp,
                  top: -view.y * view.ppp,
                  width: view.artW * view.ppp,
                  height: view.artH * view.ppp,
                }}
                resizeMode="stretch"
              />
              <Svg
                width={frame.width}
                height={frame.height}
                viewBox={viewBox}
                style={StyleSheet.absoluteFill}
              >
                {scene.map((path) => (
                  <Path key={path.key} d={path.d} fill={path.fill} opacity={path.opacity} />
                ))}
                {ghost
                  ? ghost.cells.map((cell) => (
                      <Polygon
                        key={`cell-${cell.i}-${cell.j}`}
                        points={cellDiamond(zones, cell)}
                        fill={ghost.valid ? PAPER.accent : "#2B2B2B"}
                        fillOpacity={0.34}
                        stroke={ghost.valid ? PAPER.accent : "#2B2B2B"}
                        strokeWidth={0.4}
                      />
                    ))
                  : null}
                {ghost
                  ? ghost.paths.map((path) => (
                      <Path
                        key={`ghost-${path.key}`}
                        d={path.d}
                        fill={path.fill}
                        opacity={path.opacity * (ghost.valid ? 0.8 : 0.45)}
                      />
                    ))
                  : null}
              </Svg>
            </View>
          </GestureDetector>
        ) : null}
      </View>

      <View style={[styles.hint, { top: insets.top + 12 }]} pointerEvents="none">
        <Text style={styles.hintText}>{hint}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Discard the changes"
          style={({ pressed }) => [styles.cancelTouch, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.count}>
          {moved === 0 ? "Nothing moved yet" : moved === 1 ? "1 moved" : `${moved} moved`}
        </Text>
        <Pressable
          onPress={keep}
          accessibilityRole="button"
          accessibilityLabel="Keep the changes"
          style={({ pressed }) => [styles.keepTouch, { opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={styles.keep}>
            <CheckIcon size={26} color="#FFFFFF" strokeWidth={2.4} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER.page },
  canvas: { flex: 1, overflow: "hidden" },
  hint: { position: "absolute", left: 24, right: 24, alignItems: "center" },
  hintText: {
    fontFamily: NEU_FONTS.body,
    fontSize: 16,
    color: PAPER.onIslandInk,
    textAlign: "center",
    backgroundColor: PAPER.onIslandVeil,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: "hidden",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: PAPER.page,
  },
  cancelTouch: { minHeight: 44, minWidth: 72, justifyContent: "center" },
  cancelText: { fontFamily: NEU_FONTS.label, fontSize: 17, color: PAPER.accentInk },
  count: { fontFamily: NEU_FONTS.body, fontSize: 14, color: PAPER.inkMuted },
  keepTouch: { minHeight: 56, minWidth: 72, alignItems: "flex-end", justifyContent: "center" },
  keep: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PAPER.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
