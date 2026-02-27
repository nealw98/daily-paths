import { useState, useEffect, useCallback, useRef } from "react";
import { Audio, AVPlaybackStatus } from "expo-av";
import { qaLog } from "../utils/qaLog";

/**
 * Hook that wraps expo-av Audio.Sound for speaker playback.
 *
 * Designed to live at the tab level (speakers.tsx) so playback persists
 * across browse/detail view switches and across tab switches.
 *
 * Audio only stops when the user explicitly pauses or when the hook unmounts.
 */
export function useAudioPlayer() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [rate, setRateState] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [didJustFinish, setDidJustFinish] = useState(false);

  // Track the currently loaded URI so we can avoid reloading the same file
  const currentUriRef = useRef<string | null>(null);

  // Configure audio mode on mount
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    }).catch((err) => {
      qaLog("audio", "Failed to set audio mode", { error: String(err) });
    });
  }, []);

  const onStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setIsLoaded(false);
      if ("error" in status && status.error) {
        qaLog("audio", "Playback error", { error: status.error });
        setLoadError(status.error);
      }
      return;
    }
    setIsLoaded(true);
    setIsPlaying(status.isPlaying);
    setIsBuffering(status.isBuffering);
    setPositionMs(status.positionMillis);
    setDurationMs(status.durationMillis ?? 0);
    setLoadError(null);

    if (status.didJustFinish) {
      setDidJustFinish(true);
    } else {
      setDidJustFinish(false);
    }
  }, []);

  const load = useCallback(
    async (uri: string, autoPlay = false) => {
      try {
        // If the same URI is already loaded, just toggle play state
        if (currentUriRef.current === uri && soundRef.current) {
          if (autoPlay) {
            await soundRef.current.playAsync();
          }
          return;
        }

        setLoadError(null);
        setIsBuffering(true);
        setIsLoaded(false);
        setPositionMs(0);
        setDurationMs(0);

        // Unload previous sound
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
          currentUriRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: autoPlay, rate, shouldCorrectPitch: true },
          onStatusUpdate
        );

        soundRef.current = sound;
        currentUriRef.current = uri;

        qaLog("audio", "Sound loaded", { uri: uri.substring(uri.length - 30), autoPlay });
      } catch (err) {
        qaLog("audio", "Failed to load sound", { error: String(err) });
        setLoadError(String(err));
        setIsBuffering(false);
      }
    },
    [rate, onStatusUpdate]
  );

  const play = useCallback(async () => {
    try {
      await soundRef.current?.playAsync();
    } catch (err) {
      qaLog("audio", "Failed to play", { error: String(err) });
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      await soundRef.current?.pauseAsync();
    } catch (err) {
      qaLog("audio", "Failed to pause", { error: String(err) });
    }
  }, []);

  const seekTo = useCallback(async (ms: number) => {
    try {
      await soundRef.current?.setPositionAsync(ms);
    } catch (err) {
      qaLog("audio", "Failed to seek", { error: String(err) });
    }
  }, []);

  const seekBy = useCallback(
    async (seconds: number) => {
      const target = Math.max(0, Math.min(positionMs + seconds * 1000, durationMs));
      try {
        await soundRef.current?.setPositionAsync(target);
      } catch (err) {
        qaLog("audio", "Failed to seekBy", { error: String(err) });
      }
    },
    [positionMs, durationMs]
  );

  const setRate = useCallback(async (newRate: number) => {
    setRateState(newRate);
    try {
      await soundRef.current?.setRateAsync(newRate, true); // shouldCorrectPitch = true
    } catch (err) {
      qaLog("audio", "Failed to set rate", { error: String(err) });
    }
  }, []);

  const unload = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        currentUriRef.current = null;
        setIsLoaded(false);
        setIsPlaying(false);
        setIsBuffering(false);
        setPositionMs(0);
        setDurationMs(0);
      }
    } catch (err) {
      qaLog("audio", "Failed to unload", { error: String(err) });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  return {
    load,
    play,
    pause,
    seekTo,
    seekBy,
    setRate,
    unload,
    isLoaded,
    isPlaying,
    isBuffering,
    positionMs,
    durationMs,
    rate,
    loadError,
    didJustFinish,
    currentUri: currentUriRef.current,
  };
}

export type AudioPlayer = ReturnType<typeof useAudioPlayer>;
