// -----------------------------------------------------------------------------
// carrot-code — Hero entity (T033)
//
// A Phaser Arcade-Physics sprite wired to the existing pure-logic
// systems CoyoteTimer (T024) + JumpBuffer (T025). Movement, jump,
// variable-height jump, coyote-time, and jump-buffer are all driven by
// the resolver function below — which is pure, tested in
// tests/unit/hero.test.ts (12 cases), and free of Phaser dependencies.
//
// Why split resolver from sprite:
//   - The decisions (direction, fire jump, cap rising velocity) are
//     business logic that must be unit-testable per Principle VI.
//   - Phaser sprite plumbing (physics body, sprite frame, scene timers)
//     is integration glue that's verified by manual playtest (T037).
//
// Input model: WASD or arrow keys (left/right + jump). Space also
// jumps. Touch input lands in T035 (UIScene injects pointer-driven
// flags into a shared input store; today the resolver only sees the
// keyboard flags built in update()).
//
// See:
//   src/systems/coyote-time.ts       — CoyoteTimer state machine
//   src/systems/jump-buffer.ts       — JumpBuffer
//   src/config/hero.ts               — every tuning knob
//   tests/unit/hero.test.ts          — 12 resolver cases
//   .specify/memory/constitution.md  — Principles III + VI + XI
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { HERO } from "../config/hero.js";
import { CoyoteTimer } from "../systems/coyote-time.js";
import { JumpBuffer } from "../systems/jump-buffer.js";

import { type HeroInput, resolveHeroFrameAction } from "./hero-input.js";

// Re-export the pure-logic types + resolver so the rest of the codebase
// can import everything hero-related from one place. Tests import
// directly from `./hero-input.js` to avoid pulling in Phaser.
export {
  type HeroFrameAction,
  type HeroFrameContext,
  type HeroInput,
  resolveHeroFrameAction,
} from "./hero-input.js";

/**
 * Phaser sprite wrapper that owns the hero's input handlers, coyote
 * timer, jump buffer, and per-frame physics updates.
 *
 * Lifecycle (caller responsibility, typically LevelScene):
 *   1. `const hero = new Hero(scene, x, y);`  (constructor adds itself
 *      to the scene + physics world)
 *   2. `scene.physics.add.collider(hero, terrainLayer);`
 *   3. Scene `update(time, delta)` calls `hero.update(delta)`.
 *
 * The hero inherits from `Phaser.Physics.Arcade.Sprite`, so callers
 * pass it directly to colliders / overlaps.
 */
export class Hero extends Phaser.Physics.Arcade.Sprite {
  /** Asset key the spritesheet was loaded under (BootScene T032). */
  public static readonly SPRITE_KEY = "hero-pixel-platformer-character-a";
  /** Which sprite-sheet frame is the v0 hero (see CREDITS.md). */
  public static readonly DEFAULT_FRAME = 0;

  private readonly coyote: CoyoteTimer;
  private readonly buffer: JumpBuffer;
  private readonly keys: {
    readonly left: Phaser.Input.Keyboard.Key;
    readonly right: Phaser.Input.Keyboard.Key;
    readonly a: Phaser.Input.Keyboard.Key;
    readonly d: Phaser.Input.Keyboard.Key;
    readonly up: Phaser.Input.Keyboard.Key;
    readonly w: Phaser.Input.Keyboard.Key;
    readonly space: Phaser.Input.Keyboard.Key;
  };

  /**
   * Construct the hero at the given world coordinates. The constructor
   * adds itself to the scene and physics world; the caller only needs
   * to set up colliders + call `update(delta)` each frame.
   *
   * @param scene - The owning scene (typically LevelScene).
   * @param x     - Spawn x in world coordinates.
   * @param y     - Spawn y in world coordinates.
   */
  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, Hero.SPRITE_KEY, Hero.DEFAULT_FRAME);

    this.coyote = new CoyoteTimer(HERO.coyoteTimeMs);
    this.buffer = new JumpBuffer(HERO.jumpBufferMs);

    // Register on the scene + enable Arcade physics so the body exists
    // before the first collider call from the caller.
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Tighten the physics body to roughly the character silhouette
    // (Kenney cells are 24x24 but the character occupies the middle
    // ~16x22). Keeps collision tight against tile edges.
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(16, 22).setOffset(4, 2);
    body.setMaxVelocity(HERO.moveSpeedPxPerSec, 900);
    body.setCollideWorldBounds(true);

    // Keyboard plugin is available once the scene's input system has
    // booted (it has by the time create() runs).
    const kb = scene.input.keyboard;
    if (kb === null) {
      throw new Error(
        "Hero: scene.input.keyboard is null; this scene needs keyboard input enabled.",
      );
    }
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  /**
   * Per-frame update. Caller passes the Phaser delta from its
   * scene `update(time, delta)` hook.
   *
   * Order matters:
   *   1. Advance the coyote timer with current ground contact.
   *   2. Build an input snapshot.
   *   3. Run the pure resolver to get this frame's action.
   *   4. Apply the action to the physics body.
   *
   * @param dtMs - Milliseconds elapsed since the previous frame.
   */
  public override update(dtMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const isOnGround = body.blocked.down || body.touching.down;

    this.coyote.update(dtMs, isOnGround);

    const input: HeroInput = {
      left: this.keys.left.isDown || this.keys.a.isDown,
      right: this.keys.right.isDown || this.keys.d.isDown,
      jumpPressed:
        Phaser.Input.Keyboard.JustDown(this.keys.up) ||
        Phaser.Input.Keyboard.JustDown(this.keys.w) ||
        Phaser.Input.Keyboard.JustDown(this.keys.space),
      jumpHeld: this.keys.up.isDown || this.keys.w.isDown || this.keys.space.isDown,
    };

    const action = resolveHeroFrameAction({
      input,
      coyote: this.coyote,
      buffer: this.buffer,
      nowMs: this.scene.time.now,
      isOnGround,
      upwardVelocityPxPerSec: body.velocity.y,
    });

    // --- Apply horizontal movement ---------------------------------------
    if (action.moveDirection === 0) {
      body.setVelocityX(0);
    } else {
      body.setVelocityX(action.moveDirection * HERO.moveSpeedPxPerSec);
      this.setFlipX(action.moveDirection === -1);
    }

    // --- Apply jump ------------------------------------------------------
    if (action.jumpFired) {
      body.setVelocityY(HERO.jumpVelocityPxPerSec);
    }
    if (action.applyJumpReleaseCap) {
      body.setVelocityY(HERO.jumpReleaseVelocityCapPxPerSec);
    }
  }
}
