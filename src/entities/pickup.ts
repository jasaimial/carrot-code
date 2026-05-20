// -----------------------------------------------------------------------------
// carrot-code — Pickup entities (T040 partial: carrot only; powerup
// follows in a separate commit alongside Hero.applyPowerup wiring).
//
// A "pickup" is a static, non-physics-driven sprite that fires a
// callback when the hero overlaps it, then destroys itself. The
// owning scene (LevelScene) registers the overlap; the pickup itself
// doesn't know about the hero.
//
// Per Principle IV, we use ONE factory that dispatches on
// `config.kind` rather than a class hierarchy. For v0 only the
// "carrot" branch is implemented; "powerup" throws so a forgotten
// wiring fails loudly rather than silently.
//
// See:
//   src/types/entity-config.ts        — CarrotConfig + PowerupConfig
//   src/scenes/LevelScene.ts          — wires overlaps
//   .specify/memory/constitution.md   — Principles III + IV + XI
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import type { CarrotConfig, PowerupConfig } from "../types/entity-config.js";

/**
 * Default spritesheet frame for the carrot pickup. Picked from the
 * Pixel Platformer tileset (`icons-pixel-platformer-tiles` asset
 * key, 18×18 packed 20-per-row). Tile index 67 is in the "items"
 * area — orange/red coloured. Swap by editing this number; the
 * tile inspector in Tiled can show the exact index of any tile.
 *
 * If this number renders the wrong tile in-game, eyeball the
 * tilemap_packed.png in the repo and update — single line change.
 */
const CARROT_FRAME = 67;

/**
 * Build a pickup sprite from its EntityConfig. Returns the sprite +
 * an `onCollect` callback for the caller (LevelScene) to invoke on
 * overlap.
 *
 * @param scene  - The owning scene.
 * @param x      - Spawn x in world coordinates.
 * @param y      - Spawn y in world coordinates.
 * @param config - Parsed CarrotConfig or PowerupConfig from level-loader.
 * @returns The pickup sprite + a callback to fire on hero contact.
 */
export function createPickup(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: CarrotConfig | PowerupConfig,
): {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly onCollect: () => void;
} {
  if (config.kind === "powerup") {
    // Powerup wiring lands in the next commit alongside Hero.applyPowerup.
    // Throwing here keeps level-01 from silently shipping with a non-
    // functional powerup if one is authored before the wiring exists.
    throw new Error(
      `createPickup: powerup (\`${config.id}\`) not yet wired in v0. ` +
        "Remove the powerup from level-01.tmj or wait for the next commit.",
    );
  }

  // --- Carrot branch ----------------------------------------------------
  const sprite = scene.physics.add.sprite(x, y, config.spriteKey, CARROT_FRAME);
  // Static body — carrots don't fall, don't get pushed. Disable gravity
  // for this body specifically (the world gravity still applies to the
  // hero and enemies).
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setImmovable(true);
  body.setSize(14, 14).setOffset(2, 2);

  const onCollect = (): void => {
    sprite.destroy();
  };

  return { sprite, onCollect };
}
