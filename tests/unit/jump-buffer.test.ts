// -----------------------------------------------------------------------------
// carrot-code — jump-buffer tests (T025)
//
// Pure micro state machine: when the player presses jump while still
// airborne, the press is remembered for a short window so that landing
// within that window auto-consumes it as a jump. Spec assumption: ~100ms.
//
// Test-first within the T025 file pair (Principle VI).
//
// See:
//   src/config/hero.ts (HERO.jumpBufferMs)
//   .specify/memory/constitution.md  — Principle VI
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { JumpBuffer } from "../../src/systems/jump-buffer.js";

const WINDOW_MS = 100;

describe("JumpBuffer", () => {
  it("starts empty: consumeIfBuffered returns false without a prior press", () => {
    const b = new JumpBuffer(WINDOW_MS);
    expect(b.consumeIfBuffered(0)).toBe(false);
  });

  it("consumes a press made within the window", () => {
    const b = new JumpBuffer(WINDOW_MS);
    b.pressed(1000);
    expect(b.consumeIfBuffered(1050)).toBe(true);
  });

  it("consumes a press at the exact boundary (inclusive)", () => {
    const b = new JumpBuffer(WINDOW_MS);
    b.pressed(1000);
    expect(b.consumeIfBuffered(1000 + WINDOW_MS)).toBe(true);
  });

  it("rejects a press that has expired", () => {
    const b = new JumpBuffer(WINDOW_MS);
    b.pressed(1000);
    expect(b.consumeIfBuffered(1000 + WINDOW_MS + 1)).toBe(false);
  });

  it("consumption is one-shot: the buffer empties after a successful consume", () => {
    const b = new JumpBuffer(WINDOW_MS);
    b.pressed(1000);
    expect(b.consumeIfBuffered(1010)).toBe(true);
    expect(b.consumeIfBuffered(1020)).toBe(false);
  });

  it("consumption also clears an expired press (no stale state)", () => {
    const b = new JumpBuffer(WINDOW_MS);
    b.pressed(1000);
    expect(b.consumeIfBuffered(2000)).toBe(false);
    // Re-pressing must work normally afterwards.
    b.pressed(2100);
    expect(b.consumeIfBuffered(2150)).toBe(true);
  });

  it("a second press overrides the first (only the most recent press matters)", () => {
    const b = new JumpBuffer(WINDOW_MS);
    b.pressed(1000); // about to expire
    b.pressed(1500); // fresh
    expect(b.consumeIfBuffered(1550)).toBe(true); // honors the second press
  });

  it("hasBuffered reflects window state without consuming", () => {
    const b = new JumpBuffer(WINDOW_MS);
    expect(b.hasBuffered(1000)).toBe(false);
    b.pressed(1000);
    expect(b.hasBuffered(1050)).toBe(true);
    expect(b.hasBuffered(1200)).toBe(false);
    // Calling hasBuffered does NOT consume the buffer.
    b.pressed(2000);
    expect(b.hasBuffered(2050)).toBe(true);
    expect(b.consumeIfBuffered(2060)).toBe(true);
  });
});
