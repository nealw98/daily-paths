/**
 * Cold-launch timing helper. Captures the moment the JS bundle starts
 * evaluating (`LAUNCH_TIME`) so each subsequent log can show
 * milliseconds-since-launch. Use `markLaunchPhase(label)` at key points
 * to write a QA log entry with the elapsed time.
 *
 * Caveat: `LAUNCH_TIME` is captured when this module is first imported,
 * not when the OS launched the app. The native Android splash time
 * before JS evaluation begins is therefore NOT measured here — that
 * piece can only be observed externally (e.g. via the OS or by watching
 * the device).
 */

import { qaLog } from "./qaLog";

const LAUNCH_TIME = Date.now();

export function msSinceLaunch(): number {
  return Date.now() - LAUNCH_TIME;
}

export function getLaunchTime(): number {
  return LAUNCH_TIME;
}

/**
 * Write a launch-timing breadcrumb. Each entry shows the absolute
 * milliseconds elapsed since the JS bundle started evaluating and (when
 * provided) the delta from a prior phase.
 */
export function markLaunchPhase(label: string, extra?: Record<string, unknown>): void {
  qaLog("launch-timing", label, {
    msSinceLaunch: msSinceLaunch(),
    ...extra,
  });
}

// Fire one immediate marker so we can pin down JS bundle eval start.
markLaunchPhase("JS bundle evaluating");
