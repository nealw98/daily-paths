import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { qaLog } from "../utils/qaLog";
import { getSpeakerProgress, saveSpeakerProgress } from "../utils/speakerProgress";

/**
 * Hook that wraps expo-av Audio.Sound for speaker playback.
 *
 * Designed to live at the tab level (speakers.tsx) so playback persists
 * across browse/detail view switches and across tab switches.
 *
 * Playback progress (position, duration, rate, completion) is persisted
 * to AsyncStorage so users can resume where they left off.
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

  // Track the speaker ID for progress persistence
  const currentSpeakerIdRef = useRef<string | null>(null);

  // Last load request, kept so we can rebuild the sound after it dies.
  // Playback can end without the user asking: a streaming stall, an audio
  // session interruption, or Android suspending the process in the background.
  // expo-av gives us no way to revive an unloaded sound, so recovery means
  // loading the same URI again from the saved position.
  const lastRequestRef = useRef<{ uri: string; speakerId?: string } | null>(null);

  // Throttle progress saves: at most once every 5 seconds
  const lastSaveRef = useRef<number>(0);

  // Refs for latest values (used by save helpers to avoid stale closures)
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const rateRef = useRef(1);

  // ── Persistence helpers ─────────────────────────────────────────────

  const saveProgress = useCallback(
    async (opts?: { didFinish?: boolean; force?: boolean }) => {
      const speakerId = currentSpeakerIdRef.current;
      if (!speakerId) return;

      const now = Date.now();
      if (!opts?.force && now - lastSaveRef.current < 5_000) return;
      lastSaveRef.current = now;

      try {
        await saveSpeakerProgress(speakerId, {
          positionMs: positionRef.current,
          durationMs: durationRef.current,
          rate: rateRef.current,
          didFinish: opts?.didFinish ?? false,
        });
      } catch (err) {
        qaLog("audio", "Failed to save progress", { error: String(err) });
      }
    },
    []
  );

  // Configure audio mode — called on mount and whenever the app resumes from
  // background so iOS doesn't silently drop the audio session after interruptions
  // (phone calls, Siri, etc.).
  const applyAudioMode = useCallback(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    }).catch((err) => {
      qaLog("audio", "Failed to set audio mode", { error: String(err) });
    });
  }, []);

  useEffect(() => {
    applyAudioMode();
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") applyAudioMode();
    });
    return () => sub.remove();
  }, [applyAudioMode]);

  const onStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setIsLoaded(false);
      if ("error" in status && status.error) {
        qaLog("audio", "Playback error", { error: status.error });
        setLoadError(status.error);
        setIsPlaying(false);
        setIsBuffering(false);

        // The sound object is dead. Drop our references so play()/load() build
        // a fresh one instead of calling into an unloaded sound — without this
        // the play button silently does nothing and re-entering the speaker
        // hits load()'s same-URI early return, leaving the user stuck until
        // they force-quit the app.
        const dead = soundRef.current;
        soundRef.current = null;
        currentUriRef.current = null;
        dead?.unloadAsync().catch(() => {});

        // Force-save the last known position so recovery resumes where the
        // audio actually stopped rather than up to 5s earlier.
        const speakerId = currentSpeakerIdRef.current;
        if (speakerId) {
          lastSaveRef.current = Date.now();
          saveSpeakerProgress(speakerId, {
            positionMs: positionRef.current,
            durationMs: durationRef.current,
            rate: rateRef.current,
            didFinish: false,
          }).catch(() => {});
        }
      }
      return;
    }
    setIsLoaded(true);
    setIsPlaying(status.isPlaying);
    setIsBuffering(status.isBuffering);
    setPositionMs(status.positionMillis);
    setDurationMs(status.durationMillis ?? 0);
    setLoadError(null);

    // Keep refs in sync for save helpers
    positionRef.current = status.positionMillis;
    durationRef.current = status.durationMillis ?? 0;

    if (status.didJustFinish) {
      setDidJustFinish(true);
      // Immediate save on completion
      const speakerId = currentSpeakerIdRef.current;
      if (speakerId) {
        saveSpeakerProgress(speakerId, {
          positionMs: status.durationMillis ?? status.positionMillis,
          durationMs: status.durationMillis ?? 0,
          rate: rateRef.current,
          didFinish: true,
        }).catch(() => {});
      }
    } else {
      setDidJustFinish(false);

      // Throttled save during playback
      if (status.isPlaying && currentSpeakerIdRef.current) {
        const now = Date.now();
        if (now - lastSaveRef.current >= 5_000) {
          lastSaveRef.current = now;
          saveSpeakerProgress(currentSpeakerIdRef.current, {
            positionMs: status.positionMillis,
            durationMs: status.durationMillis ?? 0,
            rate: rateRef.current,
            didFinish: false,
          }).catch(() => {});
        }
      }
    }
  }, []);

  const load = useCallback(
    async (uri: string, autoPlay = false, speakerId?: string) => {
      try {
        lastRequestRef.current = { uri, speakerId };

        // If the same URI is already loaded, just toggle play state
        if (currentUriRef.current === uri && soundRef.current) {
          if (autoPlay) {
            await soundRef.current.playAsync();
          }
          return;
        }

        // Save progress for the outgoing speaker before switching
        if (currentSpeakerIdRef.current) {
          await saveProgress({ force: true });
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

        // Update speaker ID for persistence
        currentSpeakerIdRef.current = speakerId ?? null;

        // Restore saved progress for this speaker
        let savedRate = rate;
        let savedPosition = 0;
        if (speakerId) {
          const saved = await getSpeakerProgress(speakerId);
          if (saved) {
            savedRate = saved.rate;
            setRateState(saved.rate);
            rateRef.current = saved.rate;
            // Only restore position if not finished
            if (!saved.didFinish) {
              savedPosition = saved.positionMs;
            }
            qaLog("audio", "Restored progress", {
              speakerId,
              positionMs: savedPosition,
              rate: savedRate,
              didFinish: saved.didFinish,
            });
          }
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          {
            shouldPlay: autoPlay,
            rate: savedRate,
            shouldCorrectPitch: true,
            positionMillis: savedPosition,
          },
          onStatusUpdate
        );

        soundRef.current = sound;
        currentUriRef.current = uri;

        qaLog("audio", "Sound loaded", { uri: uri.substring(uri.length - 30), autoPlay, speakerId });
      } catch (err) {
        qaLog("audio", "Failed to load sound", { error: String(err) });
        setLoadError(String(err));
        setIsBuffering(false);
      }
    },
    [rate, onStatusUpdate, saveProgress]
  );

  // Rebuild the sound from the last load request. load() restores the saved
  // position, so playback picks up where it stopped.
  const rebuildAndPlay = useCallback(async () => {
    const req = lastRequestRef.current;
    if (!req) return;
    soundRef.current = null;
    currentUriRef.current = null;
    qaLog("audio", "Rebuilding sound after playback ended unexpectedly", {
      speakerId: req.speakerId,
      positionMs: positionRef.current,
    });
    await load(req.uri, true, req.speakerId);
  }, [load]);

  const play = useCallback(async () => {
    // A missing sound means playback died on its own — a stream stall, an
    // audio session interruption, or Android reclaiming the app in the
    // background. Rebuild rather than no-op, so the play button always works.
    if (!soundRef.current) {
      await rebuildAndPlay();
      return;
    }
    try {
      await soundRef.current.playAsync();
    } catch (err) {
      qaLog("audio", "Failed to play; rebuilding", { error: String(err) });
      await rebuildAndPlay();
    }
  }, [rebuildAndPlay]);

  const pause = useCallback(async () => {
    try {
      await soundRef.current?.pauseAsync();
      // Immediate save on pause
      await saveProgress({ force: true });
    } catch (err) {
      qaLog("audio", "Failed to pause", { error: String(err) });
    }
  }, [saveProgress]);

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
    rateRef.current = newRate;
    try {
      await soundRef.current?.setRateAsync(newRate, true); // shouldCorrectPitch = true
      // Save immediately so rate preference persists
      await saveProgress({ force: true });
    } catch (err) {
      qaLog("audio", "Failed to set rate", { error: String(err) });
    }
  }, [saveProgress]);

  const unload = useCallback(async () => {
    try {
      // Save final progress before unloading
      await saveProgress({ force: true });

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        currentUriRef.current = null;
        currentSpeakerIdRef.current = null;
        // Explicit stop — don't leave a request behind that play() would
        // treat as an interrupted session and resurrect.
        lastRequestRef.current = null;
        setIsLoaded(false);
        setIsPlaying(false);
        setIsBuffering(false);
        setPositionMs(0);
        setDurationMs(0);
      }
    } catch (err) {
      qaLog("audio", "Failed to unload", { error: String(err) });
    }
  }, [saveProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Best-effort save before unmount
      const speakerId = currentSpeakerIdRef.current;
      if (speakerId) {
        saveSpeakerProgress(speakerId, {
          positionMs: positionRef.current,
          durationMs: durationRef.current,
          rate: rateRef.current,
          didFinish: false,
        }).catch(() => {});
      }
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
