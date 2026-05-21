// -----------------------------------------------------------------------------
// carrot-code — Enemy entity (T039)
//
// Phaser Arcade-physics sprite that patrols along a 1D axis between
// two world-coordinate bounds. The patrol direction-flip logic is
// delegated to `nextPatrolDirection` from `src/systems/physics-helpers.ts`
// (which has 18 unit tests covering boundary + already-flipped edge
// cases). This file is integration glue: read EnemyConfig, build the
// sprite, drive the body each frame from the helper's decision.
//
// Avoidance-only (Spec FR-014): no defeat logic, no head-stomp. Contact
// with the hero triggers `Hero.takeHit()` which lives in the hero
// (LevelScene wires the overlap; the enemy doesn't know about the hero).
//
// See:
//   src/systems/physics-helpers.ts   — nextPatrolDirection (pure + tested)
//   src/types/entity-config.ts       — EnemyConfig shape
//   src/config/enemy.ts              — default tuning
//   src/scenes/LevelScene.ts         — instantiates + wires overlap
//   .specify/memory/constitution.md  — Principles III + IV + XI
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { ENEMY } from "../config/enemy.js";
import {
  nextPatrolDirection,
  type PatrolDirection,
  type Range1,
} from "../systems/physics-helpers.js";
import type { EnemyConfig } from "../types/entity-config.js";

/**
 * A patrolling enemy. Constructor adds itself to the scene + physics
 * world. LevelScene is responsible for adding a collider against the
 * `terrain` layer and an overlap against the hero.
 *
 * Adding a new enemy variant later (jumping, projectile-throwing) is
 * a new subclass + a new `EntityConfig` `kind`; the level loader's
 * discriminated-union dispatch grows by one case.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  /** Default v0 spritesheet frame for the enemy (visually distinct from hero). */
  public static readonly DEFAULT_FRAME = 17;

  private readonly bounds: Range1;
  private readonly speedPxPerSec: number;
  private readonly axis: "horizontal" | "vertical";
  private direction: PatrolDirection = 1;

  /**
   * Construct an enemy from its level-data config at the given world
   * coordinates. Spawn position is provided by the LevelScene (read
   * from the Tiled object's x,y); patrol bounds come from the config.
   *
   * @param scene  - The owning scene.
   * @param x      - Spawn x in world coordinates.
   * @param y      - Spawn y in world coordinates.
   * @param config - Parsed EnemyConfig (from level-loader).
   */
  public constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    super(scene, x, y, config.spriteKey, Enemy.DEFAULT_FRAME);

    this.bounds = config.patrol.bounds;
    // Use the config's speed unless it's zero (treat zero as "use default").
    this.speedPxPerSec =
      config.patrol.speedPxPerSec !== 0
        ? config.patrol.speedPxPerSec
        : ENEMY.defaultPatrolSpeedPxPerSec;
    this.axis = config.patrol.axis;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    // Tighten the body to roughly the character silhouette inside the
    // 24×24 cell — matches the hero's body sizing for consistent feel.
    body.setSize(16, 22).setOffset(4, 2);
    // Enemies don't fall off the level edges; gravity still applies via
    // the world's default. World-bounds collide keeps them from leaving
    // the playable area if patrol bounds were authored sloppily.
    body.setCollideWorldBounds(true);

    // Set initial direction velocity. Direction +1 = toward `max`.
    this.applyVelocity();
  }

  /**
   * Per-frame update. Called by `LevelScene.update()`. Reads current
   * position along the patrol axis, asks the helper whether to flip,
   * applies the resulting velocity.
   *
   * @param _dtMs - Frame delta (unused — Arcade physics integrates
   *   velocity automatically; we only adjust the velocity sign).
   */
  public override update(_dtMs: number): void {
    const pos = this.axis === "horizontal" ? this.x : this.y;
    const newDir = nextPatrolDirection(pos, this.bounds, this.direction);
    if (newDir !== this.direction) {
      this.direction = newDir;
      this.applyVelocity();
      // Flip sprite to face new direction (horizontal only).
      if (this.axis === "horizontal") {
        this.setFlipX(this.direction === -1);
      }
    }
  }

  /** Push the current direction's velocity to the Arcade body. */
  private applyVelocity(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const v = this.direction * this.speedPxPerSec;
    if (this.axis === "horizontal") {
      body.setVelocityX(v);
      body.setVelocityY(0);
    } else {
      body.setVelocityX(0);
      body.setVelocityY(v);
    }
  }
}
