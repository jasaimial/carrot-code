/**
 * Tests for the pure-logic surface of the hero entity (T033).
 *
 * The hero entity itself is a Phaser sprite (DOM/WebGL-bound, untestable
 * in node without a jsdom + phaser-stub mess). The pure-logic piece we
 * CAN test is the input-resolver: given current input flags + a
 * coyote-time state + jump-buffer state + ground-contact flag, what
 * action should the hero apply this frame?
 *
 * Extracting that decision into `resolveHeroFrameAction()` lets us
 * verify the jump-feel rules (variable height, coyote, buffer, ground
 * landing consumption) without instantiating Phaser. The hero entity
 * is then a thin Phaser wrapper that translates input → state →
 * Arcade-physics velocity changes.
 *
 * Test approach: hand-build the input + timer state, call the resolver,
 * assert on the returned action descriptor. No mocks; the resolver is
 * a pure function.
 *
 * See:
 *   src/entities/hero.ts          — the resolver + Phaser wrapper
 *   src/systems/coyote-time.ts    — already 100% tested
 *   src/systems/jump-buffer.ts    — already 100% tested
 *   .specify/memory/constitution.md — Principle VI (test-first for pure logic)
 */

import { describe, expect, it } from "vitest";

import { CoyoteTimer } from "../../src/systems/coyote-time.js";
import { JumpBuffer } from "../../src/systems/jump-buffer.js";
import { resolveHeroFrameAction, type HeroInput } from "../../src/entities/hero-input.js";

/**
 * Convenience: build a fresh input flag set with all keys false.
 * @returns A HeroInput with every flag set to false.
 */
function noInput(): HeroInput {
  return { left: false, right: false, jumpPressed: false, jumpHeld: false };
}

/**
 * Convenience: build a CoyoteTimer pre-warmed to a given state.
 * @param state - The terminal state to drive the timer into.
 * @returns A timer whose `getState()` returns the requested state.
 */
function coyoteIn(state: "grounded" | "coyote" | "airborne"): CoyoteTimer {
  const t = new CoyoteTimer(100);
  if (state === "grounded") {
    t.update(16, true);
  } else if (state === "coyote") {
    t.update(16, true); // grounded
    t.update(16, false); // first airborne frame opens coyote window
  } else {
    t.update(16, true); // grounded
    t.update(16, false); // coyote
    t.update(200, false); // past the window
  }
  return t;
}

