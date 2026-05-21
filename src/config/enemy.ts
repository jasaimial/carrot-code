// -----------------------------------------------------------------------------
// carrot-code — Enemy tuning
//
// Per-enemy patrol values live on each EnemyConfig in the level file
// (data-driven per Principle IV). The constants here are GLOBAL defaults
// and timing knobs that apply to every enemy regardless of level data:
//   - default patrol speed when a level entry omits an explicit speed
//   - the visual hit-pause timing used by the hero on contact
//
// Avoidance-only behaviour in v0 (spec FR-014): no defeat logic, no
// stomp, no projectiles. Anything that adds an attack pattern belongs in
// a follow-up spec, not in this file.
//
// See:
//   specs/001-vertical-slice/spec.md    — FR-014, US2
//   .specify/memory/constitution.md     — Principles III + IV
// -----------------------------------------------------------------------------

/**
 * Global enemy tuning constants. Per-enemy patrol speed and bounds are
 * still defined on EnemyConfig in the level file; the values here are
 * the defaults / engine-wide timings.
 */
export const ENEMY = {
  /** Default patrol speed if the level entry omits an explicit value. */
  defaultPatrolSpeedPxPerSec: 60,
  /**
   * Brief horizontal knockback applied to the hero on contact.
   * Pure visual feedback; the actual life-loss logic lives in the hero.
   */
  contactKnockbackPxPerSec: 220,
  /** How long the knockback velocity is applied to the hero. */
  contactKnockbackMs: 120,
} as const;
