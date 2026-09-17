import type { StateCreator } from "zustand";
import { GROW_CATEGORIES, GROW_OBJECTS, type GrowCategory } from "../lib/growRewards";
import { islandStageFor, standingObjects } from "../lib/islandScene";
import { resolveSpots, seedForUser, type Spot } from "../lib/islandPlacement";

/** One object on the island. Each object exists once (island/WACHSTUM.md §14.3). */
export interface IslandObjectState {
  objectKey: string;
  /** "milestone" for the landmarks from the hour roadmap (src/lib/rewards.ts). */
  category: GrowCategory | "milestone";
  /** Stage, size or group count, depending on how the object grows (§14.4). */
  level: number;
  /**
   * A look the player picked, when the object has one: the flagpole flies a
   * flag of their choosing. Purely cosmetic — it never changes the footprint,
   * the level or where the object stands.
   */
  variant?: string | null;
  updatedAt: string;
}

/**
 * A reward the app placed by itself because nobody came back for it. Kept only
 * for this app run: it is a note for the player, not island state.
 */
export interface AutoDeliveredGrow {
  goalName: string;
  category: GrowCategory;
  objectKey: string;
  level: number;
  isNew: boolean;
}

/** A landmark that has just arrived and still owes the player its moment. */
export interface ArrivedMilestone {
  id: string;
  objectKey: string;
  tier: number;
  title: string;
  description: string;
  hours: number;
}

export interface GrowRewardApplication {
  sessionId: string;
  category: GrowCategory;
  /** The catalog key — what it is. */
  objectKey: string;
  /**
   * Which copy of it (src/lib/islandInstances.ts). Left out for rewards written
   * before copies existed, which then mean the first one.
   */
  instanceId?: string;
  toLevel: number;
}

/** Enough to protect every recent reveal; older sessions can no longer be reopened. */
const MAX_APPLIED_SESSIONS = 500;

export interface IslandSlice {
  /**
   * The island per account, one entry per object. Only on this device until
   * the island tables exist (island/WACHSTUM.md §9).
   */
  islandObjectsByUser: Record<string, Record<string, IslandObjectState>>;
  /**
   * Where each object stands, in half-metre cells around the island centre.
   * Written once when the object appears so it never moves again; only a beach
   * object whose sand moved outwards with the island gets a new place.
   */
  islandSpotsByUser: Record<string, Record<string, Spot>>;
  /**
   * The island size the player has already been shown, per account. Growing is
   * the moment everything works towards, so it gets announced exactly once —
   * without this the background would just swap between two frames and could be
   * missed entirely.
   */
  islandStageSeenByUser: Record<string, number>;
  /** Sessions whose reward was already applied, so a reveal can never grow twice. */
  appliedGrowSessionsByUser: Record<string, string[]>;
  /** What grew without being asked since the app was opened; shown once on Home. */
  autoDeliveredGrows: AutoDeliveredGrow[];
  /** Landmarks waiting to be celebrated, oldest first. */
  arrivedMilestones: ArrivedMilestone[];
  /**
   * The account whose island has been read from the server in this app run.
   * Nothing may decide what is "missing" from an island before it has arrived —
   * a fresh install would otherwise celebrate landmarks it already owns.
   */
  islandSyncedFor: string | null;
  /** Last category picked for focus sessions. */
  focusGrowCategory: GrowCategory;
  /** Last object picked for focus sessions; survives an app restart mid-session. */
  focusGrowObjectKey: string | null;
  applyGrowReward: (userId: string, reward: GrowRewardApplication) => void;
  markIslandStageSeen: (userId: string, stage: number) => void;
  /** Pick the look of an object that has one, today only the flagpole's flag. */
  setIslandObjectVariant: (userId: string, objectKey: string, variant: string | null) => void;
  /** A spot the player picked; it wins over the one the placement found. */
  placeIslandObject: (userId: string, objectKey: string, spot: Spot) => void;
  setFocusGrowCategory: (category: GrowCategory) => void;
  setFocusGrowObject: (objectKey: string | null) => void;
  /** Replaces one account's island wholesale, after merging with the server. */
  replaceIsland: (
    userId: string,
    island: {
      objects: Record<string, IslandObjectState>;
      spots: Record<string, Spot>;
      appliedSessions: string[];
    },
  ) => void;
  /**
   * Puts a landmark from the hour roadmap on the island, or grows the one that
   * is already there. Unlike a session reward this is derived from the total
   * hours, so calling it again with the same tier changes nothing.
   */
  applyMilestone: (userId: string, objectKey: string, tier: number) => void;
  noteAutoDeliveredGrows: (grows: AutoDeliveredGrow[]) => void;
  noteMilestoneArrived: (milestone: ArrivedMilestone) => void;
  setIslandSyncedFor: (userId: string | null) => void;
  clearArrivedMilestone: (id: string) => void;
  clearAutoDeliveredGrows: () => void;
}

