// -----------------------------------------------------------------------------
// carrot-code — PWA helper tests (T055)
//
// Covers the pure detection helpers in src/pwa.ts. The DOM wiring side
// (initInstallPromptCapture / canInstall / promptInstall) is intentionally
// not exercised here — it would require jsdom event simulation plus
// module-state reset gymnastics that buys very little; the pure helpers
// carry the logic load.
//
// Test environment: `node`. No DOM dependencies.
//
// See:
//   src/pwa.ts
//   .specify/memory/constitution.md  — Principle VI
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  computeCanInstall,
  detectStandalone,
  parseUserAgentIsIos,
  type BeforeInstallPromptEvent,
  type MatchMediaFn,
  type NavigatorLike,
} from "../../src/pwa.js";

// -----------------------------------------------------------------------------
// Test helpers — stub builders that match the narrow interfaces in
// src/pwa.ts. We never reach for the real `window` / `navigator`.
// -----------------------------------------------------------------------------

function matchMediaStub(standaloneMatches: boolean): MatchMediaFn {
  return (query: string) => ({
    matches: query === "(display-mode: standalone)" && standaloneMatches,
  });
}

function navStub(userAgent: string, standalone?: boolean): NavigatorLike {
  return standalone === undefined ? { userAgent } : { userAgent, standalone };
}

// A dummy event reference is fine — computeCanInstall never invokes
// methods on it. Cast through `unknown` to keep the public type honest.
const FAKE_INSTALL_EVENT = {} as unknown as BeforeInstallPromptEvent;

// -----------------------------------------------------------------------------
// detectStandalone
// -----------------------------------------------------------------------------

describe("detectStandalone", () => {
  it("returns true when the display-mode media query matches", () => {
    const result = detectStandalone(matchMediaStub(true), navStub("Mozilla/5.0"));
    expect(result).toBe(true);
  });

  it("returns false when neither signal indicates standalone", () => {
    const result = detectStandalone(matchMediaStub(false), navStub("Mozilla/5.0"));
    expect(result).toBe(false);
  });

  it("returns true when iOS legacy navigator.standalone is true", () => {
    // matchMedia says no, but the iOS-only flag overrides — covers the
    // home-screen-launch case where Safari renders standalone but does
    // not fire the (display-mode: standalone) media match.
    const result = detectStandalone(matchMediaStub(false), navStub("iPhone Safari", true));
    expect(result).toBe(true);
  });

  it("returns false when iOS legacy navigator.standalone is explicitly false", () => {
    const result = detectStandalone(matchMediaStub(false), navStub("iPhone Safari", false));
    expect(result).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// parseUserAgentIsIos
// -----------------------------------------------------------------------------

describe("parseUserAgentIsIos", () => {
  it.each([
    ["iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15", true],
    ["iPad", "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15", true],
    [
      "iPod",
      "Mozilla/5.0 (iPod touch; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      true,
    ],
    [
      "Desktop Chrome",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
      false,
    ],
    [
      "Android Chrome",
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile",
      false,
    ],
    [
      "Desktop Safari (macOS)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15",
      false,
    ],
  ])("classifies %s as %s", (_label, ua, expected) => {
    expect(parseUserAgentIsIos(ua)).toBe(expected);
  });
});

// -----------------------------------------------------------------------------
// computeCanInstall
// -----------------------------------------------------------------------------

describe("computeCanInstall", () => {
  it("returns true when an event is captured and not standalone", () => {
    expect(computeCanInstall(FAKE_INSTALL_EVENT, false)).toBe(true);
  });

  it("returns false when no event captured (e.g. iOS Safari)", () => {
    expect(computeCanInstall(null, false)).toBe(false);
  });

  it("returns false when already running standalone (hide the button)", () => {
    // Defensive: even if the platform somehow fired a stale event after
    // install, the page is already a PWA — no install path needed.
    expect(computeCanInstall(FAKE_INSTALL_EVENT, true)).toBe(false);
  });

  it("returns false when both standalone and no event", () => {
    expect(computeCanInstall(null, true)).toBe(false);
  });
});
