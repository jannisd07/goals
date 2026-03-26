import type { StateCreator } from "zustand";
import type { ActiveSession, AmbientSoundKey } from "../types";

export interface SessionSlice {
  activeSession: ActiveSession | null;
  lastCompletedSessionId: string | null;
  preferredAmbientSound: AmbientSoundKey | null;
  ambientVolume: number;
  startSession: (session: ActiveSession) => void;
  endSession: () => void;
  updatePomodoro: (updates: Partial<NonNullable<ActiveSession["pomodoro"]>>) => void;
  setLastCompletedSessionId: (id: string | null) => void;
  setPreferredAmbientSound: (sound: AmbientSoundKey | null) => void;
  setAmbientVolume: (volume: number) => void;
}

export const createSessionSlice: StateCreator<SessionSlice, [], [], SessionSlice> = (set) => ({
  activeSession: null,
  lastCompletedSessionId: null,
  preferredAmbientSound: null,
  ambientVolume: 0.5,

  startSession: (session) => set({ activeSession: session }),

  endSession: () =>
    set((state) => ({
      activeSession: null,
      lastCompletedSessionId: state.activeSession?.session_id ?? null,
    })),

  updatePomodoro: (updates) =>
    set((state) => {
      if (!state.activeSession?.pomodoro) return state;
      return {
        activeSession: {
          ...state.activeSession,
          pomodoro: { ...state.activeSession.pomodoro, ...updates },
        },
      };
    }),

  setLastCompletedSessionId: (id) => set({ lastCompletedSessionId: id }),

  setPreferredAmbientSound: (sound) => set({ preferredAmbientSound: sound }),

  setAmbientVolume: (volume) => set({ ambientVolume: volume }),
});
