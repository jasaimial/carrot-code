/**
 * Game-over / level-complete scene. Stub for T012.
 *
 * Real implementation (T036) supports two modes via `init(data)`:
 *   - "complete": shows "Level complete" + Play again
 *   - "gameover": shows "Game over"   + Play again
 *
 * Either way the Play-again button restarts LevelScene with the same
 * `levelId`. Spec FR-024 / FR-025 / Story 1 acceptance #4.
 */

import Phaser from "phaser";

/** Stub game-over scene — replaced in T036. */
export class GameOverScene extends Phaser.Scene {
  public constructor() {
    super({ key: "GameOverScene" });
  }

  /** Phaser hook — render the placeholder text. */
  public create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "GameOverScene stub\n(end-of-run UI lands in T036)", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#fdf6e3",
        align: "center",
      })
      .setOrigin(0.5);
  }
}
