// -----------------------------------------------------------------------------
// carrot-code — Physics constants
//
// Global Arcade-Physics tuning. Per-entity tuning lives in the matching
// entity config (hero.ts, enemy.ts). Constitution Principle III: no magic
// numbers in gameplay code; every tuning knob lives here with a comment
// explaining what it does and how it feels when wrong.
//
// Values below are reasonable starting points for a 16-bit-feel
// platformer at ~640×360 internal resolution. They will be tuned in
// playtest (task T060). Change in this file, never inline.
//
// See:
//   specs/001-vertical-slice/plan.md#project-structure
//   .specify/memory/constitution.md   — Principle III
// -----------------------------------------------------------------------------

/**
 * Global physics tuning applied to Phaser's Arcade physics world.
 *
 * - Increase `gravityY` and the hero feels heavier and lands faster.
 * - Decrease and the hero floats; jumps over-shoot.
 * - `worldFrictionPxPerSec2` is applied by entities (not the world) as a
 *   horizontal damping when no input is pressed.
 */
export const PHYSICS = {
  /** Downward acceleration in pixels per second squared. */
  gravityYPxPerSec2: 1200,
  /** Cap on downward velocity so falls do not go through tiles. */
  maxFallSpeedPxPerSec: 900,
  /** Cap on horizontal speed for any entity (safety net; per-entity caps override). */
  maxHorizontalSpeedPxPerSec: 400,
  /** Horizontal damping applied when no input is pressed. */
  worldFrictionPxPerSec2: 1800,
} as const;
