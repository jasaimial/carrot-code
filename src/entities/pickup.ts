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
 * Default tilesheet frame for the invincibility power-up pickup.
 * Picked from the items area of the tilemap (18×18 packed
 * 20-per-row on `icons-pixel-platformer-tiles`). Tile index 44 is
 * the heart shape; we re-use it as a visually-distinct pickup for
 * v0. Custom art replaces this later. Eyeballed; swap with a single
 * line if it renders the wrong tile.
 */
const POWERUP_FRAME = 44;

/**
 * Build a pickup sprite from its EntityConfig. Returns the sprite +
 * an `onCollect` callback for the caller (LevelScene) to invoke on
 * overlap. For carrots: caller increments the carrot count. For
 * powerups: caller invokes `hero.applyPowerup(config.durationMs)`.
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
  // Pick the sprite frame based on kind. Both kinds share the same
  // static-body setup (no gravity, immovable, slightly tighter hitbox).
  const frame = config.kind === "powerup" ? POWERUP_FRAME : CARROT_FRAME;
  const sprite = scene.physics.add.sprite(x, y, config.spriteKey, frame);
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setAllowGravity(false);
  body.setImmovable(true);
  body.setSize(14, 14).setOffset(2, 2);

  // Powerup sprite gets a small gold tint so it reads differently from
  // the orange carrot at a glance. Cleaner than re-coloring a tile.
  if (config.kind === "powerup") {
    sprite.setTint(0xfacc15);
  }

  const onCollect = (): void => {
    sprite.destroy();
  };

  return { sprite, onCollect };
}
