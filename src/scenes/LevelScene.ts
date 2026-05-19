/**
 * Level renderer (partial T034 — tilemap-only milestone).
 *
 * This is the minimum-viable LevelScene that delivers the first visible
 * output of US1: the actual `level-01.tmj` rendered on screen with its
 * embedded Kenney tileset. It is NOT the full T034 implementation yet:
 *
 *   - No hero entity (T033 — wires coyote-time + jump-buffer to a sprite).
 *   - No entity dispatch (T041 for enemies, US2; T042 for collectibles).
 *   - No end-trigger overlap callback (T036-adjacent).
 *   - No narrator beats (T049).
 *
 * What it DOES do, so the player sees a meaningful first frame:
 *   - Build a Phaser tilemap from the cached JSON keyed by `levelId`.
 *   - Bind each tileset declared in the `.tmj` to the loaded image,
 *     looked up by `tilesetName` on `AssetService`. This is the
 *     mechanism that lets a single level reference multiple tile packs
 *     (e.g. base + future expansion) — see the Asset organization
 *     convention in `public/assets/CREDITS.md`.
 *   - Render every tile layer found in the map (currently just
 *     `terrain`).
 *   - Set world + camera bounds to the level size; center the camera on
 *     the spawn point so the player sees the start of the level.
 *   - Draw a small dev caption explaining what's missing.
 *
 * The full T034 will add: hero instantiation, physics collider between
 * hero and the `terrain` layer, end-trigger overlap, entity dispatch.
 *
 * Scene-data contract:
 *   - `{ levelId: LevelId }` — required; BootScene always passes one.
 *
 * See:
 *   src/services/level-loader.ts      — pure .tmj → LevelData translator
 *   src/data/levels/index.ts          — LevelRegistry
 *   src/services/asset-service.ts     — tileset image declarations
 *   .specify/memory/constitution.md   — Principles III + IV + XI
 */

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";
import { type LevelId } from "../data/levels/index.js";
import { t } from "../i18n/index.js";
import {
  type AssetDeclaration,
  type AssetService,
  type ImageAssetDeclaration,
} from "../services/asset-service.js";
import { loadLevel, LevelLoadError } from "../services/level-loader.js";
import type { LevelData } from "../types/level.js";

import { REGISTRY_KEY_ASSET_SERVICE } from "./BootScene.js";

/** What this scene expects in its `init(data)` call. */
interface LevelSceneData {
  /** Which level to render. BootScene always passes this. */
  readonly levelId: LevelId;
}

/**
 * Generous per-level asset budget for v0. Tightened in the polish phase
 * (T060) once real budgets are measured against playtest data.
 */
const V0_ASSET_BUDGET_BYTES = 200_000;

/** Renders a level from its preloaded tilemap JSON + tileset images. */
export class LevelScene extends Phaser.Scene {
  private levelId: LevelId = "level-01";

  public constructor() {
    super({ key: "LevelScene" });
  }

  /** Phaser hook — record which level to render. */
  public init(data: LevelSceneData): void {
    this.levelId = data.levelId;
  }

  /** Phaser hook — build the tilemap and configure the camera. */
  public create(): void {
    // Phaser's tilemap cache returns an untyped `any`; the wrapped
    // entry carries the parsed JSON on `.data`. Narrow once here so
    // the rest of the scene works with `object`.
    const cached = this.cache.tilemap.get(this.levelId) as { data?: object } | undefined;
    const tiledJson = cached?.data;
    if (tiledJson === undefined) {
      throw new Error(
        `LevelScene: tilemap "${this.levelId}" not found in Phaser cache; ` +
          "BootScene should have preloaded it before transitioning.",
      );
    }

    // Parse the .tmj into typed LevelData. Throws LevelLoadError on
    // any contract violation; we let it propagate so the failure is
    // visible in dev console rather than masked by a half-built scene.
    let level: LevelData;
    try {
      level = loadLevel(tiledJson, this.levelId, this.levelId, V0_ASSET_BUDGET_BYTES);
    } catch (err) {
      if (err instanceof LevelLoadError) {
        // Re-throw with extra context so the dev console makes it clear
        // which level the loader rejected.
        throw new Error(`LevelScene: failed to load "${this.levelId}": ${err.message}`, {
          cause: err,
        });
      }
      throw err;
    }

    const map = this.buildTilemap();
    this.renderTileLayers(map);
    this.configureCamera(map, level);
    this.drawDevCaption();
  }

