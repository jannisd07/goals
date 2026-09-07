import type { StateCreator } from "zustand";
import type { ActiveSession, AmbientSoundKey, FocusStyle } from "../types";

export interface SessionSlice {
  activeSession: ActiveSession | null;
  lastCompletedSessionId: string | null;
  preferredAmbientSound: AmbientSoundKey | null;
  ambientVolume: number;
  breakDuration: number;
  lastSessionMinutes: number;
  focusStyle: FocusStyle;
  startSession: (session: ActiveSession) => void;
  endSession: (requestRating?: boolean) => void;
  updatePomodoro: (updates: Partial<NonNullable<ActiveSession["pomodoro"]>>) => void;
  setLastCompletedSessionId: (id: string | null) => void;
  setPreferredAmbientSound: (sound: AmbientSoundKey | null) => void;
  setAmbientVolume: (volume: number) => void;
  setBreakDuration: (minutes: number) => void;
  setLastSessionMinutes: (minutes: number) => void;
  setFocusStyle: (style: FocusStyle) => void;
}

export const createSessionSlice: StateCreator<SessionSlice, [], [], SessionSlice> = (set) => ({
  activeSession: null,
  lastCompletedSessionId: null,
  preferredAmbientSound: null,
  ambientVolume: 0.5,
  breakDuration: 5,
  lastSessionMinutes: 25,
  focusStyle: "interval",

  startSession: (session) => set({ activeSession: session }),

  endSession: (requestRating = true) =>
    set((state) => ({
      activeSession: null,
      lastCompletedSessionId: requestRating
        ? state.activeSession?.session_id ?? null
        : null,
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

  setAmbientVolume: (volume) =>
    set({
      ambientVolume: Number.isFinite(volume)
        ? Math.min(1, Math.max(0, volume))
        : 0.5,
    }),

  setBreakDuration: (minutes) => set({ breakDuration: minutes }),

  setLastSessionMinutes: (minutes) => set({ lastSessionMinutes: minutes }),

  setFocusStyle: (style) => set({ focusStyle: style }),
});
