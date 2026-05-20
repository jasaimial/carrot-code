/**
 * Phaser game bootstrap (T027). Builds the game config and starts the scene
 * graph.
 *
 * Per the project structure in
 *   specs/001-vertical-slice/plan.md#project-structure
 * scenes are registered here once and the LevelScene receives its level via
 * `scene.start("LevelScene", { levelId: "level-01" })`.
 *
 * Renderer is WebGL (T027 requirement). The DOM container is disabled
 * (`dom.createContainer: false`) because no scene uses Phaser's DOM-element
 * support in v0 - all UI is canvas-drawn for crisp pixel rendering.
 *
 * Dev-mode behaviour (gated on `import.meta.env.DEV`):
 *   - Arcade-physics debug draw is on (Phaser draws colliders).
 *   - `scene.registry.devMode` is `true`, which `attachFpsOverlay`
 *     reads to decide whether to render the FPS overlay (Principle X).
 *
 * Real scene implementations land in Phase 3 (T032-T036). Until then
 * each scene is the smallest possible stub so `npm run dev` opens a
 * visible page.
 */

import Phaser from "phaser";

import { PALETTE_HEX } from "./config/palette.js";
import { PHYSICS } from "./config/physics.js";
import { BootScene, REGISTRY_KEY_ASSET_SERVICE } from "./scenes/BootScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { LevelScene } from "./scenes/LevelScene";
import { MenuScene } from "./scenes/MenuScene";
import { UIScene } from "./scenes/UIScene";
import { KennyAssetService } from "./services/asset-service.js";
import { LocalStorageSaveService } from "./services/save-service.js";
import { REGISTRY_KEY_TOUCH_INPUT, TouchInputStore } from "./systems/touch-input-store.js";

/** Registry key the shared SaveService is mounted under. */
export const REGISTRY_KEY_SAVE_SERVICE = "saveService";

/**
 * The complete list of scenes registered with the Phaser game, in boot order.
 * Adding a new scene means adding it here.
 */
const SCENES = [BootScene, MenuScene, LevelScene, UIScene, GameOverScene] as const;

/**
 * Mount and start the Phaser game inside the given DOM element.
 *
 * @param parent - The DOM element the game canvas will attach to.
 * @returns The Phaser.Game instance (mostly for tests; production code does
 *   not need to interact with it directly).
 */
export function startGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    // T027: WebGL renderer (not AUTO). Pixel-art benefits from the
    // explicit WebGL pipeline + roundPixels combination.
    type: Phaser.WEBGL,
    parent,

    // Crisp pixel-art rendering. roundPixels avoids sub-pixel sprite jitter.
    pixelArt: true,
    roundPixels: true,
    antialias: false,

    // Internal resolution; scale.mode handles the actual screen size.
    width: 960,
    height: 540,
    backgroundColor: PALETTE_HEX.bgForest,

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    // No Phaser DOM-element container in v0 (all UI is canvas-drawn).
    dom: {
      createContainer: false,
    },

    physics: {
      default: "arcade",
      arcade: {
        // World gravity from src/config/physics.ts (Principle III).
        gravity: { x: 0, y: PHYSICS.gravityYPxPerSec2 },
        // Arcade-physics debug draw is on in dev only (Principle X).
        debug: import.meta.env.DEV,
      },
    },

    // Phaser game-loop tuning. The visual FPS overlay is rendered by
    // `attachFpsOverlay(scene)` from src/systems/debug-overlay.ts; this
    // block is only the loop config.
    fps: {
      forceSetTimeOut: false,
      target: 60,
    },

    callbacks: {
      /**
       * Runs once after Phaser has fully booted. Used to seed the
       * scene registry with shared singletons (Principle XI: services
       * live on the registry, not on globals) and global flags every
       * scene reads (`devMode`).
       *
       * @param game - The Phaser game instance.
       */
      postBoot: (game: Phaser.Game): void => {
        game.registry.set("devMode", import.meta.env.DEV);
        game.registry.set(REGISTRY_KEY_ASSET_SERVICE, new KennyAssetService());
        game.registry.set(REGISTRY_KEY_TOUCH_INPUT, new TouchInputStore());
        // SaveService is browser-only (needs window.localStorage). Guard
        // here so a future test-host that constructs the Phaser game
        // without localStorage doesn't crash at boot.
        try {
          game.registry.set(REGISTRY_KEY_SAVE_SERVICE, new LocalStorageSaveService());
        } catch (err) {
          console.warn(
            `game.ts postBoot: SaveService unavailable; progress will not persist (${String(err)})`,
          );
        }
      },
    },

    // Scene order: Boot runs first, then transitions to Menu (which the
    // slice skips straight past to Level). UIScene runs in parallel above
    // the active gameplay scene.
    scene: [...SCENES],
  });
}
