import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createWalletSlice, type WalletSlice } from "./walletSlice";
import { createGoalsSlice, type GoalsSlice } from "./goalsSlice";
import { createSessionSlice, type SessionSlice } from "./sessionSlice";
import { createConfigSlice, type ConfigSlice } from "./configSlice";
import { createIslandSlice, type IslandSlice } from "./islandSlice";
import { APP_STORE_STORAGE_KEY } from "../lib/storageKeys";

export type AppStore = WalletSlice & GoalsSlice & SessionSlice & ConfigSlice & IslandSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createWalletSlice(...a),
      ...createGoalsSlice(...a),
      ...createSessionSlice(...a),
      ...createConfigSlice(...a),
      ...createIslandSlice(...a),
    }),
    {
      name: APP_STORE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        fixedCommitments: state.fixedCommitments,
        disposableTimeHours: state.disposableTimeHours,
        // Goals and the week are read from the server, but the app must open
        // without one: a launch offline showed "Tap to set up" on both cards and
        // nothing could be started, although the outbox exists exactly for
        // that. The last known values are shown until the fetch succeeds; a
        // failed fetch is still reported on Home.
        goals: state.goals,
        weeklyProgress: state.weeklyProgress,
        usedTimeThisWeekSeconds: state.usedTimeThisWeekSeconds,
        preferredAmbientSound: state.preferredAmbientSound,
        ambientVolume: state.ambientVolume,
        breakDuration: state.breakDuration,
        lastSessionMinutes: state.lastSessionMinutes,
        focusStyle: state.focusStyle,
        activeSession: state.activeSession,
        pendingOnboarding: state.pendingOnboarding,
        permissionGateDismissed: state.permissionGateDismissed,
        notificationPrefs: state.notificationPrefs,
        userConfig: state.userConfig,
        islandObjectsByUser: state.islandObjectsByUser,
        islandSpotsByUser: state.islandSpotsByUser,
        islandStageSeenByUser: state.islandStageSeenByUser,
        appliedGrowSessionsByUser: state.appliedGrowSessionsByUser,
        focusGrowCategory: state.focusGrowCategory,
        focusGrowObjectKey: state.focusGrowObjectKey,
      }),
    }
  )
);
