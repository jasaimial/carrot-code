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
import { getNarratorBeatsForLevel } from "../data/narrator-beats.js";
import { type LevelId } from "../data/levels/index.js";
import { Enemy } from "../entities/enemy.js";
import { Hero } from "../entities/hero.js";
import { createPickup } from "../entities/pickup.js";
import {
  type AssetDeclaration,
  type AssetService,
  type ImageAssetDeclaration,
} from "../services/asset-service.js";
import { loadLevel, LevelLoadError } from "../services/level-loader.js";
import { type SaveService } from "../services/save-service.js";
import { evaluateNarratorTrigger } from "../systems/narrator-trigger.js";
import type { LevelData } from "../types/level.js";

import { REGISTRY_KEY_ASSET_SERVICE } from "./BootScene.js";
import { REGISTRY_KEY_SAVE_SERVICE } from "../game.js";

/** Registry-event key the HUD listens to for hero-lives changes. */
export const REGISTRY_KEY_HERO_LIVES = "heroLives";
/** Registry-event key the HUD listens to for carrot-count changes. */
export const REGISTRY_KEY_CARROT_COUNT = "carrotCount";
/** Registry-event key the HUD listens to for powerup remaining ms. */
export const REGISTRY_KEY_POWERUP_REMAINING_MS = "powerupRemainingMs";
/**
 * Registry-event key the HUD listens to for narrator dialog.
 * Value is the active beat text, or empty string when no dialog is showing.
 * UIScene clears it (sets "") on dismiss; LevelScene treats that as ack.
 */
