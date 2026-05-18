/**
 * Generic level renderer. Stub for T012.
 *
 * Real implementation (T034) takes `init(data: { levelId: string })`,
 * resolves it through the LevelRegistry + level-loader to produce
 * `LevelData`, builds the tilemap, places the hero, and registers
 * collision / overlap callbacks. NO entities yet beyond the hero — US2
 * adds them in T041.
 */

import Phaser from "phaser";

/** Stub level scene — replaced in T034. */
export class LevelScene extends Phaser.Scene {
  public constructor() {
    super({ key: "LevelScene" });
  }

  /** Phaser hook — render the placeholder text. */
  public create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "LevelScene stub\n(Tiled-driven level renderer lands in T034)", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#fdf6e3",
        align: "center",
      })
      .setOrigin(0.5);
  }
}
