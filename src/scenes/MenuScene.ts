/**
 * Main menu scene. Stub for T012.
 *
 * The vertical slice skips MenuScene entirely (BootScene transitions
 * straight to LevelScene). This stub exists so game.ts can register a
 * scene with key "MenuScene" without breaking. A real implementation is
 * deferred until a future spec promotes it from stub status.
 */

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";

/** Stub menu scene — graduates from stub in a future spec. */
export class MenuScene extends Phaser.Scene {
  public constructor() {
    super({ key: "MenuScene" });
  }

  /** Phaser hook — render the placeholder text. */
  public create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "MenuScene stub\n(intentionally a stub for v0)", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5);
  }
}
