import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer as useExpoAudioPlayer,
  useAudioPlayerStatus,
  type AudioMetadata,
} from "expo-audio";

import { qaLog } from "../utils/qaLog";
import { getSpeakerProgress, saveSpeakerProgress } from "../utils/speakerProgress";

export interface SpeakerAudioMetadata {
  title: string;
  artist?: string;
  albumTitle?: string;
  artworkUrl?: string;
}

type LoadRequest = {
  id: number;
  uri: string;
  speakerId?: string;
  metadata?: SpeakerAudioMetadata;
};

type PendingSetup = LoadRequest & {
  autoPlay: boolean;
  savedPositionMs: number;
  savedRate: number;
};

/**
 * Speaker player backed by expo-audio. Activating lock-screen controls also
 * starts Expo's Android foreground media service, which keeps long speaker
 * recordings alive after the app is backgrounded or the screen is locked.
 */
export function useAudioPlayer() {
  const nativePlayer = useExpoAudioPlayer(null, {
    updateInterval: 500,
    keepAudioSessionActive: true,
  });
  const status = useAudioPlayerStatus(nativePlayer);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [rate, setRateState] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [didJustFinish, setDidJustFinish] = useState(false);

  const currentUriRef = useRef<string | null>(null);
  const currentSpeakerIdRef = useRef<string | null>(null);
  const lastRequestRef = useRef<LoadRequest | null>(null);
  const pendingSetupRef = useRef<PendingSetup | null>(null);
  const setupInProgressRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const finishedRequestRef = useRef<number | null>(null);
  const lastSaveRef = useRef(0);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const rateRef = useRef(1);

  const lockScreenMetadata = useCallback((request: LoadRequest): AudioMetadata => ({
    title: request.metadata?.title ?? "Speaker talk",
    artist: request.metadata?.artist ?? "Daily Paths",
    albumTitle: request.metadata?.albumTitle ?? "Daily Paths",
    artworkUrl: request.metadata?.artworkUrl,
  }), []);

  const activateBackgroundPlayback = useCallback((request: LoadRequest) => {
    nativePlayer.setActiveForLockScreen(
      true,
      lockScreenMetadata(request),
      { showSeekBackward: true, showSeekForward: true },
    );
  }, [lockScreenMetadata, nativePlayer]);

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
      } catch (error) {
        qaLog("audio", "Failed to save progress", { error: String(error) });
      }
    },
    [],
  );

  const applyAudioMode = useCallback(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch((error) => {
      qaLog("audio", "Failed to set audio mode", { error: String(error) });
    });
  }, []);

  useEffect(() => {
    applyAudioMode();
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState !== "active") return;
        applyAudioMode();
        const request = lastRequestRef.current;
        if (request && currentUriRef.current) {
          try {
            activateBackgroundPlayback(request);
          } catch (error) {
            qaLog("audio", "Failed to restore media controls", { error: String(error) });
          }
        }
      },
    );
    return () => subscription.remove();
  }, [activateBackgroundPlayback, applyAudioMode]);

  useEffect(() => {
    const nextPositionMs = Math.max(0, status.currentTime * 1000);
    const nextDurationMs = Math.max(0, status.duration * 1000);

    setIsLoaded(status.isLoaded);
    setIsPlaying(status.playing);
    setIsBuffering(status.isBuffering);
    setPositionMs(nextPositionMs);
    setDurationMs(nextDurationMs);
    positionRef.current = nextPositionMs;
    durationRef.current = nextDurationMs;

    const pending = pendingSetupRef.current;
    if (status.isLoaded && pending && setupInProgressRef.current !== pending.id) {
      setupInProgressRef.current = pending.id;
      void (async () => {
        try {
          nativePlayer.setPlaybackRate(pending.savedRate);
          if (pending.savedPositionMs > 0) {
            await nativePlayer.seekTo(pending.savedPositionMs / 1000);
          }
          if (lastRequestRef.current?.id !== pending.id) return;
          activateBackgroundPlayback(pending);
          setLoadError(null);
          if (pending.autoPlay) nativePlayer.play();
          qaLog("audio", "Sound loaded with foreground playback", {
            speakerId: pending.speakerId,
            autoPlay: pending.autoPlay,
            restoredPositionMs: pending.savedPositionMs,
          });
        } catch (error) {
          qaLog("audio", "Failed to initialize sound", { error: String(error) });
          setLoadError(String(error));
          setIsBuffering(false);
        } finally {
          if (pendingSetupRef.current?.id === pending.id) pendingSetupRef.current = null;
          if (setupInProgressRef.current === pending.id) setupInProgressRef.current = null;
        }
      })();
    }

    if (status.didJustFinish) {
      setDidJustFinish(true);
      const requestId = lastRequestRef.current?.id ?? null;
      if (requestId !== null && finishedRequestRef.current !== requestId) {
        finishedRequestRef.current = requestId;
        positionRef.current = nextDurationMs || nextPositionMs;
        void saveProgress({ didFinish: true, force: true });
      }
    } else {
      setDidJustFinish(false);
      if (status.playing) void saveProgress();
    }
  }, [activateBackgroundPlayback, nativePlayer, saveProgress, status]);

  const load = useCallback(
    async (
      uri: string,
      autoPlay = false,
      speakerId?: string,
      metadata?: SpeakerAudioMetadata,
    ) => {
      const id = ++requestIdRef.current;
      const request: LoadRequest = { id, uri, speakerId, metadata };
      lastRequestRef.current = request;

      try {
        if (currentUriRef.current === uri && status.isLoaded) {
          activateBackgroundPlayback(request);
          if (autoPlay) nativePlayer.play();
          return;
        }

        if (currentSpeakerIdRef.current) await saveProgress({ force: true });
        if (lastRequestRef.current?.id !== id) return;

        setLoadError(null);
        setIsBuffering(true);
        setIsLoaded(false);
        setPositionMs(0);
        setDurationMs(0);
        setDidJustFinish(false);
        finishedRequestRef.current = null;
        nativePlayer.clearLockScreenControls();

        let savedRate = rateRef.current;
        let savedPositionMs = 0;
        if (speakerId) {
          const saved = await getSpeakerProgress(speakerId);
          if (lastRequestRef.current?.id !== id) return;
          if (saved) {
            savedRate = saved.rate;
            if (!saved.didFinish) savedPositionMs = saved.positionMs;
            qaLog("audio", "Restored progress", {
              speakerId,
              positionMs: savedPositionMs,
              rate: savedRate,
              didFinish: saved.didFinish,
            });
          }
        }

        setRateState(savedRate);
        rateRef.current = savedRate;
        currentSpeakerIdRef.current = speakerId ?? null;
        currentUriRef.current = uri;
        pendingSetupRef.current = {
          ...request,
          autoPlay,
          savedPositionMs,
          savedRate,
        };
        nativePlayer.replace({ uri });
      } catch (error) {
        qaLog("audio", "Failed to load sound", { error: String(error) });
        setLoadError(String(error));
        setIsBuffering(false);
      }
    },
    [activateBackgroundPlayback, nativePlayer, saveProgress, status.isLoaded],
  );

  const rebuildAndPlay = useCallback(async () => {
    const request = lastRequestRef.current;
    if (!request) return;
    currentUriRef.current = null;
    qaLog("audio", "Rebuilding sound after playback ended unexpectedly", {
      speakerId: request.speakerId,
      positionMs: positionRef.current,
    });
    await saveProgress({ force: true });
    await load(request.uri, true, request.speakerId, request.metadata);
  }, [load, saveProgress]);

  const play = useCallback(async () => {
    const request = lastRequestRef.current;
    if (!request) return;
    try {
      if (!status.isLoaded) {
        await rebuildAndPlay();
        return;
      }
      activateBackgroundPlayback(request);
      nativePlayer.play();
    } catch (error) {
      qaLog("audio", "Failed to play; rebuilding", { error: String(error) });
      await rebuildAndPlay();
    }
  }, [activateBackgroundPlayback, nativePlayer, rebuildAndPlay, status.isLoaded]);

  const pause = useCallback(async () => {
    try {
      nativePlayer.pause();
      await saveProgress({ force: true });
    } catch (error) {
      qaLog("audio", "Failed to pause", { error: String(error) });
    }
  }, [nativePlayer, saveProgress]);

  const seekTo = useCallback(async (ms: number) => {
    try {
      await nativePlayer.seekTo(Math.max(0, ms) / 1000);
    } catch (error) {
      qaLog("audio", "Failed to seek", { error: String(error) });
    }
  }, [nativePlayer]);

  const seekBy = useCallback(async (seconds: number) => {
    const targetMs = Math.max(
      0,
      Math.min(positionRef.current + seconds * 1000, durationRef.current),
    );
    await seekTo(targetMs);
  }, [seekTo]);

  const setRate = useCallback(async (newRate: number) => {
    setRateState(newRate);
    rateRef.current = newRate;
    try {
      nativePlayer.setPlaybackRate(newRate);
      await saveProgress({ force: true });
    } catch (error) {
      qaLog("audio", "Failed to set rate", { error: String(error) });
    }
  }, [nativePlayer, saveProgress]);

  const unload = useCallback(async () => {
    try {
      await saveProgress({ force: true });
      nativePlayer.pause();
      nativePlayer.clearLockScreenControls();
      nativePlayer.replace(null);
      currentUriRef.current = null;
      currentSpeakerIdRef.current = null;
      lastRequestRef.current = null;
      pendingSetupRef.current = null;
      setIsLoaded(false);
      setIsPlaying(false);
      setIsBuffering(false);
      setPositionMs(0);
      setDurationMs(0);
    } catch (error) {
      qaLog("audio", "Failed to unload", { error: String(error) });
    }
  }, [nativePlayer, saveProgress]);

  useEffect(() => () => {
    const speakerId = currentSpeakerIdRef.current;
    if (speakerId) {
      void saveSpeakerProgress(speakerId, {
        positionMs: positionRef.current,
        durationMs: durationRef.current,
        rate: rateRef.current,
        didFinish: false,
      });
    }
    nativePlayer.clearLockScreenControls();
  }, [nativePlayer]);

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