/** The highest level this object has art for; unknown keys keep what they have. */
function maxLevelOf(objectKey: string): number {
  for (const category of GROW_CATEGORIES) {
    const object = GROW_OBJECTS[category.key].find((entry) => entry.key === objectKey);
    if (object) return object.maxLevel;
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Give every object on the island a place, keeping the ones that already have
 * one. Done when the island changes rather than while drawing, so an object
 * never jumps because something else was added next to it.
 */
function placeIsland(
  userId: string,
  island: Record<string, IslandObjectState>,
  spots: Record<string, Spot>,
): Record<string, Spot> {
  return resolveSpots(
    islandStageFor(island),
    standingObjects(island),
    spots,
    seedForUser(userId),
  );
}

export const createIslandSlice: StateCreator<IslandSlice, [], [], IslandSlice> = (set) => ({
  islandObjectsByUser: {},
  islandSpotsByUser: {},
  islandStageSeenByUser: {},
  appliedGrowSessionsByUser: {},
  autoDeliveredGrows: [],
  arrivedMilestones: [],
  islandSyncedFor: null,
  focusGrowCategory: "plant",
  focusGrowObjectKey: null,

  applyGrowReward: (userId, reward) =>
    set((state) => {
      const applied = state.appliedGrowSessionsByUser[userId] ?? [];
      if (applied.includes(reward.sessionId)) return state;
      const island = state.islandObjectsByUser[userId] ?? {};
      const target = reward.instanceId ?? reward.objectKey;
      const current = island[target];
      const grown = {
        ...island,
        [target]: {
          ...current,
          objectKey: reward.objectKey,
          category: reward.category,
          // Clamped here too: a catalog whose maxLevel was lowered would
          // otherwise keep a saved level that has no picture any more, and the
          // object would silently disappear from the island.
          level: Math.min(
            maxLevelOf(reward.objectKey),
            Math.max(current?.level ?? 0, reward.toLevel),
          ),
          updatedAt: new Date().toISOString(),
        },
      };
      return {
        islandObjectsByUser: { ...state.islandObjectsByUser, [userId]: grown },
        islandSpotsByUser: {
          ...state.islandSpotsByUser,
          [userId]: placeIsland(userId, grown, state.islandSpotsByUser[userId] ?? {}),
        },
        appliedGrowSessionsByUser: {
          ...state.appliedGrowSessionsByUser,
          [userId]: [...applied, reward.sessionId].slice(-MAX_APPLIED_SESSIONS),
        },
      };
    }),

  placeIslandObject: (userId, objectKey, spot) =>
    set((state) => {
      const island = state.islandObjectsByUser[userId] ?? {};
      if (!island[objectKey]) return state;
      // Placed first, then resolved: everything else keeps its place, and the
      // chosen spot is the one `resolveSpots` sees as already taken.
      const wanted = { ...(state.islandSpotsByUser[userId] ?? {}), [objectKey]: spot };
      // Moving something is a choice, and the merge between two phones decides
      // by the object's timestamp. Without bumping it here the move ties with
      // the other phone's old spot and snaps back after the next sync.
      const moved = {
        ...island,
        [objectKey]: { ...island[objectKey], updatedAt: new Date().toISOString() },
      };
      return {
        islandObjectsByUser: { ...state.islandObjectsByUser, [userId]: moved },
        islandSpotsByUser: {
          ...state.islandSpotsByUser,
          [userId]: placeIsland(userId, moved, wanted),
        },
      };
    }),

  applyMilestone: (userId, objectKey, tier) =>
    set((state) => {
      const island = state.islandObjectsByUser[userId] ?? {};
      if ((island[objectKey]?.level ?? 0) >= tier) return state;
      const grown = {
        ...island,
        [objectKey]: {
          ...island[objectKey],
          objectKey,
          category: "milestone" as const,
          level: tier,
          updatedAt: new Date().toISOString(),
        },
      };
      return {
        islandObjectsByUser: { ...state.islandObjectsByUser, [userId]: grown },
        islandSpotsByUser: {
          ...state.islandSpotsByUser,
          [userId]: placeIsland(userId, grown, state.islandSpotsByUser[userId] ?? {}),
        },
      };
    }),

  replaceIsland: (userId, island) =>
    set((state) => ({
      islandObjectsByUser: { ...state.islandObjectsByUser, [userId]: island.objects },
      // Spots come along, so an object the other phone placed by hand keeps its
      // place instead of being put somewhere new here.
      islandSpotsByUser: { ...state.islandSpotsByUser, [userId]: island.spots },
      appliedGrowSessionsByUser: {
        ...state.appliedGrowSessionsByUser,
        [userId]: island.appliedSessions.slice(-MAX_APPLIED_SESSIONS),
      },
    })),

  noteAutoDeliveredGrows: (grows) =>
    set((state) => ({ autoDeliveredGrows: [...state.autoDeliveredGrows, ...grows] })),

  clearAutoDeliveredGrows: () => set({ autoDeliveredGrows: [] }),

  setIslandSyncedFor: (userId) => set({ islandSyncedFor: userId }),

  noteMilestoneArrived: (milestone) =>
    set((state) =>
      state.arrivedMilestones.some((entry) => entry.id === milestone.id)
        ? state
        : { arrivedMilestones: [...state.arrivedMilestones, milestone] },
    ),

  clearArrivedMilestone: (id) =>
    set((state) => ({
      arrivedMilestones: state.arrivedMilestones.filter((entry) => entry.id !== id),
    })),

  setIslandObjectVariant: (userId, objectKey, variant) =>
    set((state) => {
      const island = state.islandObjectsByUser[userId] ?? {};
      const object = island[objectKey];
      if (!object || object.variant === variant) return state;
      return {
        islandObjectsByUser: {
          ...state.islandObjectsByUser,
          [userId]: {
            ...island,
            // The timestamp moves too, so the merge with another phone treats
            // this as the newer entry (islandMerge.ts).
            [objectKey]: { ...object, variant, updatedAt: new Date().toISOString() },
          },
        },
      };
    }),

  markIslandStageSeen: (userId, stage) =>
    set((state) => {
      // Only ever forwards: a merge from another phone must not make the island
      // announce a size the player was already shown.
      const seen = state.islandStageSeenByUser[userId] ?? 0;
      if (stage <= seen) return state;
      return {
        islandStageSeenByUser: { ...state.islandStageSeenByUser, [userId]: stage },
      };
    }),

  setFocusGrowCategory: (category) => set({ focusGrowCategory: category }),

  setFocusGrowObject: (objectKey) => set({ focusGrowObjectKey: objectKey }),
});
