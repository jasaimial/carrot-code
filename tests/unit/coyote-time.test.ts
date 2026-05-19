// -----------------------------------------------------------------------------
// carrot-code — coyote-time tests (T024)
//
// Pure state-machine: gives the hero a brief grace window after walking
// off a ledge during which a jump still counts. Spec assumption: ~100ms.
// Threshold is injected via the constructor so the production hero uses
// HERO.coyoteTimeMs and tests can use a friendlier number.
//
// Written test-first within the T024 file pair (Principle VI).
//
// See:
//   src/config/hero.ts (HERO.coyoteTimeMs)
//   .specify/memory/constitution.md  — Principle VI
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { CoyoteTimer, type CoyoteState } from "../../src/systems/coyote-time.js";

const WINDOW_MS = 100;

describe("CoyoteTimer", () => {
  it("starts in the airborne state until told otherwise", () => {
    const t = new CoyoteTimer(WINDOW_MS);
    expect(t.getState()).toBe<CoyoteState>("airborne");
    expect(t.canJump()).toBe(false);
  });

  it("enters grounded the first frame the hero touches ground", () => {
    const t = new CoyoteTimer(WINDOW_MS);
    expect(t.update(16, true)).toBe<CoyoteState>("grounded");
    expect(t.canJump()).toBe(true);
  });

  it("enters coyote on the first airborne frame after being grounded", () => {
    const t = new CoyoteTimer(WINDOW_MS);
    t.update(16, true); // grounded
    expect(t.update(16, false)).toBe<CoyoteState>("coyote");
    expect(t.canJump()).toBe(true);
  });

  it("stays in coyote while elapsed time is below the window", () => {
    const t = new CoyoteTimer(WINDOW_MS);
    t.update(16, true);
    t.update(16, false); // -> coyote, elapsed=0
    expect(t.update(50, false)).toBe<CoyoteState>("coyote");
    expect(t.update(40, false)).toBe<CoyoteState>("coyote");
    // Cumulative is 90ms (< 100ms) so still coyote.
    expect(t.canJump()).toBe(true);
  });

  it("transitions to airborne once cumulative elapsed reaches the window", () => {
    const t = new CoyoteTimer(WINDOW_MS);
    t.update(16, true);
    t.update(16, false); // -> coyote, elapsed=0
    t.update(60, false); // elapsed=60
    expect(t.update(40, false)).toBe<CoyoteState>("airborne"); // elapsed=100, >= window
    expect(t.canJump()).toBe(false);
  });

  it("returns to grounded from coyote when the hero re-touches ground", () => {
    const t = new CoyoteTimer(WINDOW_MS);
    t.update(16, true);
    t.update(16, false); // coyote
    expect(t.update(16, true)).toBe<CoyoteState>("grounded");
    expect(t.canJump()).toBe(true);
  });

  it("returns to grounded from airborne when the hero lands", () => {
    const t = new CoyoteTimer(WINDOW_MS);
    t.update(16, true);
    t.update(16, false);
    t.update(200, false); // long airborne
    expect(t.getState()).toBe<CoyoteState>("airborne");
    expect(t.update(16, true)).toBe<CoyoteState>("grounded");
  });

  it("resets the coyote window between successive ground touches", () => {
    const t = new CoyoteTimer(WINDOW_MS);
    t.update(16, true);
    t.update(16, false); // coyote 1, elapsed=0
    t.update(60, false); // coyote 1, elapsed=60
    t.update(16, true); // back to grounded; window resets
    t.update(16, false); // coyote 2, elapsed=0
    expect(t.update(60, false)).toBe<CoyoteState>("coyote");
    // If the window had not reset, this would already be airborne.
  });
});
