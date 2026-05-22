// -----------------------------------------------------------------------------
// carrot-code — PWA install helpers (T055)
//
// Pure detection helpers + a tiny module-scope store for the
// `beforeinstallprompt` event that Chromium browsers fire BEFORE we're
// ready to show an install affordance. The whole point of this module
// is to capture that event when the platform fires it and replay it
// when the player taps our own "Install" button.
//
// Split into two parts:
//
//   1. Pure helpers (`detectStandalone`, `parseUserAgentIsIos`,
//      `computeCanInstall`) — testable in node-env Vitest with injected
//      `Navigator` / `MatchMediaFn` stubs. No global access.
//
//   2. DOM wiring (`initInstallPromptCapture`, `canInstall`,
//      `promptInstall`, `isStandalone`) — uses module-scope state to
//      hold the captured event. Called from `src/main.ts` at boot. Not
//      directly unit-tested (would require jsdom event simulation +
//      module-state reset gymnastics that buys little); the pure
//      helpers above carry the logic load.
//
// Sources:
//   - https://web.dev/articles/customize-install
//   - https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event
//
// See:
//   src/main.ts                       — calls initInstallPromptCapture() at boot
//   src/scenes/MenuScene.ts           — calls canInstall() + promptInstall() (T056)
//   .specify/memory/constitution.md   — Principles V (PWA) + XI (seam pattern)
// -----------------------------------------------------------------------------

/**
 * Minimal shape of the Chromium `beforeinstallprompt` event. Typed
 * locally (not in lib.dom.d.ts at TS 5.x) so we don't have to widen the
 * project's `@types` surface for one event.
 */
export interface BeforeInstallPromptEvent extends Event {
  /**
   * Show the browser's native install prompt. Returns a promise that
   * resolves with the user's choice. The prompt may only be called
   * once per event instance — the platform invalidates the event after
   * the first call.
   */
  prompt(): Promise<void>;
  /** Resolves once the user has accepted or dismissed the prompt. */
  readonly userChoice: Promise<{ readonly outcome: "accepted" | "dismissed" }>;
}

/**
 * Subset of `window.matchMedia` used by {@link detectStandalone}. Lets
 * tests inject a deterministic stub without touching the global
 * `window`.
 */
export type MatchMediaFn = (query: string) => { readonly matches: boolean };

/**
 * Subset of `navigator` used by {@link detectStandalone} +
 * {@link parseUserAgentIsIos}. iOS Safari exposes a non-standard
 * `standalone` boolean on the navigator object that desktop Chromium
 * does not; we accept either signal.
 */
export interface NavigatorLike {
  readonly userAgent: string;
  /** iOS Safari-only legacy flag, true when launched from home screen. */
  readonly standalone?: boolean;
}

/**
 * True when the page is being rendered as an installed PWA rather than
 * in a normal browser tab. Detection covers:
 *
 *   - Modern: `(display-mode: standalone)` media query (Chrome / Edge
 *     / Android / desktop installed PWA).
 *   - iOS: `navigator.standalone === true` (Safari home-screen launch).
 *
 * The two signals are OR-ed because no single one covers all platforms
 * the project ships to.
 *
 * @param matchMedia - The `window.matchMedia` function or a stub.
 * @param nav        - The `navigator` object or a stub.
 * @returns `true` when the page is running standalone.
 */
export function detectStandalone(matchMedia: MatchMediaFn, nav: NavigatorLike): boolean {
  if (nav.standalone === true) {
    return true;
  }
  return matchMedia("(display-mode: standalone)").matches;
}

/**
 * True when the user-agent string indicates an iOS device (iPhone /
 * iPad / iPod). iOS Safari does NOT fire `beforeinstallprompt` — the
 * platform install path is the Share-sheet "Add to Home Screen" entry,
 * which we cannot trigger programmatically. Callers use this to suppress
 * the in-app Install button on iOS where it would do nothing.
 *
 * The detection is intentionally narrow (`/iPad|iPhone|iPod/`) per the
 * spec T055 description; iPadOS 13+ spoofs as Mac in `userAgent` but
 * also fires `beforeinstallprompt` is FALSE in either case (Safari is
 * still the engine), so the false negative is harmless — those users
 * fall through to "no install button shown" which is the correct
 * behaviour on iOS regardless of detection.
 *
 * @param userAgent - The `navigator.userAgent` string.
 * @returns `true` when the UA matches iPhone / iPad / iPod.
 */
export function parseUserAgentIsIos(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

/**
 * Compute whether to show the in-app install affordance. The button
 * should appear when ALL of:
 *
 *   - The platform fired (and we captured) a `beforeinstallprompt`.
 *   - The page is NOT already running standalone.
 *
 * iOS is implicitly excluded because Safari never fires
 * `beforeinstallprompt`, so `installEvent` will always be null on iOS
 * and this returns false without needing to UA-sniff.
 *
 * @param installEvent - The captured event, or `null` if none captured.
 * @param standalone   - Result of {@link detectStandalone}.
 * @returns `true` when the install button should be visible.
 */
export function computeCanInstall(
  installEvent: BeforeInstallPromptEvent | null,
  standalone: boolean,
): boolean {
  if (standalone) {
    return false;
  }
  return installEvent !== null;
}

// -----------------------------------------------------------------------------
// Module-scope state + DOM wiring. Called from src/main.ts.
// -----------------------------------------------------------------------------

/** Captured `beforeinstallprompt`, replayed when the user taps Install. */
let capturedInstallEvent: BeforeInstallPromptEvent | null = null;

/** True once the platform fires `appinstalled` so we can hide the button. */
let installed = false;

/**
 * Wire up the global `beforeinstallprompt` + `appinstalled` listeners.
 * Idempotent: safe to call multiple times in dev hot-reload.
 *
 * MUST be called as early as possible in app boot — Chromium fires the
 * event once on page load, and if no listener is attached yet the event
 * is lost. `src/main.ts` calls this synchronously before Phaser starts.
 */
export function initInstallPromptCapture(): void {
  if (typeof window === "undefined") {
    return; // node / test environment — nothing to wire
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    // Stop the browser's default mini-infobar so our in-game button is
    // the only install path the user sees.
    event.preventDefault();
    capturedInstallEvent = event as BeforeInstallPromptEvent;
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    capturedInstallEvent = null;
  });
}

/**
 * `true` when the page is currently running as an installed PWA.
 * Wrapper around {@link detectStandalone} that pulls from real globals.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return detectStandalone(window.matchMedia.bind(window), window.navigator);
}

/**
 * `true` when the in-app install affordance should be visible. See
 * {@link computeCanInstall} for the rule.
 */
export function canInstall(): boolean {
  if (installed) {
    return false;
  }
  return computeCanInstall(capturedInstallEvent, isStandalone());
}

/**
 * Fire the captured install prompt. No-op when no event is captured
 * (defensive: UI should gate on {@link canInstall} first). Each captured
 * event can only be prompted once; we null it out either way so the
 * UI hides afterwards.
 *
 * @returns A promise resolving to the user's choice, or `null` when
 *   there was no event to prompt with.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  const event = capturedInstallEvent;
  if (event === null) {
    return null;
  }
  capturedInstallEvent = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}
