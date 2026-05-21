// -----------------------------------------------------------------------------
// carrot-code — Hero input resolver (T033, pure-logic split)
//
// The decision function the hero entity runs each frame to translate
// (input + timers + ground state) → (move direction, jump fire,
// release-cap). Lives in its own module so unit tests can import it
// without pulling in Phaser (which needs a window/WebGL to load).
//
// The Phaser sprite class consumes this from `src/entities/hero.ts`.
//
// See:
//   src/entities/hero.ts            — the Phaser sprite wrapper
//   tests/unit/hero.test.ts         — 12 resolver cases
//   .specify/memory/constitution.md — Principles VI + XI
// -----------------------------------------------------------------------------

import { HERO } from "../config/hero.js";
import type { CoyoteTimer } from "../systems/coyote-time.js";
import type { JumpBuffer } from "../systems/jump-buffer.js";

/**
 * The per-frame input snapshot the resolver consumes. Built from
 * keyboard state today; UIScene will inject touch-driven flags here
 * at T035 without changing the resolver.
 */
export interface HeroInput {
  /** Whether left direction is held this frame. */
  readonly left: boolean;
  /** Whether right direction is held this frame. */
  readonly right: boolean;
  /** Whether the jump button transitioned to pressed this frame. */
  readonly jumpPressed: boolean;
  /** Whether the jump button is currently held. */
  readonly jumpHeld: boolean;
}

/**
 * Everything the resolver needs to decide this frame's action. All
 * fields are inputs — the resolver does not mutate them (CoyoteTimer
 * and JumpBuffer are mutated as a side-effect because they are
 * stateful by design, but no other state is changed).
 */
export interface HeroFrameContext {
  /** Input flags for this frame. */
  readonly input: HeroInput;
  /** Coyote-time state machine (already updated for this frame). */
  readonly coyote: CoyoteTimer;
  /** Jump-press buffer. */
  readonly buffer: JumpBuffer;
  /** Current millisecond clock; `scene.time.now` in production. */
  readonly nowMs: number;
  /** Whether the hero's physics body is on the ground this frame. */
  readonly isOnGround: boolean;
  /** Hero's current vertical velocity. Negative = up in Phaser. */
  readonly upwardVelocityPxPerSec: number;
}

/**
 * The decisions the resolver yields for this frame. The Phaser sprite
 * wrapper translates these into Arcade-physics velocity changes.
 */
export interface HeroFrameAction {
  /** Direction: -1 left, 0 stop, +1 right. Both-held cancels to 0. */
  readonly moveDirection: -1 | 0 | 1;
  /** Whether a jump fires this frame (fresh or buffered). */
  readonly jumpFired: boolean;
  /**
   * Whether to cap the rising velocity at HERO.jumpReleaseVelocityCap.
   * True only when jump is released mid-rise (variable-height jump).
   */
  readonly applyJumpReleaseCap: boolean;
}

/**
 * Pure decision function for hero movement / jump.
 *
 * Side effects: mutates `buffer` (records a press, consumes on land).
 * Does NOT mutate `coyote` — that's updated in the scene per-frame
 * before this is called.
 *
 * @param ctx - Everything the resolver needs to decide.
 * @returns The frame's action descriptor.
 */
export function resolveHeroFrameAction(ctx: HeroFrameContext): HeroFrameAction {
  // --- Horizontal direction (both-held cancels) --------------------------
  let moveDirection: -1 | 0 | 1 = 0;
  if (ctx.input.left && !ctx.input.right) {
    moveDirection = -1;
  } else if (ctx.input.right && !ctx.input.left) {
    moveDirection = 1;
  }

  // --- Jump --------------------------------------------------------------
  // Two paths to a jump:
  //   1. Fresh press this frame + canJump (grounded OR inside coyote window).
  //   2. Already-buffered press meets a landing (ground contact this frame).
  let jumpFired = false;
  if (ctx.input.jumpPressed) {
    if (ctx.coyote.canJump()) {
      jumpFired = true;
    } else {
      // Can't jump now — buffer the press for landing.
      ctx.buffer.pressed(ctx.nowMs);
    }
  }
  if (!jumpFired && ctx.isOnGround) {
    // Touching ground this frame — consume a buffered press if any.
    if (ctx.buffer.consumeIfBuffered(ctx.nowMs)) {
      jumpFired = true;
    }
  }

  // --- Variable-height jump (release-cap while rising) -------------------
  // Cap upward velocity to HERO.jumpReleaseVelocityCap when the player
  // releases jump while still rising. "Rising" = velocity is more
  // negative (up) than the cap.
  const applyJumpReleaseCap =
    !ctx.input.jumpHeld && ctx.upwardVelocityPxPerSec < HERO.jumpReleaseVelocityCapPxPerSec;

  return { moveDirection, jumpFired, applyJumpReleaseCap };
}
