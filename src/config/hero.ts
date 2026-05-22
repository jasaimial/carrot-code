// -----------------------------------------------------------------------------
// carrot-code — Hero tuning
//
// Every numeric knob that determines how the hero feels to control.
// Spec assumptions baked in:
//   - variable-height jump (FR-003: cut upward velocity on jump-key release)
//   - coyote time ~100ms (spec assumption, Principle VI playtest sign-off)
//   - jump buffer ~100ms (spec assumption)
//   - 3 lives at level start (spec FR-019, can be re-tuned in playtest)
//
// Values below are starting points. T060 (polish) tunes them against the
// US1 playtest checklist (jump arc, coyote/buffer feel).
//
// See:
//   specs/001-vertical-slice/spec.md   — User Story 1 acceptance scenarios
//   .specify/memory/constitution.md    — Principles III + VI
// -----------------------------------------------------------------------------

/**
 * Hero tuning constants. Consumed by the hero entity factory (T033) and
 * the coyote-time / jump-buffer systems (T024 / T025).
 */
export const HERO = {
  // --- Movement ----------------------------------------------------------
  /** Horizontal walk / run speed in pixels per second. */
  moveSpeedPxPerSec: 180,
  /** Horizontal acceleration when input is held. */
  accelPxPerSec2: 900,

  // --- Jump --------------------------------------------------------------
  /** Initial upward velocity on jump press. Negative = up in Phaser. */
  jumpVelocityPxPerSec: -460,
  /**
   * Velocity floor applied when jump key is released mid-rise. Implements
   * variable-height jump (spec FR-003): a tap is short, a hold is tall.
   */
  jumpReleaseVelocityCapPxPerSec: -140,

  // --- Forgiveness windows (Principle VI playtest sign-off) -------------
  /**
   * Grace window after walking off a ledge during which a jump still
   * counts. Spec assumption: ~100ms feels natural without feeling cheaty.
   */
  coyoteTimeMs: 100,
  /**
   * Window during which a jump press queued before landing is honored on
   * touchdown. Spec assumption: ~100ms.
   */
  jumpBufferMs: 100,

  // --- Lives / damage ----------------------------------------------------
  /** Starting life count (spec FR-019). */
  startingLives: 3,
  /** Invulnerability window after taking a hit, in milliseconds. */
  hitInvulnerabilityMs: 1000,
  /** Delay before respawning at the level spawn after a hit. */
  respawnDelayMs: 300,

  // --- Projectile / carrot-throw ----------------------------------------
  /**
   * Horizontal speed of a thrown carrot in pixels per second. Fast
   * enough to feel responsive, slow enough that the player can see
   * the carrot in flight (helps "I aimed wrong" reads as a skill
   * issue, not a glitch).
   */
  projectileSpeedPxPerSec: 360,
  /**
   * Initial upward velocity on the throw — negative is up in Phaser.
   * Combined with world gravity this gives the carrot a parabolic arc.
   * Tuned so a throw from ground level peaks roughly one tile-row
   * above the hero's head and lands ~10 tiles away.
   */
  projectileInitialUpwardVelocityPxPerSec: -220,
  /**
   * Max horizontal travel distance from spawn before the projectile
   * self-destructs (backstop in case it never hits terrain or an
   * enemy). ~16 tiles is plenty for clearing a typical platform.
   */
  projectileMaxDistancePx: 320,
  /**
   * Cooldown between throws in milliseconds. Prevents button-mash
   * spam emptying the carrot stockpile in one frame.
   */
  projectileCooldownMs: 250,
  /**
   * Vertical offset above hero center where the projectile spawns.
   * Negative is up. Spawning at hero.y center would have the
   * projectile's body overlap the floor tile under the hero on
   * frame 1, triggering its terrain-collide callback and destroying
   * the projectile before the player sees it. Lifting it ~half a
   * tile up keeps it clear of the floor on frame 1.
   */
  projectileSpawnYOffsetPx: -14,
} as const;
