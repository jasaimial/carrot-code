/**
 * HUD + narrator dialog + touch controls + dev FPS overlay. Stub for T012.
 *
 * Real implementation (T035 / T043 / T049) renders the HUD elements
 * (hearts, carrot count, power-up timer), the dismissable narrator dialog
 * box, and on-screen touch controls when `device.input.touch === true`.
 *
 * Runs in parallel ABOVE the active gameplay scene (LevelScene /
 * GameOverScene) so HUD survives scene transitions.
 */

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";

/** Stub UI scene — replaced incrementally across T035 / T043 / T049. */
export class UIScene extends Phaser.Scene {
  public constructor() {
    super({ key: "UIScene" });
  }

  /** Phaser hook — render the placeholder text. */
  public create(): void {
    // Position in the top-left so this doesn't fight other stubs visually.
    this.add.text(8, 8, "UIScene stub (HUD/touch/dialog lands later)", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: PALETTE_HEX.textCream,
    });
  }
}
