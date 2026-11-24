// Orientation policy, in one place. Copied from Sober Dailies (lib/orientation.ts),
// where it was proven on a physical iPhone Duo; Hands Off uses the same logic.
// Keep the three copies in step: a fix found in one belongs in all of them.
//
// The rule: phone-class displays stay portrait — every regular iPhone, but
// NOT the Duo's cover screen, which rotates freely (see the phone branch of
// applyDisplayOrientationRule) — while tablet-class displays (the Duo's
// unfolded inner screen, iPad) rotate freely so the app follows how the
// device is held. "Tablet-class" = the display's SHORT side is at least
// 600pt, the same threshold the wide layouts use (hooks/useLayoutMode).
//
// app.json orientation is "default" (the native shell allows landscape); this
// runtime lock/unlock is what actually governs on phones. The inner display
// is different, and everything in steerToLandscape below exists because of
// three facts confirmed across Apple's Duo tech talk, Apple DTS answers,
// Unity's SDK-27 testing, and the fold-handoff fixes in other projects
// (Usernode-Labs/flutter-mobile-app#636, react-native-orientation-director#116):
//   1. Unfolding emits NO device-rotation event. iOS rotates apps on rotation
//      events, so the cover screen's portrait is carried over and simply
//      stays, even though the inner display would rotate freely.
//   2. The inner display refuses programmatic orientation changes
//      ("the current windowing mode does not allow…") and ignores the app's
//      declared orientation masks. The ONLY nudge that still lands is the
//      synthesized device-rotation that expo-screen-orientation's lockAsync
//      sends natively — and only once the fold transition has settled, which
//      takes an unpredictable amount of time.
//   3. expo's unlockAsync re-asserts the CURRENT orientation natively. Called
//      while the handoff is still stuck in portrait, it actively re-pins
//      portrait. So while a handoff is unresolved we must never unlock; we
//      hold the landscape-only lock and keep nudging until the window has
//      actually turned, then unlock for free rotation.
// The previous version gave the steer one 2.5-second shot and then unlocked
// regardless — when iOS settled slower than that, the unlock re-pinned
// portrait and every later trigger kept re-pinning it (Neal, 2026-11-06:
// "worked a couple times but then not"). Now the steer is a bounded
// retry loop driven by the same triggers, and it only ends in unlock once
// landscape has landed or the window expires into free rotation.
//
// Triggers that re-apply the rule (any single one can be missed, so all run):
//   · Dimensions change — the normal foreground fold/unfold signal, plus a
//     delayed re-assert because events during the transition can be dropped;
//   · AppState active — a fold/unfold that happens while the app is
//     backgrounded delivers no Dimensions event at all;
//   · SideInsetGuard onLayout — the root view re-laying out.
// expo-screen-orientation ships in every 2.9.0+ binary, and OTAs only reach
// binaries of the same app version, so the module is always present.
import { AppState, Dimensions, Platform } from 'react-native';

let ScreenOrientation: any = null;
try { ScreenOrientation = require('expo-screen-orientation'); } catch {}

const TABLET_MIN_DIM = 600;
// The landscape steer and cover release below exist only for iOS's Duo
// fold-handoff bugs. Android foldables rotate correctly on their own (and
// Android 16 ignores orientation locks on large screens anyway), so on
// Android the rule is simply: phone-class → portrait, tablet-class → free.
const IOS = Platform.OS === 'ios';

// How long after a cover→inner handoff we keep nudging toward landscape
// before giving up into free rotation (a physical rotation then fixes it).
// Also the window in which someone deliberately unfolding in portrait gets
// steered to landscape; the sensor corrects them on their first movement.
const STEER_WINDOW_MS = 20000;
// Pause between landscape nudges while waiting for one to take.
const STEER_RETRY_MS = 1200;

// While a screen holds its own orientation, the rule stands aside so a
// background/foreground hop can't yank that screen back to portrait.
let suspended = false;

// Which display class the last apply saw; a steer starts on phone→tablet.
let lastClass: 'phone' | 'tablet' | null = null;
let steering = false;
// Set on the phone→tablet handoff; cleared when landscape lands, the steer
// window expires, or the device folds back. While set and the window is
// still portrait, every trigger re-enters the steer instead of unlocking.
let steerUntil = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const isTabletNow = () => {
  const { width, height } = Dimensions.get('screen');
  return Math.min(width, height) >= TABLET_MIN_DIM;
};
const isWindowLandscape = () => {
  const { width, height } = Dimensions.get('window');
  return width > height;
};
// The Duo's cover screen is uniquely squat (~466×678pt); regular iPhones are
// all narrower and taller. Used to scope cover-only behavior so ordinary
// phones never see it.
const looksLikeDuoCover = () => {
  const { width, height } = Dimensions.get('screen');
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  return short >= 440 && short <= 520 && long >= 600 && long <= 740;
};

