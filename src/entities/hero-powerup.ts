// -----------------------------------------------------------------------------
// carrot-code — Hero power-up state machine (T042 powerup branch)
//
// Pure: no Phaser, no DOM. Tracks a single active power-up timer
// (invincibility in v0) with three configurable stack modes for what
// happens when the player picks up another power-up while already
// powered:
//   - "refresh": reset the timer to the new duration (smoothest feel).
//   - "extend":  add the new duration to the remaining time.
//   - "ignore":  drop the new pickup entirely.
//
// The mode is fixed for the lifetime of the instance (production
// callers pass POWERUPS.invincibilityStackMode from src/config/powerups.ts).
//
// Tests: tests/unit/hero-powerup.test.ts (9 cases).
//
// See:
//   src/config/powerups.ts             — POWERUPS.invincibilityStackMode
//   src/entities/hero.ts               — Phaser sprite that owns this
//   .specify/memory/constitution.md    — Principles VI + XI
// -----------------------------------------------------------------------------

/** Stack behaviour when re-granting while already powered. */
export type PowerupStackMode = "refresh" | "extend" | "ignore";

/**
 * Pure timer that tracks whether the hero is currently invincible and
 * how much of the window remains.
 *
 * Time-driven: callers pass `nowMs` to every query. The state machine
 * never reads the system clock so behaviour is fully deterministic.
 */
export class HeroPowerupState {
  /** Timestamp at which the current window expires. 0 = not powered. */
  private expiresAtMs = 0;

  /**
   * Build a fresh state.
   *
   * @param stackMode - What happens when applyPowerup is called while
   *   already powered. Production callers pass
   *   `POWERUPS.invincibilityStackMode`; tests pass an explicit value.
   */
  public constructor(private readonly stackMode: PowerupStackMode) {}

  /**
   * Whether the hero is currently powered.
   *
   * @param nowMs - Current millisecond clock.
   * @returns `true` if the window is still open.
   */
  public isPowered(nowMs: number): boolean {
    return nowMs < this.expiresAtMs;
  }

  /**
   * How many milliseconds remain on the current window. Returns 0 when
   * not powered. Useful for the HUD timer.
   *
   * @param nowMs - Current millisecond clock.
   * @returns Remaining ms; `0` if not powered or already expired.
   */
  public remainingMs(nowMs: number): number {
    const remaining = this.expiresAtMs - nowMs;
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Apply a power-up. Behaviour when already powered depends on the
   * stack mode chosen at construction.
   *
   * @param nowMs      - Current millisecond clock.
   * @param durationMs - Duration of this power-up.
   */
  public applyPowerup(nowMs: number, durationMs: number): void {
    if (!this.isPowered(nowMs)) {
      // Fresh grant. All modes behave the same when not currently powered.
      this.expiresAtMs = nowMs + durationMs;
      return;
    }
    // Already powered — stack mode decides.
    switch (this.stackMode) {
      case "refresh":
        this.expiresAtMs = nowMs + durationMs;
        return;
      case "extend":
        this.expiresAtMs += durationMs;
        return;
      case "ignore":
        // Drop the pickup.
        return;
    }
  }
}
