// -----------------------------------------------------------------------------
// carrot-code — Visual backdrop (parallax sky + hill silhouettes + clouds)
//
// Theme-aware backdrop. Each level passes a BackdropTheme and gets a
// matching set of layers:
//
//   "daytime"  (level-01)
//     - Cyan-to-sage sky gradient
//     - Three layers of hill silhouettes (far / mid / near)
//     - Drift clouds (slow horizontal tween)
//
//   "twilight" (level-02)
//     - Indigo-to-violet sky gradient
//     - Three layers of hill silhouettes (purpler palette)
//     - Distant castle silhouette (rectangle towers + crenellations)
//     - Slow lavender drift clouds
//
// All Graphics objects are pinned at depth < 0 so they render behind
// every tilemap layer + sprite.
//
// Procedural (no new image assets). Constitution Principle III: all
// colors via PALETTE tokens.
//
// See:
//   docs/art-direction.md            — rules this file follows
//   src/config/palette.ts            — palette tokens
//   src/scenes/LevelScene.ts         — installBackdrop call site
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { PALETTE } from "../config/palette.js";

/** Depth buckets so the backdrop sits behind every gameplay layer. */
const DEPTH_BACKDROP_SKY = -100;
const DEPTH_BACKDROP_CLOUDS = -95;
const DEPTH_BACKDROP_CASTLE = -92;
const DEPTH_BACKDROP_HILLS_FAR = -90;
const DEPTH_BACKDROP_HILLS_MID = -85;
const DEPTH_BACKDROP_HILLS_NEAR = -80;

/** Per-theme color + layout parameters. */
interface ThemeColors {
  readonly skyTop: number;
  readonly skyBottom: number;
  readonly cloud: number;
  readonly hillsFar: number;
  readonly hillsMid: number;
  readonly hillsNear: number;
  /** Castle silhouette color; undefined = no castle layer. */
  readonly castle: number | undefined;
}

/** Supported backdrop themes. */
export type BackdropTheme = "daytime" | "twilight";

const THEMES: Readonly<Record<BackdropTheme, ThemeColors>> = Object.freeze({
  daytime: Object.freeze({
    skyTop: PALETTE.bgSkyTop,
    skyBottom: PALETTE.bgSkyHorizon,
    cloud: PALETTE.bgCloud,
    hillsFar: PALETTE.bgSkyHorizon,
    hillsMid: PALETTE.bgForest,
    hillsNear: PALETTE.bgDialog,
    castle: undefined,
  }),
  twilight: Object.freeze({
    skyTop: PALETTE.bgTwilightTop,
    skyBottom: PALETTE.bgTwilightHorizon,
    cloud: PALETTE.bgCloudTwilight,
    hillsFar: PALETTE.bgTwilightHorizon,
    hillsMid: PALETTE.bgCastleSilhouette,
    hillsNear: PALETTE.bgDialog,
    castle: PALETTE.bgCastleSilhouette,
  }),
});

/**
 * Install the parallax backdrop into a scene. Call once from
 * {@link LevelScene.create} BEFORE the tilemap renders so depth
 * ordering works without a re-sort.
 *
 * @param scene       - The scene to install into.
 * @param worldWidth  - The level's world width in pixels.
 * @param worldHeight - The level's world height in pixels.
 * @param theme       - Which color theme to use. Defaults to "daytime".
 */
export function installBackdrop(
  scene: Phaser.Scene,
  worldWidth: number,
  worldHeight: number,
  theme: BackdropTheme = "daytime",
): void {
  const colors = THEMES[theme];

  installSkyGradient(scene, colors);
  installDriftClouds(scene, colors);

  // Castle silhouette (twilight only) sits between sky and hills so
  // hills overlap its base for depth.
  if (colors.castle !== undefined) {
    installCastleSilhouette(scene, worldWidth, worldHeight, colors.castle);
  }

  // Three hill layers (was two; added a mid layer for denser depth).
  installHillSilhouette(scene, worldWidth, worldHeight, {
    scrollFactor: 0.22,
    fillColor: colors.hillsFar,
    baseHeightRatio: 0.92,
    peakHeightRatio: 0.58,
    peakVarianceRatio: 0.1,
    stepPx: 80,
    depth: DEPTH_BACKDROP_HILLS_FAR,
    seedOffset: 0,
  });
  installHillSilhouette(scene, worldWidth, worldHeight, {
    scrollFactor: 0.45,
    fillColor: colors.hillsMid,
    baseHeightRatio: 0.95,
    peakHeightRatio: 0.68,
    peakVarianceRatio: 0.07,
    stepPx: 64,
    depth: DEPTH_BACKDROP_HILLS_MID,
    seedOffset: 0x12345678,
  });
  installHillSilhouette(scene, worldWidth, worldHeight, {
    scrollFactor: 0.65,
    fillColor: colors.hillsNear,
    baseHeightRatio: 0.98,
    peakHeightRatio: 0.78,
    peakVarianceRatio: 0.05,
    stepPx: 48,
    depth: DEPTH_BACKDROP_HILLS_NEAR,
    seedOffset: 0x9abcdef0,
  });
}

