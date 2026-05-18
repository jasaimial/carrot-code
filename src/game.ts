/**
 * Phaser game bootstrap. Builds the game config and starts the scene graph.
 *
 * Per the project structure in
 *   specs/001-vertical-slice/plan.md#project-structure
 * scenes are registered here once and the LevelScene receives its level via
 * `scene.start("LevelScene", { levelId: "level-01" })`.
 *
 * Real scene implementations land in Phase 3 (T032-T036). Until then each
 * scene is the smallest possible stub so `npm run dev` opens a visible page.
 */

import Phaser from "phaser";

import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { LevelScene } from "./scenes/LevelScene";
import { UIScene } from "./scenes/UIScene";
import { GameOverScene } from "./scenes/GameOverScene";

/**
 * The complete list of scenes registered with the Phaser game, in boot order.
 * Adding a new scene means adding it here and to the array in `startGame`.
 */
const SCENES = [BootScene, MenuScene, LevelScene, UIScene, GameOverScene] as const;

/**
 * Mount and start the Phaser game inside the given DOM element.
 *
 * @param parent the DOM element the game canvas will attach to.
 * @returns the Phaser.Game instance (mostly for tests; production code does
 *   not need to interact with it directly).
 */
export function startGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,

    // Crisp pixel-art rendering. roundPixels avoids sub-pixel sprite jitter.
    pixelArt: true,
    roundPixels: true,
    antialias: false,

    // Internal resolution; scale.mode handles the actual screen size.
    width: 960,
    height: 540,
    backgroundColor: "#2d6a3e",

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    physics: {
      default: "arcade",
      arcade: {
        // Tuning constants land in src/config/physics.ts (T018).
        // Until then, use Phaser's defaults so the game can start.
        gravity: { x: 0, y: 0 },
        debug: import.meta.env.DEV,
      },
    },

    // FPS overlay in dev only (Constitution Principle X).
    fps: {
      forceSetTimeOut: false,
      target: 60,
    },

    // Scene order: Boot runs first, then transitions to Menu (which the
    // slice skips straight past to Level). UIScene runs in parallel above
    // the active gameplay scene.
    scene: [...SCENES],
  });
}