  /** Build the Phaser tilemap and bind every embedded tileset to its image. */
  private buildTilemap(): Phaser.Tilemaps.Tilemap {
    const map = this.make.tilemap({ key: this.levelId });
    const assetService = this.requireAssetService();

    // For each tileset declared in the .tmj, find the matching
    // ImageAssetDeclaration on AssetService (by `tilesetName`) and
    // bind it via `addTilesetImage`. Looping (rather than hardcoding
    // a single tileset) supports multi-tileset levels — e.g. mixing
    // Pixel Platformer + Industrial Expansion in one map.
    for (const ts of map.tilesets) {
      const decl = this.findTilesetDeclaration(assetService, ts.name);
      const bound = map.addTilesetImage(ts.name, decl.key);
      if (bound === null) {
        throw new Error(
          `LevelScene: failed to bind tileset "${ts.name}" (asset key "${decl.key}"). ` +
            "Check that the image is loaded in BootScene and that the tileset's name " +
            "in the .tmj matches the AssetDeclaration's tilesetName.",
        );
      }
    }
    return map;
  }

  /**
   * Create a Phaser display layer for every tile layer in the map.
   * For v0 there is only `terrain`; future layers (decoration,
   * foreground) will land here too.
   */
  private renderTileLayers(map: Phaser.Tilemaps.Tilemap): void {
    const allTilesets = map.tilesets;
    for (const layerData of map.layers) {
      // `createLayer` is typed non-nullable by Phaser but in practice
      // returns null on bad input; we have no way for that to happen
      // here (tilesets bound above, layer iterated from map.layers).
      map.createLayer(layerData.name, allTilesets, 0, 0);
    }
  }

  /**
   * Set the world + camera bounds to the level size and center the
   * camera on the hero spawn point. When the hero entity lands (T033)
   * the camera will switch to follow-mode.
   */
  private configureCamera(map: Phaser.Tilemaps.Tilemap, level: LevelData): void {
    const worldWidth = map.widthInPixels;
    const worldHeight = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.centerOn(level.spawn.x, level.spawn.y);
  }

  /**
   * Small dev caption explaining the missing pieces. Drawn in screen
   * (camera-ignored) space so it stays put as the camera scrolls.
   * Removed when T033 ships and replaced by HUD in T035.
   */
  private drawDevCaption(): void {
    const caption = this.add
      .text(this.scale.width / 2, 24, t("dev.levelLoaded"), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: PALETTE_HEX.textCream,
        align: "center",
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 8, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    caption.setDepth(1000);
  }

  /** Retrieve the AssetService BootScene seeded onto the registry. */
  private requireAssetService(): AssetService {
    const svc = this.registry.get(REGISTRY_KEY_ASSET_SERVICE) as AssetService | undefined;
    if (svc === undefined) {
      throw new Error("LevelScene: AssetService not found on registry; BootScene must run first.");
    }
    return svc;
  }

  /**
   * Find the {@link ImageAssetDeclaration} that backs the given Tiled
   * tileset name. Throws a clear error if missing rather than letting
   * Phaser fail with a less-readable null tileset.
   */
  private findTilesetDeclaration(
    assetService: AssetService,
    tilesetName: string,
  ): ImageAssetDeclaration {
    for (const decl of assetService.assets) {
      if (isImageDeclaration(decl) && decl.tilesetName === tilesetName) {
        return decl;
      }
    }
    throw new Error(
      `LevelScene: no AssetDeclaration found for tileset "${tilesetName}". ` +
        'Add an entry with `type: "image"` and matching `tilesetName` in ' +
        "src/services/asset-service.ts.",
    );
  }
}

/** Type-guard narrowing an {@link AssetDeclaration} to its image variant. */
function isImageDeclaration(decl: AssetDeclaration): decl is ImageAssetDeclaration {
  return decl.type === "image";
}
