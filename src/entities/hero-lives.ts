// -----------------------------------------------------------------------------
// carrot-code — Hero lives + invulnerability state machine (T042 pure-logic)
//
// Tracks the hero's remaining lives and an invulnerability window
// applied after each hit. Pure: no Phaser, no DOM, no globals. The
// Phaser sprite owns an instance and queries it each frame.
//
// Lives are decremented exactly once per "hurt" event. Hits inside the
// invuln window are explicitly ignored — they don't shorten the window,
// don't drop a life, and don't reset the timer (the player isn't
// punished for getting hit *again* during the recovery flash).
//
// When lives reach zero, the state machine refuses further damage and
// reports gameOver = true. The caller (LevelScene) transitions to
// GameOverScene with the "gameover" outcome on the next frame.
//
// Tests: tests/unit/hero-lives.test.ts (10 cases).
//
// See:
//   src/config/hero.ts (HERO.startingLives, HERO.hitInvulnerabilityMs)
//   src/entities/hero.ts                 — Phaser sprite that owns this
//   .specify/memory/constitution.md      — Principles VI + XI
// -----------------------------------------------------------------------------

/** Outcome of a single takeHit() call. */
export type HitOutcome =
  /** Hit landed; a life was decremented but the hero is still alive. */
  | "hurt"
  /** Hit landed and reduced lives to 0; the hero is now game-over. */
  | "gameover"
  /** Hit was ignored (still inside invulnerability window, or already game-over). */
  | "ignored";

/**
 * Pure life-counter + invulnerability-timer for the hero.
 *
 * Time-driven: all queries take a "now" timestamp the caller supplies
 * (typically `scene.time.now`). The state machine never reads the
 * system clock so behaviour is fully deterministic.
 */
export class HeroLivesState {
  /** Remaining lives. Reaches 0 = game over. */
  private livesRemaining: number;
  /** Captured at construction so `reset()` knows what to restore to. */
  private readonly startingLives: number;
  /** Timestamp at which the current invulnerability window expires. */
  private invulnUntilMs = 0;

  /**
   * Build a fresh state.
   *
   * @param startingLives        - Initial life count. Must be > 0.
   * @param invulnerabilityMs    - Duration of the post-hit invulnerability window.
   *   Production callers pass `HERO.hitInvulnerabilityMs`; tests inject a fixed number.
   */
  public constructor(
    startingLives: number,
    private readonly invulnerabilityMs: number,
  ) {
    if (startingLives <= 0) {
      throw new Error(`HeroLivesState: startingLives must be > 0, got ${String(startingLives)}`);
    }
    this.startingLives = startingLives;
    this.livesRemaining = startingLives;
  }

  /** Lives remaining. */
  public get lives(): number {
    return this.livesRemaining;
  }

  /** Whether the hero has run out of lives. */
  public get isGameOver(): boolean {
    return this.livesRemaining <= 0;
  }

  /**
   * Whether the hero is in the post-hit invulnerability window. Used
   * by LevelScene to make the hero sprite blink and by the contact-
   * overlap handler to short-circuit before calling takeHit().
   *
   * @param nowMs - Current millisecond clock.
   * @returns `true` if the hero is currently invulnerable.
   */
  public isInvulnerable(nowMs: number): boolean {
    return nowMs < this.invulnUntilMs;
  }

  /**
   * Apply a hit. Either decrements lives (and starts an invuln window),
   * or returns `"ignored"` if the hero is already invulnerable or
   * already game-over.
   *
   * @param nowMs - Current millisecond clock.
   * @returns The outcome of this hit.
   */
  public takeHit(nowMs: number): HitOutcome {
    if (this.isGameOver) {
      return "ignored";
    }
    if (this.isInvulnerable(nowMs)) {
      return "ignored";
    }
    this.livesRemaining -= 1;
    this.invulnUntilMs = nowMs + this.invulnerabilityMs;
    return this.livesRemaining <= 0 ? "gameover" : "hurt";
  }

  /**
   * Reset to the starting state. Called when the player restarts the
   * level via the Play-again button. Production code path always
   * constructs fresh on level restart (cleanest), but `reset()` lets
   * the state machine be reused as a long-lived instance and keeps
   * the test path tidy.
   *
   * @param nowMs - Current millisecond clock (clears any pending invuln window).
   */
  public reset(nowMs: number): void {
    this.livesRemaining = this.startingLives;
    this.invulnUntilMs = nowMs;
  }
}
