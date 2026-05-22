// -----------------------------------------------------------------------------
// carrot-code — Projectile entity (carrot-throw mechanic)
//
// A thrown carrot. Spawned by LevelScene.handleFirePoll when the player
// presses the throw button + has carrot ammo. Travels in a parabolic
// arc (initial upward toss + world gravity = grenade-style throw —
// reads as "I tossed a carrot" rather than "laser shot"). Hits enemies
// for mutual-destroy, lands on terrain harmlessly, self-destructs if
// it travels too far horizontally (max distance backstop).
//
// Design rationale (in-game):
//   - Each fire costs one carrot from the player's collected count.
//     Creates risk/reward tension: save carrots for score vs spend
//     them on ammo to clear a tough stretch.
//   - Gravity arc (not laser-straight) so the throw feels physical
//     and the player has to learn the arc. Differentiates from
//     generic shooter mechanics.
//   - Max travel distance = ~320px backstop so even if a thrown carrot
//     somehow flies off into the void it self-destructs.
//   - Visuals match the HUD carrot icon (same spritesheet + frame) so
//     the connection "I'm throwing a carrot" reads instantly.
//
// See:
//   src/scenes/LevelScene.ts      — spawn site + collider/overlap wiring
//   src/config/hero.ts            — speed / arc / max distance tuning
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
   * given direction (-1 left, +1 right). The caller (LevelScene) is
   * responsible for spawning it ABOVE the hero (not at hero.y center)
   * so frame-1 floor-tile overlap doesn't destroy it instantly.
   *
   * @param scene     - The owning scene.
   * @param x         - Spawn world-x.
   * @param y         - Spawn world-y.
   * @param direction - +1 = travel right, -1 = travel left.
   */
  public constructor(scene: Phaser.Scene, x: number, y: number, direction: 1 | -1) {
    super(scene, x, y, PROJECTILE_KEY, PROJECTILE_FRAME);
    this.spawnX = x;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    // Gravity ON — the throw is a parabolic arc (initial upward toss +
    // world gravity pulls it back down). Feels physical, asks the
    // player to learn the range, distinguishes from generic shooter
    // straight-line bullets.
    body.setAllowGravity(true);
    // Tight hitbox so the carrot has to actually touch the enemy.
    body.setSize(12, 12).setOffset(3, 3);
    // Bounce a little on terrain landing so the discarded carrot reads
    // as physical rather than vanishing instantly.
    body.setBounce(0.3, 0.4);
    body.setDragX(80);
    // Flip the sprite horizontally when shooting left so the carrot
    // pointy end leads the direction of travel (visual polish).
    this.setFlipX(direction === -1);
    body.setVelocityX(direction * HERO.projectileSpeedPxPerSec);
    body.setVelocityY(HERO.projectileInitialUpwardVelocityPxPerSec);
    // Slight spin while in flight — cosmetic, costs nothing.
    body.setAngularVelocity(direction * 360);
  }

  /**
   * Per-frame update — self-destruct once the projectile has traveled
   * its max horizontal distance from spawn (backstop). Called by
   * LevelScene.update.
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
