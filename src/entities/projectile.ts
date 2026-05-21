// -----------------------------------------------------------------------------
// carrot-code — Projectile entity (carrot-throw mechanic)
//
// A thrown carrot. Spawned by Hero.fire() and added to the LevelScene's
// projectile group. Travels horizontally with no gravity (it's a thrown
// carrot, not a thrown rock — the abstraction is "magic carrot shot"),
// collides with terrain (vanishes on impact), and overlaps with enemies
// (both destroyed). Self-destroys after max travel distance so the
// scene's display list doesn't accumulate dead projectiles.
//
// Design rationale (in-game):
//   - Each fire costs one carrot from the player's collected count.
//     This creates a risk/reward tension: do I save carrots for score,
//     or spend them on ammo to clear a tough enemy stretch?
//   - No gravity = predictable arc = forgiving for first-time players.
//   - Max travel distance = ~300px ≈ 16 tiles, plenty to clear an
//     enemy from a safe distance but not "shoot across the whole map".
//   - Visuals match the HUD carrot icon (same spritesheet + frame) so
//     the connection "I'm throwing a carrot" reads instantly.
//
// See:
//   src/entities/hero.ts          — Hero.fire() factory call
//   src/scenes/LevelScene.ts      — projectile group + overlap wiring
//   src/config/hero.ts            — projectile speed / max distance tuning
//   docs/art-direction.md         — palette + silhouette rules
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { HERO } from "../config/hero.js";

/** Asset key for the carrot projectile sprite (same as HUD carrot). */
const PROJECTILE_KEY = "icons-pixel-platformer-tiles";
/** Frame index on the icons sheet for the carrot glyph. */
const PROJECTILE_FRAME = 67;

/**
 * Thrown-carrot projectile. Constructor adds itself to scene + physics;
 * LevelScene is responsible for wiring colliders (terrain + enemy).
 */
export class Projectile extends Phaser.Physics.Arcade.Sprite {
  /** World-x where this projectile spawned; used for max-distance check. */
  private readonly spawnX: number;

  /**
   * Construct a projectile at the given coordinates, traveling in the
   * given direction (-1 left, +1 right).
   *
   * @param scene     - The owning scene.
   * @param x         - Spawn world-x (usually the hero's x).
   * @param y         - Spawn world-y (usually the hero's y or slightly above).
   * @param direction - +1 = travel right, -1 = travel left.
   */
  public constructor(scene: Phaser.Scene, x: number, y: number, direction: 1 | -1) {
    super(scene, x, y, PROJECTILE_KEY, PROJECTILE_FRAME);
    this.spawnX = x;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    // No gravity for the carrot-shot — clean horizontal line so the
    // player can aim from a safe distance.
    body.setAllowGravity(false);
    // Tight hitbox so the carrot has to actually touch the enemy.
    body.setSize(12, 12).setOffset(3, 3);
    // Flip the sprite horizontally when shooting left so the carrot
    // pointy end leads the direction of travel (visual polish).
    this.setFlipX(direction === -1);
    body.setVelocityX(direction * HERO.projectileSpeedPxPerSec);
  }

  /**
   * Per-frame update — destroys the projectile once it has traveled
   * its max distance from spawn. Called from LevelScene.update.
   */
  public override update(): void {
    if (!this.active) {
      return;
    }
    if (Math.abs(this.x - this.spawnX) >= HERO.projectileMaxDistancePx) {
      this.destroy();
    }
  }
}