describe("resolveHeroFrameAction", () => {
  describe("horizontal movement", () => {
    it("returns moveDirection 0 when no input is held", () => {
      const action = resolveHeroFrameAction({
        input: noInput(),
        coyote: coyoteIn("grounded"),
        buffer: new JumpBuffer(100),
        nowMs: 0,
        isOnGround: true,
        upwardVelocityPxPerSec: 0,
      });
      expect(action.moveDirection).toBe(0);
    });

    it("returns moveDirection -1 when only left is held", () => {
      const input = { ...noInput(), left: true };
      const action = resolveHeroFrameAction({
        input,
        coyote: coyoteIn("grounded"),
        buffer: new JumpBuffer(100),
        nowMs: 0,
        isOnGround: true,
        upwardVelocityPxPerSec: 0,
      });
      expect(action.moveDirection).toBe(-1);
    });

    it("returns moveDirection +1 when only right is held", () => {
      const input = { ...noInput(), right: true };
      const action = resolveHeroFrameAction({
        input,
        coyote: coyoteIn("grounded"),
        buffer: new JumpBuffer(100),
        nowMs: 0,
        isOnGround: true,
        upwardVelocityPxPerSec: 0,
      });
      expect(action.moveDirection).toBe(1);
    });

    it("returns moveDirection 0 when both left and right are held (cancels)", () => {
      const input = { ...noInput(), left: true, right: true };
      const action = resolveHeroFrameAction({
        input,
        coyote: coyoteIn("grounded"),
        buffer: new JumpBuffer(100),
        nowMs: 0,
        isOnGround: true,
        upwardVelocityPxPerSec: 0,
      });
      expect(action.moveDirection).toBe(0);
    });
  });

  describe("jump on press", () => {
    it("fires a fresh jump when grounded + jump pressed", () => {
      const input = { ...noInput(), jumpPressed: true, jumpHeld: true };
      const buffer = new JumpBuffer(100);
      const action = resolveHeroFrameAction({
        input,
        coyote: coyoteIn("grounded"),
        buffer,
        nowMs: 1000,
        isOnGround: true,
        upwardVelocityPxPerSec: 0,
      });
      expect(action.jumpFired).toBe(true);
    });

    it("fires a jump inside the coyote window even when airborne", () => {
      const input = { ...noInput(), jumpPressed: true, jumpHeld: true };
      const action = resolveHeroFrameAction({
        input,
        coyote: coyoteIn("coyote"),
        buffer: new JumpBuffer(100),
        nowMs: 1000,
        isOnGround: false,
        upwardVelocityPxPerSec: 0,
      });
      expect(action.jumpFired).toBe(true);
    });

    it("does NOT fire a jump when airborne past the coyote window", () => {
      const input = { ...noInput(), jumpPressed: true, jumpHeld: true };
      const action = resolveHeroFrameAction({
        input,
        coyote: coyoteIn("airborne"),
        buffer: new JumpBuffer(100),
        nowMs: 1000,
        isOnGround: false,
        upwardVelocityPxPerSec: 0,
      });
      expect(action.jumpFired).toBe(false);
    });

    it("records the press into the jump buffer when grounded jump can't fire (e.g. ceiling head-bonk edge case)", () => {
      // We use airborne-past-coyote to model "jump press while we can't jump".
      // The press should be recorded into the buffer for landing.
      const input = { ...noInput(), jumpPressed: true, jumpHeld: true };
      const buffer = new JumpBuffer(100);
      resolveHeroFrameAction({
        input,
        coyote: coyoteIn("airborne"),
        buffer,
        nowMs: 1000,
        isOnGround: false,
        upwardVelocityPxPerSec: 0,
      });
      expect(buffer.hasBuffered(1000)).toBe(true);
    });
  });

  describe("jump on land (buffered)", () => {
    it("fires a buffered jump when a recent press meets a landing", () => {
      const buffer = new JumpBuffer(100);
      buffer.pressed(990); // 10ms ago, well inside the 100ms window
      const action = resolveHeroFrameAction({
        input: noInput(), // no fresh press this frame
        coyote: coyoteIn("grounded"),
        buffer,
        nowMs: 1000,
        isOnGround: true,
        upwardVelocityPxPerSec: 0,
      });
      expect(action.jumpFired).toBe(true);
    });

    it("does NOT fire a buffered jump if the press is too old", () => {
      const buffer = new JumpBuffer(100);
      buffer.pressed(800); // 200ms ago, outside the window
      const action = resolveHeroFrameAction({
        input: noInput(),
        coyote: coyoteIn("grounded"),
        buffer,
        nowMs: 1000,
        isOnGround: true,
        upwardVelocityPxPerSec: 0,
      });
      expect(action.jumpFired).toBe(false);
    });
  });

  describe("variable-height jump (release-cap)", () => {
    it("caps upward velocity on jump-release while rising", () => {
      const input = { ...noInput(), jumpPressed: false, jumpHeld: false };
      const action = resolveHeroFrameAction({
        input,
        coyote: coyoteIn("airborne"),
        buffer: new JumpBuffer(100),
        nowMs: 1000,
        isOnGround: false,
        upwardVelocityPxPerSec: -400, // rising fast
      });
      expect(action.applyJumpReleaseCap).toBe(true);
    });

    it("does NOT cap upward velocity when jump is still held", () => {
      const input = { ...noInput(), jumpHeld: true };
      const action = resolveHeroFrameAction({
        input,
        coyote: coyoteIn("airborne"),
        buffer: new JumpBuffer(100),
        nowMs: 1000,
        isOnGround: false,
        upwardVelocityPxPerSec: -400,
      });
      expect(action.applyJumpReleaseCap).toBe(false);
    });

    it("does NOT cap when falling (negative velocity sign check)", () => {
      const input = { ...noInput() }; // not held
      const action = resolveHeroFrameAction({
        input,
        coyote: coyoteIn("airborne"),
        buffer: new JumpBuffer(100),
        nowMs: 1000,
        isOnGround: false,
        upwardVelocityPxPerSec: 200, // already falling
      });
      expect(action.applyJumpReleaseCap).toBe(false);
    });
  });
});
