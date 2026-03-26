import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createWalletSlice, type WalletSlice } from "./walletSlice";
import { createGoalsSlice, type GoalsSlice } from "./goalsSlice";
import { createSessionSlice, type SessionSlice } from "./sessionSlice";
import { createConfigSlice, type ConfigSlice } from "./configSlice";

export type AppStore = WalletSlice & GoalsSlice & SessionSlice & ConfigSlice;

export const useAppStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createWalletSlice(...a),
      ...createGoalsSlice(...a),
      ...createSessionSlice(...a),
      ...createConfigSlice(...a),
    }),
    {
      name: "vibetime-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        fixedCommitments: state.fixedCommitments,
        disposableTimeHours: state.disposableTimeHours,
        preferredAmbientSound: state.preferredAmbientSound,
        ambientVolume: state.ambientVolume,
        userConfig: state.userConfig,
      }),
    }
  )
);
