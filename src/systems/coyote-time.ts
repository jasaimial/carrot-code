// -----------------------------------------------------------------------------
// carrot-code — coyote-time (T024)
//
// Pure state machine that grants the hero a brief grace window after
// walking off a ledge during which a jump still counts. Without it,
// a player who jumps one frame after leaving a platform feels cheated;
// with it, the game forgives the off-by-one-frame and "feels right".
//
// Spec assumption (Constitution Principle VI playtest sign-off):
// ~100ms feels natural without feeling cheaty. The threshold is
// injected via the constructor (typically `HERO.coyoteTimeMs` from
// src/config/hero.ts) so tests can use a friendlier number and so
// the polish phase can re-tune without code changes.
//
// Tests: tests/unit/coyote-time.test.ts (8 cases).
//
// See:
//   src/config/hero.ts (HERO.coyoteTimeMs)
//   .specify/memory/constitution.md  — Principles III + VI
// -----------------------------------------------------------------------------

/** Discrete state of the coyote-time state machine. */
export type CoyoteState = "grounded" | "coyote" | "airborne";

/**
 * Tracks ground contact and exposes a single boolean `canJump()` flag
 * the hero entity uses to decide whether a jump press is honored.
 * Frame-driven: call `update(dtMs, isOnGround)` once per Phaser update
 * tick with the millisecond delta and the current ground-contact flag.
 */
export class CoyoteTimer {
  private state: CoyoteState = "airborne";
  private coyoteElapsedMs = 0;

  /**
   * Build a coyote timer.
   *
   * @param windowMs - Maximum time after leaving the ground during
   *   which a jump still counts. Production callers pass
   *   `HERO.coyoteTimeMs`; tests inject a fixed number.
   */
  public constructor(private readonly windowMs: number) {}

  /**
   * Advance the state machine by one frame.
   *
   * @param dtMs       - Milliseconds elapsed since the previous call.
   *   Phaser passes the frame delta from its `update(time, delta)` hook.
   * @param isOnGround - Whether the hero's body is in contact with the
   *   ground this frame. Provided by the Arcade-physics body check in
   *   the hero entity.
   * @returns The state AFTER this frame's update.
   */
  public update(dtMs: number, isOnGround: boolean): CoyoteState {
    if (isOnGround) {
      this.state = "grounded";
      this.coyoteElapsedMs = 0;
      return this.state;
    }

    if (this.state === "grounded") {
      // First airborne frame after being grounded: open the coyote
      // window. Elapsed starts at 0 — the player has the full window
      // even if `dtMs` is large.
      this.state = "coyote";
      this.coyoteElapsedMs = 0;
      return this.state;
    }

    if (this.state === "coyote") {
      this.coyoteElapsedMs += dtMs;
      if (this.coyoteElapsedMs >= this.windowMs) {
        this.state = "airborne";
      }
      return this.state;
    }

    // Already airborne; no change until we touch ground again.
    return this.state;
  }

  /**
   * Read the current state without advancing the machine. Useful for
   * debug overlays and for tests that want to inspect after a sequence
   * of `update()` calls without consuming a frame.
   *
   * @returns The current state.
   */
  public getState(): CoyoteState {
    return this.state;
  }

  /**
   * Whether a jump press is currently honored. True while grounded or
   * inside the coyote window; false once the window expires.
   *
   * @returns `true` if the hero may jump this frame.
   */
  public canJump(): boolean {
    return this.state === "grounded" || this.state === "coyote";
  }
}