async function steerToLandscape(): Promise<void> {
  if (steering || !ScreenOrientation) return;
  steering = true;
  try {
    await sleep(500); // let the fold transition's size churn settle
    // Cycle the lock target between retries. Telemetry (2026-11-08) showed
    // repeated identical LANDSCAPE locks all "succeeding" while iOS ignored
    // them for 5–16s: a repeat of the current mask is a no-op, and only a
    // CHANGE re-triggers the synthesized rotation. Every mask here is
    // landscape-only, so portrait never flashes.
    const targets = [
      ScreenOrientation.OrientationLock.LANDSCAPE,
      ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
      ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
    ];
    let attempt = 0;
    while (isTabletNow() && !isWindowLandscape() && Date.now() < steerUntil) {
      // Landscape-only lock: portrait is NOT in the mask, and the native
      // enforce sends a synthesized landscape rotation. Re-sent every pass
      // because nudges fired before iOS settles are silently dropped.
      const pick = attempt % targets.length;
      attempt += 1;
      try {
        await ScreenOrientation.lockAsync(targets[pick]);
      } catch {
        // A refused nudge is expected mid-transition; the next pass retries.
      }
      for (let i = 0; i < STEER_RETRY_MS / 100; i++) {
        if (isWindowLandscape() || !isTabletNow()) break;
        await sleep(100);
      }
    }
  } catch {
  } finally {
    if (isWindowLandscape() || !isTabletNow() || Date.now() >= steerUntil) {
      steerUntil = 0; // resolved (or expired): back to the plain rule
    }
    steering = false;
    // Tablet + landscape → unlock (free rotation, keeping the landscape it
    // now has); folded back mid-steer → the rule re-locks portrait.
    applyDisplayOrientationRule();
  }
}

export async function applyDisplayOrientationRule(): Promise<void> {
  if (!ScreenOrientation || suspended || steering) return;
  const cls = isTabletNow() ? 'tablet' : 'phone';
  const prev = lastClass;
  lastClass = cls;
  try {
    if (cls === 'phone') {
      steerUntil = 0;
      // The Duo's cover rotates freely instead of locking portrait (Neal,
      // 2026-11-13). The apps that unfold cleanly are the ones holding no
      // lock: a portrait lock held on the cover is what iOS carries onto
      // the inner display and then refuses to change. The steer below stays
      // as the fallback for an unfold that still lands in portrait.
      if (IOS && looksLikeDuoCover()) {
        await ScreenOrientation.unlockAsync();
        return;
      }
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      return;
    }
    if (prev === 'phone' && IOS) {
      // The cover→inner handoff: open the steer window and start nudging.
      steerUntil = Date.now() + STEER_WINDOW_MS;
      steerToLandscape();
      return;
    }
    if (steerUntil > 0 && !isWindowLandscape()) {
      if (Date.now() < steerUntil) {
        // Handoff still unresolved: a new trigger re-enters the steer.
        // Never unlock here — unlock would natively re-pin portrait.
        steerToLandscape();
        return;
      }
      steerUntil = 0; // window expired: fall through to free rotation
    }
    steerUntil = 0;
    await ScreenOrientation.unlockAsync();
  } catch {
    // Lock calls reject on binaries without the native module; nothing to do.
  }
}

// The PDF reader calls these around its own unlock. Resume re-applies the
// rule, which is also what its close used to do by hand.
export function suspendOrientationRule(): void {
  suspended = true;
}
export function resumeOrientationRule(): void {
  suspended = false;
  applyDisplayOrientationRule();
}

// Apply now, then re-assert after the fold transition has settled. The Duo's
// unfold animates for around a second, and a call issued mid-transition can
// be evaluated against the old display (or dropped) — the trailing calls
// are the ones that actually take on a cover→inner handoff.
export function reassertDisplayOrientationRule(): void {
  applyDisplayOrientationRule();
  setTimeout(() => applyDisplayOrientationRule(), 400);
  setTimeout(() => applyDisplayOrientationRule(), 1200);
}

// Apply now and on every trigger above. Called once from the app root; the
// subscriptions live as long as the app, so nothing unsubscribes.
export function watchDisplayOrientationRule(): void {
  applyDisplayOrientationRule();
  Dimensions.addEventListener('change', () => reassertDisplayOrientationRule());
  AppState.addEventListener('change', (s) => {
    if (s === 'active') {
      reassertDisplayOrientationRule();
      return;
    }
    // Leaving the foreground on the Duo's COVER screen is, as often as not,
    // the start of an unfold — and a portrait lock that is still asserted
    // when the scene moves to the inner display is what gets carried over
    // and stuck there (the inner display refuses to change it afterwards).
    // So release the hold on the way out; the rule re-locks portrait the
    // moment the app is active on a phone-class display again. Scoped to
    // the cover's distinctive size so ordinary iPhones keep their lock.
    if (IOS && (s === 'inactive' || s === 'background') && looksLikeDuoCover() && !suspended && ScreenOrientation) {
      ScreenOrientation.unlockAsync().catch(() => {});
    }
  });
}
