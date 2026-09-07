import { useEffect, useRef, useCallback } from "react";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useAppStore } from "../store";
import { persistUserPreferences } from "../lib/userPreferences";
import type { AmbientSoundKey } from "../types";

const SOUND_FILES: Record<AmbientSoundKey, number> = {
  rain: require("../../assets/sounds/rain.mp3"),
  cafe: require("../../assets/sounds/cafe.mp3"),
  white_noise: require("../../assets/sounds/white_noise.mp3"),
  forest: require("../../assets/sounds/forest.mp3"),
  lofi: require("../../assets/sounds/lofi.mp3"),
};

export function useAmbientSound() {
  const activeSession = useAppStore((s) => s.activeSession);
  const ambientVolume = useAppStore((s) => s.ambientVolume);
  const setPreferredAmbientSound = useAppStore((s) => s.setPreferredAmbientSound);
  const setAmbientVolume = useAppStore((s) => s.setAmbientVolume);
  const userId = useAppStore((s) => s.userConfig?.id);

  const currentSound = activeSession?.ambient_sound ?? null;
  const audioModeSet = useRef(false);
  const volumePersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useAudioPlayer(
    currentSound ? SOUND_FILES[currentSound] : null
  );

  // Configure audio mode once
  useEffect(() => {
    if (!audioModeSet.current) {
      void setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix",
      }).catch(() => {
        // Playback controls remain usable in the foreground if the native
        // background audio session cannot be configured.
      });
      audioModeSet.current = true;
    }
  }, []);

  // Set loop and volume
  useEffect(() => {
    player.loop = true;
    player.volume = ambientVolume;
  }, [player, ambientVolume]);

  // Play/pause based on session state
  useEffect(() => {
    if (currentSound && activeSession?.pomodoro?.is_running) {
      player.volume = ambientVolume;
      player.loop = true;
      player.play();
    } else {
      player.pause();
    }
  }, [currentSound, activeSession?.pomodoro?.is_running, player]);

  // Update volume when it changes
  useEffect(() => {
    player.volume = ambientVolume;
  }, [ambientVolume, player]);

  const stop = useCallback(() => {
    player.pause();
  }, [player]);

  const selectSound = useCallback((soundKey: AmbientSoundKey | null) => {
    setPreferredAmbientSound(soundKey);
    if (userId) {
      void persistUserPreferences(userId, {
        preferred_ambient_sound: soundKey,
      }).catch((error) => {
        console.warn("Could not persist preferred focus music:", error);
      });
    }
    const state = useAppStore.getState();
    if (state.activeSession) {
      state.startSession({
        ...state.activeSession,
        ambient_sound: soundKey,
      });
    }
  }, [setPreferredAmbientSound, userId]);

  const updateVolume = useCallback((nextVolume: number) => {
    setAmbientVolume(nextVolume);
    if (volumePersistTimerRef.current) {
      clearTimeout(volumePersistTimerRef.current);
    }
    if (!userId) return;

    volumePersistTimerRef.current = setTimeout(() => {
      const value = useAppStore.getState().ambientVolume;
      void persistUserPreferences(userId, { ambient_volume: value }).catch((error) => {
        console.warn("Could not persist focus music volume:", error);
      });
    }, 500);
  }, [setAmbientVolume, userId]);

  useEffect(
    () => () => {
      if (volumePersistTimerRef.current) {
        clearTimeout(volumePersistTimerRef.current);
      }
    },
    [],
  );

  return {
    currentSound,
    volume: ambientVolume,
    selectSound,
    setVolume: updateVolume,
    stop,
  };
}
