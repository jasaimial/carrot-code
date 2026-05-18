/**
 * Asset preload scene. Stub for T012.
 *
 * Real implementation (T032) iterates AssetService.assets and calls the
 * appropriate Phaser loader for each, then transitions to LevelScene with
 * `{ levelId: "level-01" }`.
 */

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";

/** Stub boot scene — replaced in T032. */
export class BootScene extends Phaser.Scene {
  public constructor() {
    super({ key: "BootScene" });
  }

  /** Phaser hook — render the placeholder text. */
  public create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "BootScene stub\n(asset preload lands in T032)", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5);
  }
}