export const REGISTRY_KEY_NARRATOR_TEXT = "narratorText";

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
  private readonly enemies: Enemy[] = [];
  private carrotsCollected = 0;
  private hasEnded = false;
  private spawnTimeMs = 0;
  private level: LevelData | undefined;
  private readonly firedBeatIds = new Set<string>();
  private activeBeatId: string | undefined;

  public constructor() {
    super({ key: "LevelScene" });
  }

  /** Phaser hook — record which level to render. */
  public init(data: LevelSceneData): void {
    this.levelId = data.levelId;
    this.hero = undefined;
    this.enemies.length = 0;
    this.carrotsCollected = 0;
    this.hasEnded = false;
    this.spawnTimeMs = 0;
    this.level = undefined;
    this.firedBeatIds.clear();
    this.activeBeatId = undefined;
    // Seed HUD state on the registry; UIScene reads + watches it.
    this.registry.set(REGISTRY_KEY_CARROT_COUNT, 0);
    this.registry.set(REGISTRY_KEY_POWERUP_REMAINING_MS, 0);
    // Narrator dialog hidden on (re)start (T050: replay re-fires beats).
    this.registry.set(REGISTRY_KEY_NARRATOR_TEXT, "");
  }

  /** Phaser hook — build the tilemap and configure the camera. */
  public create(): void {
    const tiledJson = this.readTilemapFromCache();
    const level = this.parseLevelData(tiledJson);
    this.level = level;
    const map = this.buildTilemap();
    const terrainLayer = this.renderTileLayersWithCollision(map);
    this.spawnHero(level, terrainLayer);
    this.spawnTimeMs = this.time.now;
    this.dispatchEntities(level, terrainLayer);
    this.configureCamera(map);
    this.setupEndTrigger(level);
    this.setupNarratorDismissWatch();
    // UIScene runs in parallel above this one, drawing touch buttons
    // (on touch devices) + the portrait-rotate prompt (on portrait) +
    // the HUD (hearts + carrot count).
    // `launch` (not `start`) so this scene keeps running.
    this.scene.launch("UIScene");
    // Initial HUD seed (after hero exists).
    this.publishHeroLives();
  }

  /** Phaser hook — forward delta to the hero + each enemy. */
  public override update(_time: number, dtMs: number): void {
    this.hero?.update(dtMs);
    for (const enemy of this.enemies) {
      enemy.update(dtMs);
    }
    // Publish per-frame powerup remaining ms so the HUD ring can
    // draw the depleting timer. Round to ints so the registry's
    // change-detection doesn't fire every single frame (only when
    // the rounded value changes).
    if (this.hero !== undefined) {
      const remaining = Math.round(this.hero.getPowerupRemainingMs() / 100) * 100;
      const prev = this.registry.get(REGISTRY_KEY_POWERUP_REMAINING_MS) as unknown;
      if (typeof prev !== "number" || prev !== remaining) {
        this.registry.set(REGISTRY_KEY_POWERUP_REMAINING_MS, remaining);
      }
    }
    this.evaluateNarratorBeats();
  }

  /**
   * Iterate authored beats once per frame; fire the first eligible
   * unfired beat by publishing its text. Only one beat shows at a time;
   * dismiss is acknowledged via the registry-clear callback below.
   */
  private evaluateNarratorBeats(): void {
    if (this.level === undefined || this.hero === undefined) {
      return;
    }
    if (this.activeBeatId !== undefined) {
      return;
    }
    const elapsed = this.time.now - this.spawnTimeMs;
    const heroPos = { x: this.hero.x, y: this.hero.y };
    for (const beat of this.level.narratorBeats) {
      if (this.firedBeatIds.has(beat.id)) {
        continue;
      }
      if (evaluateNarratorTrigger(beat, elapsed, heroPos, [])) {
        this.activeBeatId = beat.id;
        this.firedBeatIds.add(beat.id);
        this.registry.set(REGISTRY_KEY_NARRATOR_TEXT, beat.text);
        break;
      }
    }
  }

  /**
   * Watch for UIScene clearing the narrator text (its dismiss path).
   * When that happens, drop the active beat so the next eligible one
   * can fire.
   */
  private setupNarratorDismissWatch(): void {
    this.registry.events.on(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_NARRATOR_TEXT,
      (_parent: unknown, value: unknown) => {
        if (typeof value === "string" && value === "") {
          this.activeBeatId = undefined;
        }
      },
    );
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
      const parsed = loadLevel(tiledJson, this.levelId, this.levelId, V0_ASSET_BUDGET_BYTES);
      // Narrator content is authored in src/data/narrator-beats.ts (T047).
      // Loader remains Tiled-focused and scene composes in per-level beats.
      return Object.freeze({
        ...parsed,
        narratorBeats: getNarratorBeatsForLevel(this.levelId),
      });
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
      // `endLevel` is idempotent so multi-frame overlap before unload
      // doesn't double-fire.
      this.endLevel("complete");
    });

    // Subtle visual hint at the end-trigger so the player can see where
    // to head. A rectangle outline; no fill, no animation.
    const outline = this.add.rectangle(x + w / 2, y + h / 2, w, h);
    outline.setStrokeStyle(2, this.parseHexToNumber(PALETTE_HEX.uiCarrot), 0.8);
  }

  /**
   * Walk every entity in the loaded level and instantiate the matching
   * runtime object (Enemy sprite + collider, carrot pickup + overlap,
   * etc.). Exhaustive switch on `kind` gives compile-time coverage:
   * adding a new EntityConfig variant errors here until handled.
   */
  private dispatchEntities(level: LevelData, terrainLayer: Phaser.Tilemaps.TilemapLayer): void {
    if (this.hero === undefined) {
      return;
    }
    const hero = this.hero;

    for (const entity of level.entities) {
      switch (entity.kind) {
        case "enemy": {
          const enemy = new Enemy(this, entity.x, entity.y, entity);
          this.enemies.push(enemy);
          // Enemy collides with terrain so it doesn't fall off platforms.
          this.physics.add.collider(enemy, terrainLayer);
          // Hero × enemy: hero takes a hit, knocked back from enemy x.
          this.physics.add.overlap(hero, enemy, () => {
            this.onHeroEnemyOverlap(enemy.x);
          });
          break;
        }
        case "carrot": {
          const { sprite, onCollect } = createPickup(this, entity.x, entity.y, entity);
          this.physics.add.overlap(hero, sprite, () => {
            onCollect();
            this.carrotsCollected += 1;
            this.registry.set(REGISTRY_KEY_CARROT_COUNT, this.carrotsCollected);
          });
          break;
        }
        case "powerup": {
          const { sprite, onCollect } = createPickup(this, entity.x, entity.y, entity);
          this.physics.add.overlap(hero, sprite, () => {
            onCollect();
            hero.applyPowerup(entity.durationMs);
            // Publish the freshly-applied window to the HUD. The
            // remainingMs read in update() refreshes the counter
            // each frame; this seeds the initial value.
            this.registry.set(REGISTRY_KEY_POWERUP_REMAINING_MS, hero.getPowerupRemainingMs());
          });
          break;
        }
      }
    }
  }

  /**
   * Hero × enemy overlap handler. The hero's invulnerability window
   * filters repeat hits, so this just delegates to `takeHit()` and
   * routes to GameOverScene on the gameover outcome.
   */
  private onHeroEnemyOverlap(enemyX: number): void {
    if (this.hero === undefined || this.hasEnded) {
      return;
    }
    const outcome = this.hero.takeHit(enemyX);
    if (outcome === "hurt") {
      this.publishHeroLives();
    } else if (outcome === "gameover") {
      this.publishHeroLives();
      this.endLevel("gameover");
    }
  }

  /** Push the hero's current lives count onto the registry for the HUD. */
  private publishHeroLives(): void {
    if (this.hero !== undefined) {
      this.registry.set(REGISTRY_KEY_HERO_LIVES, this.hero.getLives());
    }
  }

  /** Shared exit path used by both end-trigger and gameover. */
  private endLevel(outcome: "complete" | "gameover"): void {
    if (this.hasEnded) {
      return;
    }
    this.hasEnded = true;
    // Persist progress on level-complete. SaveService failure is
    // non-blocking (Principle: don't crash the game over a save bug)
    // — we log + continue. Gameover doesn't persist anything.
    if (outcome === "complete") {
      this.persistProgress();
    }
    this.scene.pause();
    this.scene.stop("UIScene");
    this.scene.start("GameOverScene", { outcome, levelId: this.levelId });
  }

  /**
   * Write the run's contributions into SaveState. Adds this level to
   * `completedLevelIds`, adds this run's carrots to `lifetimeCarrots`.
   * Failure is non-blocking and only logged.
   */
  private persistProgress(): void {
    const saveService = this.registry.get(REGISTRY_KEY_SAVE_SERVICE) as SaveService | undefined;
    if (saveService === undefined) {
      // SaveService failed to construct at boot (e.g. private-mode storage
      // disabled). Game-state changes are session-only.
      return;
    }
    try {
      const current = saveService.load();
      saveService.save({
        version: 1,
        completedLevelIds: [...current.completedLevelIds, this.levelId],
        lifetimeCarrots: current.lifetimeCarrots + this.carrotsCollected,
      });
    } catch (err) {
      console.warn(`LevelScene: progress save failed: ${String(err)}`);
    }
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
