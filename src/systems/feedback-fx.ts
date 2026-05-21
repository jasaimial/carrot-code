// -----------------------------------------------------------------------------
// carrot-code — Feedback FX (particle bursts + pickup flashes)
//
// Demo-sprint juice layer per docs/art-direction.md (two-effects-max
// budget). All effects are short-lived (≤ 500ms) and self-destruct
// so the scene's display list doesn't accumulate emitters.
//
// Currently exports:
//   - playCarrotBurst(scene, x, y)   → orange particle burst on collect.
//   - playPowerupPickupFx(scene, hero) → gold scale-pulse on the hero.
//
// Both are pure side-effect on a Phaser scene; no state, no return.
//
// See:
//   docs/art-direction.md            — two-effects-max budget
//   src/scenes/LevelScene.ts         — caller (carrot + powerup overlap)
//   .specify/memory/constitution.md  — Principle III (palette tokens)
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { PALETTE } from "../config/palette.js";

/** Spritesheet key for the icons-as-particle-source (also used by HUD). */
const ICONS_KEY = "icons-pixel-platformer-tiles";
/** Frame index for the carrot glyph on the icons sheet. Mirrors UIScene. */
const CARROT_FRAME = 67;

/**
 * Brief carrot-burst at a collect point. Emits ~6 carrot-sprite
 * particles with mostly-upward velocity, gravity-pulled, fading and
 * shrinking over their lifespan.
 *
 * Self-destructs ~600ms after emission so the scene's display list
 * doesn't accumulate emitters across a long play session.
 *
 * @param scene - The scene to spawn the burst in.
 * @param x - World-space x of the collect point.
 * @param y - World-space y of the collect point.
 */
export function playCarrotBurst(scene: Phaser.Scene, x: number, y: number): void {
  // Texture cache may be missing the key in test/headless runs. Bail
  // silently rather than throw — FX is non-essential.
  if (!scene.textures.exists(ICONS_KEY)) {
    return;
  }
  const emitter = scene.add.particles(x, y, ICONS_KEY, {
    frame: CARROT_FRAME,
    // Speed range tuned by eye on a 960x540 canvas. T060 retune candidate.
    speed: { min: 70, max: 160 },
    // Mostly upward + outward; 200..340 covers the upper hemisphere.
    angle: { min: 200, max: 340 },
    lifespan: 500,
    scale: { start: 0.6, end: 0.1 },
    alpha: { start: 1, end: 0 },
    // Gentle gravity so the particles arc back down naturally.
    gravityY: 240,
    rotate: { min: -90, max: 90 },
    quantity: 6,
    // Emit once (manual `.explode` below); the emitter doesn't auto-fire.
    emitting: false,
  });
  emitter.setDepth(500);
  emitter.explode(6);

  // Auto-cleanup so the scene's display list doesn't accumulate dead
  // emitters across a long session. 600 = lifespan + small buffer.
  scene.time.delayedCall(600, () => {
    emitter.destroy();
  });
}

/**
 * Powerup-pickup flash on the hero sprite: a brief scale-pulse plus
 * a gold tint flash. Distinguishes the "moment of pickup" from the
 * continuous gold tint the hero carries while powered.
 *
 * @param scene - The scene that owns the hero sprite (used for tween manager).
 * @param hero - The hero sprite to flash. Tween targets `scale`.
 */
export function playPowerupPickupFx(scene: Phaser.Scene, hero: Phaser.GameObjects.Sprite): void {
  // Scale pulse: 1.0 → 1.35 → 1.0 over 240ms, easeOut.
  scene.tweens.add({
    targets: hero,
    scale: { from: 1.0, to: 1.35 },
    duration: 120,
    yoyo: true,
    ease: "Sine.easeOut",
  });

  // Brief tint flash (cream) on top of the gold-powered tint, so the
  // pickup moment reads as a discrete spark. The hero applies its
  // own powered-tint after this fires; we just inject a one-frame
  // brighter flash on top using setTint (multi-arg form works under
  // both Phaser 3 and 4 type defs).
  hero.setTint(PALETTE.textCream);
  scene.time.delayedCall(80, () => {
    // Clear the tint; the hero's own update() will re-apply
    // the powered tint on the next frame.
    hero.clearTint();
  });
}
