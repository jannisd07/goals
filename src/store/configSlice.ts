import type { StateCreator } from "zustand";
import type { UserConfig } from "../types";

export interface ConfigSlice {
  userConfig: UserConfig | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUserConfig: (config: UserConfig | null) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
}

export const createConfigSlice: StateCreator<ConfigSlice, [], [], ConfigSlice> = (set) => ({
  userConfig: null,
  isAuthenticated: false,
  isLoading: true,

  setUserConfig: (config) => set({ userConfig: config }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setLoading: (value) => set({ isLoading: value }),
});
