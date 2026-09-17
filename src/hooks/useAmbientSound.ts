import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
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
  const status = useAudioPlayerStatus(player);
  /**
   * When the file is actually playable.
   *
   * Not `status.isLoaded`: in expo-audio 55 that stays `false` on iOS even after
   * the player reports `playbackState: "readyToPlay"` and a real duration. Going
   * by it would keep the music switched off for good — measured on 2026-09-15,
   * where the player sat at `readyToPlay`, `duration: 97.32`, `isLoaded: false`.
   */
  const isReady =
    Boolean(status?.isLoaded) ||
    status?.playbackState === "readyToPlay" ||
    (status?.duration ?? 0) > 0;
  /**
   * The audio session has to be configured before anything is played.
   *
   * `setAudioModeAsync` is a promise, and the play effect below used to fire
   * while it was still in flight — measured at 19 ms ahead of it on 2026-09-15.
   * iOS then leaves the player sitting at `timeControlStatus: "paused"`: play()
   * was accepted, nothing came out, and nothing tried again. That is the whole
   * "the music does not work" bug, and it depended on timing, which is why it
   * was not always reproducible.
   *
   * A failure still flips the flag: playing without the preferred mode is worth
   * more than never playing at all.
   */
  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => {
    if (audioModeSet.current) return;
    audioModeSet.current = true;
    let cancelled = false;
    const done = () => {
      if (!cancelled) setAudioReady(true);
    };
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    })
      .then(done)
      .catch((error) => {
        console.warn("Could not set the audio mode; playing anyway:", error);
        done();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Set loop and volume
  useEffect(() => {
    player.loop = true;
    player.volume = ambientVolume;
  }, [player, ambientVolume]);

  // Play/pause with the session, once the file and the audio session are ready.
  const shouldPlay = Boolean(currentSound) && Boolean(activeSession?.pomodoro?.is_running);
  const isPlaying = Boolean(status?.playing);
  useEffect(() => {
    if (!shouldPlay) {
      if (isPlaying) player.pause();
      return;
    }
    if (!audioReady || !isReady || isPlaying) return;
    player.volume = ambientVolume;
    player.loop = true;
    player.muted = false;
    player.play();
    // `ambientVolume` is deliberately not a dependency: turning the volume down
    // must not restart playback. Its own effect below keeps the player in step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioReady, shouldPlay, isReady, isPlaying, player]);

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
