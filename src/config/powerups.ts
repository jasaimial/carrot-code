// -----------------------------------------------------------------------------
// carrot-code — Power-up tuning
//
// In v0 the only effect is brief invincibility (spec FR-022 / FR-023).
// The `effect: "invincibility"` discriminant lives on PowerupConfig in
// the level file; the *duration* number lives here so design changes
// don't require re-exporting the level data.
//
// Per-level overrides: a PowerupConfig may carry its own `durationMs`,
// which wins over the default below. Use the override sparingly — the
// default is what playtesters will calibrate against.
//
// See:
//   specs/001-vertical-slice/spec.md    — FR-022, FR-023
//   .specify/memory/constitution.md     — Principle III
// -----------------------------------------------------------------------------

/**
 * Power-up tuning constants.
 *
 * `invincibilityDurationMs` is the default duration for an
 * `effect: "invincibility"` PowerupConfig. Per-level overrides on
 * `PowerupConfig.durationMs` take precedence.
 */
export const POWERUPS = {
  /** Default invincibility duration in milliseconds. */
  invincibilityDurationMs: 5000,
  /**
   * Re-grant behaviour when the hero picks up another invincibility
   * power-up while already powered: `"refresh"` resets the timer to the
   * full duration; `"extend"` adds to the remaining time; `"ignore"`
   * drops the pickup. Default `"refresh"` for the smoothest feel.
   */
  invincibilityStackMode: "refresh",
  /** Visual blink interval near the end of the invincibility window. */
  invincibilityBlinkIntervalMs: 100,
  /** Time before expiry at which the blink warning starts. */
  invincibilityBlinkWarnAtMs: 1500,
} as const;
