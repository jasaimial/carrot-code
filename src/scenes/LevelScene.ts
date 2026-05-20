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
import { Hero } from "../entities/hero.js";
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
  private hero: Hero | undefined;

  public constructor() {
    super({ key: "LevelScene" });
  }

  /** Phaser hook — record which level to render. */
  public init(data: LevelSceneData): void {
    this.levelId = data.levelId;
    this.hero = undefined;
  }

  /** Phaser hook — build the tilemap and configure the camera. */
  public create(): void {
    const tiledJson = this.readTilemapFromCache();
    const level = this.parseLevelData(tiledJson);
    const map = this.buildTilemap();
    const terrainLayer = this.renderTileLayersWithCollision(map);
    this.spawnHero(level, terrainLayer);
    this.configureCamera(map);
    this.setupEndTrigger(level);
    // UIScene runs in parallel above this one, drawing touch buttons
    // (on touch devices) + the portrait-rotate prompt (on portrait).
    // `launch` (not `start`) so this scene keeps running.
    this.scene.launch("UIScene");
  }

  /** Phaser hook — forward delta to the hero. */
  public override update(_time: number, dtMs: number): void {
    this.hero?.update(dtMs);
  }

  /** Pull the cached Tiled JSON for the active level. */
  private readTilemapFromCache(): object {
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
    return tiledJson;
  }

  /** Parse the .tmj into typed LevelData (throws on contract violation). */
  private parseLevelData(tiledJson: object): LevelData {
    try {
      return loadLevel(tiledJson, this.levelId, this.levelId, V0_ASSET_BUDGET_BYTES);
    } catch (err) {
      if (err instanceof LevelLoadError) {
        throw new Error(`LevelScene: failed to load "${this.levelId}": ${err.message}`, {
          cause: err,
        });
      }
      throw err;
    }
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
   * Create a Phaser display layer for every tile layer in the map
   * and return the `terrain` layer specifically (the one the hero
   * collides with). For v0 there is only `terrain`; future layers
   * (decoration, foreground) will land here too without colliding.
   */
  private renderTileLayersWithCollision(
    map: Phaser.Tilemaps.Tilemap,
  ): Phaser.Tilemaps.TilemapLayer {
    const allTilesets = map.tilesets;
    let terrainLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    for (const layerData of map.layers) {
      const layer = map.createLayer(layerData.name, allTilesets, 0, 0);
      // Phaser 4 may return a TilemapGPULayer variant; narrow to the
      // classic TilemapLayer (which is what arcade physics expects).
      const classic = layer instanceof Phaser.Tilemaps.TilemapLayer ? layer : null;
      if (classic !== null && layerData.name === "terrain") {
        // Every non-zero tile id in the terrain layer is solid.
        classic.setCollisionByExclusion([-1, 0]);
        terrainLayer = classic;
      }
    }
    if (terrainLayer === null) {
      throw new Error("LevelScene: required tile layer `terrain` not found on the map.");
    }
    return terrainLayer;
  }

  /**
   * Instantiate the hero at the spawn point and add a collider against
   * the terrain layer. Stored on `this.hero` so `update()` can drive it.
   */
  private spawnHero(level: LevelData, terrainLayer: Phaser.Tilemaps.TilemapLayer): void {
    this.hero = new Hero(this, level.spawn.x, level.spawn.y);
    this.physics.add.collider(this.hero, terrainLayer);
  }

  /**
   * Set the world + camera bounds to the level size and have the
   * camera follow the hero. The hero must be spawned first.
   */
  private configureCamera(map: Phaser.Tilemaps.Tilemap): void {
    const worldWidth = map.widthInPixels;
    const worldHeight = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    if (this.hero !== undefined) {
      // `roundPixels` = true keeps the camera from sub-pixel-jittering
      // the rendered tilemap as the hero moves.
      this.cameras.main.startFollow(this.hero, true);
    }
  }

  /**
   * Add an Arcade-physics overlap on the level's end-trigger rectangle.
   * When the hero overlaps, transition to GameOverScene with the
   * level-complete outcome (FR-024 / FR-025).
   */
  private setupEndTrigger(level: LevelData): void {
    if (this.hero === undefined) {
      return;
    }
    // Build an invisible static body matching the trigger rectangle.
    const { x, y, w, h } = level.endTrigger;
    const trigger = this.add.zone(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(trigger, true);

    this.physics.add.overlap(this.hero, trigger, () => {
      // Idempotent: scene.start unloads this scene before starting the next,
      // but the overlap may fire several frames in a row before the unload
      // completes. Pause to ensure no more updates.
      this.scene.pause();
      // Stop the UIScene that this level launched, so its touch buttons
      // and portrait overlay don't sit on top of GameOverScene.
      this.scene.stop("UIScene");
      this.scene.start("GameOverScene", {
        outcome: "complete",
        levelId: this.levelId,
      });
    });

    // Subtle visual hint at the end-trigger so the player can see where
    // to head. A rectangle outline; no fill, no animation.
    const outline = this.add.rectangle(x + w / 2, y + h / 2, w, h);
    outline.setStrokeStyle(2, this.parseHexToNumber(PALETTE_HEX.uiCarrot), 0.8);
  }

  /** CSS hex string -> Phaser numeric color (0xRRGGBB). */
  private parseHexToNumber(hex: string): number {
    return Number.parseInt(hex.slice(1), 16);
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