/** Draw the camera-locked sky gradient. */
function installSkyGradient(scene: Phaser.Scene, colors: ThemeColors): void {
  const { width, height } = scene.scale;
  const g = scene.add.graphics();
  g.fillGradientStyle(colors.skyTop, colors.skyTop, colors.skyBottom, colors.skyBottom, 1);
  g.fillRect(0, 0, width, height);
  g.setScrollFactor(0);
  g.setDepth(DEPTH_BACKDROP_SKY);
}

/**
 * Drift clouds — 4 soft elliptical blobs that tween slowly horizontally
 * across the camera viewport. Camera-locked (scrollFactor 0) so they
 * don't shift with the world; the only motion is the tween.
 */
function installDriftClouds(scene: Phaser.Scene, colors: ThemeColors): void {
  const { width } = scene.scale;
  const cloudCount = 4;
  for (let i = 0; i < cloudCount; i += 1) {
    // Spread starting positions across the viewport width.
    const startX = (width / cloudCount) * i + (i % 2 === 0 ? 0 : width / cloudCount / 2);
    const y = 30 + i * 22;
    const w = 90 + (i % 2) * 30;
    const h = 18;

    const cloud = scene.add
      .ellipse(startX, y, w, h, colors.cloud, 0.6)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH_BACKDROP_CLOUDS);

    // Tween from start to right + width, then loop. Different durations
    // per cloud so they don't move in lockstep.
    const duration = 30_000 + i * 8000;
    scene.tweens.add({
      targets: cloud,
      x: width + w,
      duration,
      repeat: -1,
      onRepeat: () => {
        cloud.x = -w;
      },
      ease: "Linear",
    });
  }
}

/**
 * Distant castle silhouette: a rectangle with three notched towers.
 * Used in twilight theme to suggest the level-02 setting. Drawn as a
 * Graphics object centered ~70% from the left of the camera, at low
 * scrollFactor so it drifts slightly with the camera.
 */
function installCastleSilhouette(
  scene: Phaser.Scene,
  worldWidth: number,
  _worldHeight: number,
  fillColor: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(fillColor, 1);

  const { width, height } = scene.scale;
  // Center of castle on screen. Anchor in screen coords (scrollFactor
  // applies later so this becomes camera-relative).
  const baseY = height * 0.62;
  const cx = width * 0.72;

  // Main keep rectangle.
  const keepW = 110;
  const keepH = 70;
  g.fillRect(cx - keepW / 2, baseY - keepH, keepW, keepH);

  // Two flanking towers (taller, thinner).
  const towerW = 32;
  const towerH = 100;
  g.fillRect(cx - keepW / 2 - towerW - 4, baseY - towerH, towerW, towerH);
  g.fillRect(cx + keepW / 2 + 4, baseY - towerH, towerW, towerH);

  // Center spire (very thin, very tall).
  const spireW = 18;
  const spireH = 120;
  g.fillRect(cx - spireW / 2, baseY - spireH, spireW, spireH);

  // Crenellations on top of the keep (3 little teeth).
  const crenW = 14;
  const crenH = 10;
  for (let i = 0; i < 3; i += 1) {
    const x = cx - keepW / 2 + 16 + i * 36;
    g.fillRect(x, baseY - keepH - crenH, crenW, crenH);
  }

  g.setScrollFactor(0.15);
  g.setDepth(DEPTH_BACKDROP_CASTLE);
  // Wide enough that the slight parallax never reveals an edge.
  void worldWidth;
}

interface HillParams {
  readonly scrollFactor: number;
  readonly fillColor: number;
  readonly baseHeightRatio: number;
  readonly peakHeightRatio: number;
  readonly peakVarianceRatio: number;
  readonly stepPx: number;
  readonly depth: number;
  readonly seedOffset: number;
}

/** Draw a single hill-silhouette polyline across the world width. */
function installHillSilhouette(
  scene: Phaser.Scene,
  worldWidth: number,
  worldHeight: number,
  p: HillParams,
): void {
  const g = scene.add.graphics();
  g.fillStyle(p.fillColor, 1);

  // Draw 2× wider than the world so parallax can never reveal an edge.
  const drawWidth = worldWidth * 2;
  const startX = -worldWidth / 2;
  const baseY = worldHeight * p.baseHeightRatio;
  const peakY = worldHeight * p.peakHeightRatio;
  const peakVariancePx = worldHeight * p.peakVarianceRatio;

  const points: { x: number; y: number }[] = [];
  points.push({ x: startX, y: worldHeight });
  // Deterministic LCG so silhouettes stay stable across reloads.
  // seedOffset varies per layer so layers don't share the exact bumps.
  let seed = (0x9e3779b9 ^ p.seedOffset) | 0;
  for (let x = startX; x <= startX + drawWidth; x += p.stepPx) {
    seed = (seed * 1664525 + 1013904223) | 0;
    const noise = ((seed >>> 8) & 0xffff) / 0xffff;
    const y = peakY + noise * peakVariancePx + (baseY - peakY) * 0.0;
    points.push({ x, y });
  }
  points.push({ x: startX + drawWidth, y: worldHeight });

  g.beginPath();
  g.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0);
  for (let i = 1; i < points.length; i += 1) {
    const pt = points[i];
    if (pt === undefined) {
      continue;
    }
    g.lineTo(pt.x, pt.y);
  }
  g.closePath();
  g.fillPath();

  g.setScrollFactor(p.scrollFactor);
  g.setDepth(p.depth);
}
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
