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
import { POWERUPS } from "../config/powerups.js";
import { CoyoteTimer } from "../systems/coyote-time.js";
import { JumpBuffer } from "../systems/jump-buffer.js";
import { REGISTRY_KEY_SOUND_FX, type SoundFx } from "../systems/sound-fx.js";
import { REGISTRY_KEY_TOUCH_INPUT, TouchInputStore } from "../systems/touch-input-store.js";

import { HeroLivesState, type HitOutcome } from "./hero-lives.js";
import { HeroPowerupState } from "./hero-powerup.js";
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
export { type HitOutcome } from "./hero-lives.js";

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
  private readonly lives: HeroLivesState;
  private readonly powerup: HeroPowerupState;
  /**
   * Optional shared touch input. Present on touch devices when UIScene
   * has seeded the registry; `undefined` (or empty store) on desktop.
   * Either way the read is unconditional below.
   */
  private readonly touch: TouchInputStore | undefined;
  /**
   * Optional shared SoundFx. Present at boot when game.ts has seeded
   * the registry. Undefined only in tests / headless boot. Calls are
   * null-safe via the optional-chaining at the call site.
   */
  private readonly soundFx: SoundFx | undefined;
  private readonly keys: {
    readonly left: Phaser.Input.Keyboard.Key;
    readonly right: Phaser.Input.Keyboard.Key;
    readonly a: Phaser.Input.Keyboard.Key;
    readonly d: Phaser.Input.Keyboard.Key;
    readonly up: Phaser.Input.Keyboard.Key;
    readonly w: Phaser.Input.Keyboard.Key;
    readonly space: Phaser.Input.Keyboard.Key;
    readonly f: Phaser.Input.Keyboard.Key;
    readonly x: Phaser.Input.Keyboard.Key;
  };
  /**
   * Direction the hero is facing (+1 right, -1 left). Updated when
   * the player moves; defaults to +1 on spawn. Drives the direction
   * of thrown projectiles when the player fires while standing still.
   */
  private facingDirection: 1 | -1 = 1;
  /**
   * Timestamp of the last fired projectile, used to enforce the
   * projectile cooldown. Initialized to a value far enough in the past
   * that the first fire is allowed.
   */
  private lastFireTimeMs = -Infinity;
  /**
   * Reference count of overlapping water zones. Incremented by
   * enterWater(), decremented by leaveWater(). When > 0, horizontal
   * velocity is halved on update so movement feels slow.
   *
   * Why a counter and not a bool: Phaser's overlap callback can fire
   * MULTIPLE times per frame for overlapping zones with different
   * physics bodies. A bool would race; a counter is correct.
   */
  private inWaterCount = 0;

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
    this.lives = new HeroLivesState(HERO.startingLives, HERO.hitInvulnerabilityMs);
    this.powerup = new HeroPowerupState(POWERUPS.invincibilityStackMode);
    // Picked up from the scene registry (seeded by game.ts at postBoot).
    this.touch = scene.registry.get(REGISTRY_KEY_TOUCH_INPUT) as TouchInputStore | undefined;
    this.soundFx = scene.registry.get(REGISTRY_KEY_SOUND_FX) as SoundFx | undefined;

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
      f: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      x: kb.addKey(Phaser.Input.Keyboard.KeyCodes.X),
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
      left: this.keys.left.isDown || this.keys.a.isDown || (this.touch?.left ?? false),
      right: this.keys.right.isDown || this.keys.d.isDown || (this.touch?.right ?? false),
      jumpPressed:
        Phaser.Input.Keyboard.JustDown(this.keys.up) ||
        Phaser.Input.Keyboard.JustDown(this.keys.w) ||
        Phaser.Input.Keyboard.JustDown(this.keys.space) ||
        (this.touch?.consumeJumpPressed() ?? false),
      jumpHeld:
        this.keys.up.isDown ||
        this.keys.w.isDown ||
        this.keys.space.isDown ||
        (this.touch?.jumpHeld ?? false),
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
      // Water halves horizontal speed. Conservation of intent: input
      // still maps to direction, just at reduced effect.
      const speedMul = this.inWaterCount > 0 ? 0.5 : 1;
      body.setVelocityX(action.moveDirection * HERO.moveSpeedPxPerSec * speedMul);
      // Sprite-flip convention: the Kenney pixel-platformer character
      // sheet's default frame faces LEFT. To make the sprite face the
      // direction of travel, we flip when moving RIGHT (which mirrors
      // the left-facing default into a right-facing pose), and leave
      // unflipped when moving LEFT (default already faces left).
      //
      // Cohort playtest 2026-05-22 caught the old reversed version:
      // the rabbit's eye appeared to look BACKWARDS relative to travel
      // direction. If a future asset swap brings in a right-facing
      // default sprite, invert this boolean.
      this.setFlipX(action.moveDirection === 1);
      this.facingDirection = action.moveDirection === -1 ? -1 : 1;
    }

    // --- Apply jump ------------------------------------------------------
    if (action.jumpFired) {
      body.setVelocityY(HERO.jumpVelocityPxPerSec);
      this.soundFx?.playJump();
    }
    if (action.applyJumpReleaseCap) {
      body.setVelocityY(HERO.jumpReleaseVelocityCapPxPerSec);
    }

    // --- Visual feedback ------------------------------------------------
    // Invulnerability (post-hit) alpha-cycles for damage feedback.
    // Powered (powerup) tints the sprite gold-ish so the player can
    // see "I'm currently immune". Both checks are cheap; the powerup
    // tint takes precedence over the invuln blink.
    const now = this.scene.time.now;
    if (this.powerup.isPowered(now)) {
      this.setAlpha(1);
      this.setTint(0xfacc15); // PALETTE.uiPowerup gold; matches HUD timer.
    } else if (this.lives.isInvulnerable(now)) {
      this.clearTint();
      this.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(now / 60)));
    } else {
      this.clearTint();
      this.setAlpha(1);
    }
  }

  /**
   * Apply a hit to the hero. Decrements lives unless inside the
   * invulnerability window. On a hurt, the hero is briefly knocked
   * back away from the contact source. On gameover, the caller
   * (LevelScene) is expected to transition to GameOverScene.
   *
   * @param contactX - World x of the contact source (e.g. enemy x).
   *   The hero is knocked horizontally AWAY from this point.
   * @returns The outcome (`"hurt"` / `"gameover"` / `"ignored"`).
   */
  public takeHit(contactX: number): HitOutcome {
    // Powered-up hero is immune. Don't decrement lives, don't knockback,
    // don't start the post-hit invuln window.
    if (this.powerup.isPowered(this.scene.time.now)) {
      return "ignored";
    }
    const outcome = this.lives.takeHit(this.scene.time.now);
    if (outcome === "hurt" || outcome === "gameover") {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const knockDir = this.x < contactX ? -1 : 1;
      body.setVelocityX(knockDir * 260);
      body.setVelocityY(-200);
    }
    return outcome;
  }

  /** Lives remaining. Used by the HUD. */
  public getLives(): number {
    return this.lives.lives;
  }

  /**
   * Apply an invincibility power-up. Resets / extends / ignores the
   * timer depending on POWERUPS.invincibilityStackMode (set at
   * construction).
   *
   * @param durationMs - Duration of the power-up.
   */
  public applyPowerup(durationMs: number): void {
    this.powerup.applyPowerup(this.scene.time.now, durationMs);
  }

  /** Whether the hero is currently in an invincibility window. */
  public isPowered(): boolean {
    return this.powerup.isPowered(this.scene.time.now);
  }

  /** Remaining ms on the powerup timer (0 if not powered). HUD reads this. */
  public getPowerupRemainingMs(): number {
    return this.powerup.remainingMs(this.scene.time.now);
  }

  /**
   * Tell the hero it just entered a water zone. Refcounted so
   * overlapping multiple water rects in the same frame doesn't
   * corrupt the in-water state. Called from LevelScene's water
   * overlap callback.
   */
  public enterWater(): void {
    this.inWaterCount += 1;
  }

  /**
   * Tell the hero it just exited a water zone. Refcount safe.
   * Called from a Phaser per-frame check in LevelScene (NOT from
   * a Phaser "overlap end" callback - that doesn't exist; we have
   * to detect water exit by polling each frame).
   */
  public leaveWater(): void {
    if (this.inWaterCount > 0) {
      this.inWaterCount -= 1;
    }
  }

  /** Whether the hero is currently inside one or more water zones. */
  public isInWater(): boolean {
    return this.inWaterCount > 0;
  }

  /**
   * Direction the hero is currently facing (+1 right, -1 left).
   * LevelScene reads this to aim a fired projectile.
   */
  public getFacingDirection(): 1 | -1 {
    return this.facingDirection;
  }

  /**
   * Check + consume a fresh "fire" input request from this frame.
   *
   * Reads:
   *   - Keyboard F or X (JustDown semantics).
   *   - Touch throw button (consumeThrowPressed one-shot).
   *
   * Then applies the projectile cooldown: returns false if the last
   * fire was within HERO.projectileCooldownMs even if the input
   * fired. Cooldown advances `lastFireTimeMs` only on actual fire,
   * so cooldown-blocked taps don't extend the window further.
   *
   * Ammo (carrot count) check is the CALLER's responsibility - this
   * method only resolves the input gesture. LevelScene checks whether
   * a carrot is available before actually spawning the projectile.
   *
   * @returns `true` if a fresh fire request is pending AND cooldown allows.
   */
  public consumeFireRequest(): boolean {
    const fired =
      Phaser.Input.Keyboard.JustDown(this.keys.f) ||
      Phaser.Input.Keyboard.JustDown(this.keys.x) ||
      (this.touch?.consumeThrowPressed() ?? false);
    if (!fired) {
      return false;
    }
    const now = this.scene.time.now;
    if (now - this.lastFireTimeMs < HERO.projectileCooldownMs) {
      return false;
    }
    this.lastFireTimeMs = now;
    return true;
  }
}
