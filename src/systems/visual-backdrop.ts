// -----------------------------------------------------------------------------
// carrot-code — Visual backdrop (parallax sky + hill silhouettes)
//
// Demo-sprint visual pass per docs/art-direction.md:
//   - Far layer: sky gradient (cyan → sage), scrollFactor 0, glued to camera.
//   - Mid layer: two hill silhouette polylines drawn with Graphics,
//     scrollFactor 0.4 and 0.6 for parallax depth.
//   - Near layer (the tilemap + entities) is rendered by LevelScene as
//     usual at the default scrollFactor 1.
//
// Procedural (no new assets, no license trail). Uses only existing
// palette tokens plus the two new `bgSkyTop` / `bgSkyHorizon` tokens
// added at the same time as this file.
//
// All Graphics objects are pinned at depth < 0 so they render behind
// every tilemap layer + sprite.
//
// See:
//   docs/art-direction.md            — rules this file follows
//   src/config/palette.ts            — palette tokens
//   .specify/memory/constitution.md  — Principle III (no hardcoded colors)
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { PALETTE } from "../config/palette.js";

/** Depth bucket so the backdrop sits behind every gameplay layer. */
const DEPTH_BACKDROP_SKY = -100;
const DEPTH_BACKDROP_HILLS_FAR = -90;
const DEPTH_BACKDROP_HILLS_NEAR = -80;

/** ScrollFactor of the far hill silhouette (almost still). */
const HILLS_FAR_SCROLL = 0.3;
/** ScrollFactor of the near hill silhouette (a bit more parallax). */
const HILLS_NEAR_SCROLL = 0.55;

/**
 * Install the parallax backdrop into a scene. Call once from
 * {@link LevelScene.create} BEFORE the tilemap renders so depth
 * ordering works without a re-sort.
 *
 * @param scene - The scene to install into.
 * @param worldWidth - The level's world width in pixels.
 * @param worldHeight - The level's world height in pixels.
 */
export function installBackdrop(
  scene: Phaser.Scene,
  worldWidth: number,
  worldHeight: number,
): void {
  installSkyGradient(scene);
  installHillSilhouette(
    scene,
    worldWidth,
    worldHeight,
    HILLS_FAR_SCROLL,
    PALETTE.bgSkyHorizon,
    0.85,
    0.62,
    0.08,
    DEPTH_BACKDROP_HILLS_FAR,
  );
  installHillSilhouette(
    scene,
    worldWidth,
    worldHeight,
    HILLS_NEAR_SCROLL,
    PALETTE.bgDialog,
    0.9,
    0.72,
    0.05,
    DEPTH_BACKDROP_HILLS_NEAR,
  );
}

/**
 * Draw the camera-locked sky gradient (cyan → sage). Uses a single
 * Graphics object with `fillGradientStyle` (top-color and bottom-color
 * differ → vertical gradient). scrollFactor 0 keeps it pinned to the
 * camera even as the player walks across the level.
 */
function installSkyGradient(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const g = scene.add.graphics();
  // Phaser fillGradientStyle takes (topLeft, topRight, bottomLeft,
  // bottomRight). Same top + same bottom → pure vertical gradient.
  g.fillGradientStyle(
    PALETTE.bgSkyTop,
    PALETTE.bgSkyTop,
    PALETTE.bgSkyHorizon,
    PALETTE.bgSkyHorizon,
    1,
  );
  g.fillRect(0, 0, width, height);
  g.setScrollFactor(0);
  g.setDepth(DEPTH_BACKDROP_SKY);
}

/**
 * Draw a single hill-silhouette polyline across the world width.
 *
 * The silhouette is a flat-fill polygon: starts at bottom-left, walks
 * across the top in soft sine-wave bumps, ends at bottom-right. Drawn
 * 1.5× world-wide and offset so the camera staying within world
 * bounds always sees fully-rendered hills regardless of scrollFactor.
 *
 * @param scene - The scene to draw into.
 * @param worldWidth - The level's world width in pixels.
 * @param worldHeight - The level's world height in pixels.
 * @param scrollFactor - Camera-parallax factor (0..1). Lower = farther.
 * @param fillColor - Phaser-numeric fill color from {@link PALETTE}.
 * @param baseHeightRatio - Where the hill baseline sits (0..1 of worldHeight).
 *   1.0 = bottom of world; 0.5 = middle.
 * @param peakHeightRatio - Where the hill peaks reach (0..1 of worldHeight).
 *   Must be < baseHeightRatio (smaller value = higher up).
 * @param peakVarianceRatio - Random vertical variance per bump (0..1).
 * @param depth - Render depth bucket.
 */
function installHillSilhouette(
  scene: Phaser.Scene,
  worldWidth: number,
  worldHeight: number,
  scrollFactor: number,
  fillColor: number,
  baseHeightRatio: number,
  peakHeightRatio: number,
  peakVarianceRatio: number,
  depth: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(fillColor, 1);

  // Draw 1.5× wider than the world, offset half-a-world to the left,
  // so the camera scroll (at the given scrollFactor) can never reveal
  // an edge — there's always silhouette behind/ahead of the camera.
  const drawWidth = worldWidth * 2;
  const startX = -worldWidth / 2;
  const baseY = worldHeight * baseHeightRatio;
  const peakY = worldHeight * peakHeightRatio;
  const peakVariancePx = worldHeight * peakVarianceRatio;

  // Step size determines bump frequency. Smaller = bumpier; larger =
  // smoother rolling hills. Tuned by eyeball; T060 retune candidate.
  const stepPx = 64;
  const points: { x: number; y: number }[] = [];
  points.push({ x: startX, y: worldHeight });
  // Deterministic pseudo-random so the silhouette doesn't reshape on
  // every reload (would feel jarring). Uses a simple hash; not seeded
  // for true reproducibility, but consistent within a session.
  let seed = 0x9e3779b9;
  for (let x = startX; x <= startX + drawWidth; x += stepPx) {
    // Mix the seed and use the top bits as a pseudo-uniform in [0, 1).
    seed = (seed * 1664525 + 1013904223) | 0;
    const noise = ((seed >>> 8) & 0xffff) / 0xffff;
    const y = peakY + noise * peakVariancePx + (baseY - peakY) * 0.0;
    points.push({ x, y });
  }
  points.push({ x: startX + drawWidth, y: worldHeight });

  g.beginPath();
  g.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i];
    if (p === undefined) {
      continue;
    }
    g.lineTo(p.x, p.y);
  }
  g.closePath();
  g.fillPath();

  g.setScrollFactor(scrollFactor);
  g.setDepth(depth);
}
