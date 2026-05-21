// -----------------------------------------------------------------------------
// carrot-code — jump-buffer (T025)
//
// Pure micro state machine that paired with coyote-time gives the
// hero's jump its 'feels right' quality:
//   - coyote-time forgives a jump pressed JUST AFTER leaving the ground.
//   - jump-buffer  forgives a jump pressed JUST BEFORE landing.
//
// Spec assumption (Principle VI playtest sign-off): ~100ms feels
// natural. The threshold is injected via the constructor (typically
// HERO.jumpBufferMs from src/config/hero.ts) so polish-phase re-tunes
// don't touch this file.
//
// Tests: tests/unit/jump-buffer.test.ts (8 cases).
//
// See:
//   src/config/hero.ts (HERO.jumpBufferMs)
//   .specify/memory/constitution.md  — Principles III + VI
// -----------------------------------------------------------------------------

/**
 * Remembers the timestamp of the most recent jump press. The hero
 * entity calls {@link pressed} on the jump input event and
 * {@link consumeIfBuffered} on the ground-contact transition; if a
 * press was recorded within the last `windowMs`, the jump fires
 * automatically on landing.
 *
 * "Now" is a millisecond clock the caller supplies (Phaser's
 * `scene.time.now` works; tests pass a fixed number). The class never
 * reads the system clock so behaviour is fully deterministic and
 * unit-testable.
 */
export class JumpBuffer {
  /**
   * Timestamp of the most recent press, or `null` if the buffer is
   * empty. Cleared by `consumeIfBuffered` whether the consume
   * succeeded or expired — no stale state.
   */
  private lastPressMs: number | null = null;

  /**
   * Build a jump buffer.
   *
   * @param windowMs - Maximum age of a press, in milliseconds, that
   *   `consumeIfBuffered` will still honor. Production callers pass
   *   `HERO.jumpBufferMs`; tests inject a fixed number.
   */
  public constructor(private readonly windowMs: number) {}

  /**
   * Record that the jump button was pressed at `nowMs`. Overwrites
   * any earlier press — only the most recent press matters.
   *
   * @param nowMs - Current time in milliseconds (any monotonic clock).
   */
  public pressed(nowMs: number): void {
    this.lastPressMs = nowMs;
  }

  /**
   * If a press is in the window at `nowMs`, return `true` and clear
   * the buffer. Otherwise return `false`. Expired presses are also
   * cleared (so the buffer never retains stale state).
   *
   * @param nowMs - Current time in milliseconds.
   * @returns `true` if a buffered jump fires; `false` otherwise.
   */
  public consumeIfBuffered(nowMs: number): boolean {
    if (this.lastPressMs === null) {
      return false;
    }
    const age = nowMs - this.lastPressMs;
    this.lastPressMs = null;
    return age <= this.windowMs;
  }

  /**
   * Peek at the buffer without consuming it. Useful for debug
   * overlays and for the hero entity if it wants to decide between
   * two jump strengths based on whether the player pressed early.
   *
   * @param nowMs - Current time in milliseconds.
   * @returns `true` if a press exists and is still in the window.
   */
  public hasBuffered(nowMs: number): boolean {
    if (this.lastPressMs === null) {
      return false;
    }
    return nowMs - this.lastPressMs <= this.windowMs;
  }
}
