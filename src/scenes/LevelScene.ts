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

import { HERO } from "../config/hero.js";
import { PALETTE_HEX } from "../config/palette.js";
import { getNarratorBeatsForLevel } from "../data/narrator-beats.js";
import { type LevelId, LevelRegistry } from "../data/levels/index.js";
import { Enemy } from "../entities/enemy.js";
import { Hero } from "../entities/hero.js";
import { createPickup } from "../entities/pickup.js";
import { Projectile } from "../entities/projectile.js";
import {
  type AssetDeclaration,
  type AssetService,
  type ImageAssetDeclaration,
} from "../services/asset-service.js";
import { loadLevel, LevelLoadError } from "../services/level-loader.js";
import { LEGACY_PROFILE_KEY, type SaveService } from "../services/save-service.js";
import { playCarrotBurst, playPowerupPickupFx } from "../systems/feedback-fx.js";
import { evaluateNarratorTrigger } from "../systems/narrator-trigger.js";
import { REGISTRY_KEY_SOUND_FX, type SoundFx } from "../systems/sound-fx.js";
import { installBackdrop, type BackdropTheme } from "../systems/visual-backdrop.js";
import type { LevelData } from "../types/level.js";

import { REGISTRY_KEY_ASSET_SERVICE } from "./BootScene.js";
import { REGISTRY_KEY_ACTIVE_PROFILE_KEY, REGISTRY_KEY_SAVE_SERVICE } from "../game.js";

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
  private readonly projectiles: Projectile[] = [];
  /** Cached terrain layer so the per-frame fire-poll can wire colliders. */
  private terrainLayer: Phaser.Tilemaps.TilemapLayer | undefined;
  /** Cached world height (px) for the fell-off-world death check. */
  private worldHeight = 0;
  /**
   * Active water-hazard zones (Phaser physics-enabled zone objects).
   * Tracked so the per-frame update() can re-test overlap and refresh
   * the hero's inWaterCount — Phaser has no "overlap end" event so we
   * poll each frame.
   */
  private readonly waterZones: Phaser.GameObjects.Zone[] = [];
  /** Whether the hero was inside any water zone last frame. */
  private heroWasInWater = false;
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
    this.projectiles.length = 0;
    this.terrainLayer = undefined;
    this.worldHeight = 0;
    this.waterZones.length = 0;
    this.heroWasInWater = false;
    // Load currentCarrots from SaveState - carrots carry across levels.
    // Falls back to 0 if SaveService is unavailable.
    this.carrotsCollected = this.readPersistedCarrots();
    this.hasEnded = false;
    this.spawnTimeMs = 0;
    this.level = undefined;
    this.firedBeatIds.clear();
    this.activeBeatId = undefined;
    // Seed HUD state on the registry; UIScene reads + watches it.
    this.registry.set(REGISTRY_KEY_CARROT_COUNT, this.carrotsCollected);
    this.registry.set(REGISTRY_KEY_POWERUP_REMAINING_MS, 0);
    // Narrator dialog hidden on (re)start (T050: replay re-fires beats).
    this.registry.set(REGISTRY_KEY_NARRATOR_TEXT, "");
  }

  /** Read the persisted carrot count for the active profile; 0 on any failure. */
  private readPersistedCarrots(): number {
    const saveService = this.registry.get(REGISTRY_KEY_SAVE_SERVICE) as SaveService | undefined;
    if (saveService === undefined) {
      return 0;
    }
    try {
      return saveService.load(this.activeProfileKey()).currentCarrots;
    } catch {
      return 0;
    }
  }

  /**
   * Resolve the active profile's storage key. Falls back to the legacy
   * profile if the registry isn't seeded yet (game.ts postBoot is the
   * canonical seeder; defensive fallback for tests / edge cases).
   */
  private activeProfileKey(): string {
    const fromRegistry = this.registry.get(REGISTRY_KEY_ACTIVE_PROFILE_KEY) as unknown;
    return typeof fromRegistry === "string" && fromRegistry.length > 0
      ? fromRegistry
      : LEGACY_PROFILE_KEY;
  }

  /**
   * Phaser hook — build the tilemap and configure the camera.
   *
   * If the level's tilemap JSON is already in Phaser's cache (the
   * usual case for level-01, which BootScene preloaded), build runs
   * synchronously. If not (level-02 on first visit — BootScene only
   * preloads its initial level), queue a load + run build when the
   * loader completes.
   *
   * Without this lazy-load, Hop In to a non-preloaded level threw
   * 'tilemap not found in Phaser cache' inside readTilemapFromCache,
   * which aborted the scene transition mid-flight and looked like a
   * whole-scene freeze. Confirmed by maintainer 2026-05-28 on Hop In
   * with level-02 selected.
   */
  public create(): void {
    if (this.cache.tilemap.has(this.levelId)) {
      this.buildLevel();
      return;
    }
    this.drawLoadingPlaceholder();
    void this.lazyLoadTilemapThenBuild();
  }

  /** Draw a tiny "loading…" while the missing tilemap fetches. */
  private drawLoadingPlaceholder(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "Loading…", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0.5);
  }

  /** Async lazy-load path: queue the tilemap, await complete, then build. */
  private async lazyLoadTilemapThenBuild(): Promise<void> {
    const levelLoader = LevelRegistry[this.levelId];
    const levelModule = await levelLoader();
    const levelUrl: string = levelModule.default;
    this.load.tilemapTiledJSON(this.levelId, levelUrl);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.buildLevel();
    });
    this.load.start();
    // Empty-queue defensive fallback (mirrors BootScene's same
    // pattern). Phaser sometimes doesn't fire COMPLETE for empty
    // queues; the tilemap queue here is non-empty by definition
    // but the guard is cheap.
    if (this.load.totalToLoad === 0) {
      this.buildLevel();
    }
  }

  /**
   * The actual scene-build logic. Extracted from create() so both the
   * sync (tilemap already cached) and async (lazy-loaded) paths can
   * call it.
   */
  private buildLevel(): void {
    const tiledJson = this.readTilemapFromCache();
    const level = this.parseLevelData(tiledJson);
    this.level = level;
    const map = this.buildTilemap();
    // Install parallax backdrop BEFORE rendering tile layers so its
    // negative-depth Graphics objects don't have to fight for z-order.
    // Theme is selected per level id: level-01 daytime, level-02 twilight.
    const theme: BackdropTheme = this.levelId === "level-02" ? "twilight" : "daytime";
    installBackdrop(this, map.widthInPixels, map.heightInPixels, theme);
    const terrainLayer = this.renderTileLayersWithCollision(map);
    this.terrainLayer = terrainLayer;
    this.worldHeight = map.heightInPixels;
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
    // Tick + cull enemies (dead enemies are destroyed by projectiles).
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (enemy?.active !== true) {
        this.enemies.splice(i, 1);
        continue;
      }
      enemy.update(dtMs);
    }
    // Tick projectiles + cull destroyed ones from our tracking array
    // so we don't iterate dead refs forever.
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const p = this.projectiles[i];
      if (p?.active !== true) {
        this.projectiles.splice(i, 1);
        continue;
      }
      p.update();
    }
    // Fire-poll: if hero wants to throw + we have ammo, spawn one.
    this.handleFirePoll();
    // Water-zone poll: refresh hero's in-water flag each frame.
    // (Phaser has no "overlap end" event, so we poll.)
    this.pollWaterZones();
    // Fell-off-world check: hero falling into a ground gap should be a
    // death state, not an indefinite drop. World bottom is the bottom
    // of the tilemap; we add a small margin so the hero is visibly
    // below the playable area before we trigger gameover (avoids
    // killing a hero who's just briefly inside a thin one-tile gap
    // that happens to share their y).
    this.checkFellOffWorld();
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
   * Per-frame fire-poll: ask the hero whether the player just pressed
   * fire + cooldown allows; if yes, decrement ammo (carrot count) and
   * spawn a projectile in the hero's facing direction. If no ammo,
   * play the empty-thunk sound for feedback. Wires the new projectile
   * against terrain (lands physically + auto-destroys after a moment)
   * + enemies (mutual destroy).
   */
  private handleFirePoll(): void {
    const hero = this.hero;
    if (hero === undefined || this.terrainLayer === undefined) {
      return;
    }
    if (!hero.consumeFireRequest()) {
      return;
    }
    const soundFx = this.requireSoundFx();
    if (this.carrotsCollected <= 0) {
      // Out of ammo: short empty-thunk so the player learns the rule.
      soundFx?.playEmpty();
      return;
    }
    // Spend one carrot of ammo.
    this.carrotsCollected -= 1;
    this.registry.set(REGISTRY_KEY_CARROT_COUNT, this.carrotsCollected);

    // Spawn the projectile slightly in front of the hero AND lifted
    // above the hero's vertical center. The lift matters: spawning at
    // hero.y center would overlap the floor tile under the hero on
    // frame 1 and instantly trigger the terrain-collide callback. The
    // small upward offset keeps frame 1 clear of the floor body.
    const dir = hero.getFacingDirection();
    const spawnX = hero.x + dir * 14;
    const spawnY = hero.y + HERO.projectileSpawnYOffsetPx;
    const projectile = new Projectile(this, spawnX, spawnY, dir);
    this.projectiles.push(projectile);

    // Projectile lands on terrain (collider, not overlap, so it can
    // physically bounce + come to rest). A short delayed-destroy after
    // first ground contact removes it so the display list doesn't fill
    // up with abandoned carrots over a long run.
    this.physics.add.collider(projectile, this.terrainLayer, () => {
      if (!projectile.active) {
        return;
      }
      // Linger 250ms after the first landing bounce, then vanish.
      this.time.delayedCall(250, () => {
        if (projectile.active) {
          projectile.destroy();
        }
      });
    });

    // Projectile destroyed by enemy and the enemy with it.
    for (const enemy of this.enemies) {
      this.physics.add.overlap(projectile, enemy, () => {
        if (!enemy.active || !projectile.active) {
          return;
        }
        projectile.destroy();
        enemy.destroy();
      });
    }

    soundFx?.playThrow();
  }

  /**
   * Death-by-pit check: if the hero has fallen past the bottom of the
   * world (down through a ground gap) treat it as an instant game-over.
   *
   * Without this, the hero just keeps falling forever as the camera
   * stays clamped to the world bounds \u2014 looks like the game froze and
   * is one of the most frustrating "is this broken?" bugs for a
   * first-time player. Per-frame check, cheap, no physics involvement.
   *
   * Uses a small margin (1 tile = 18px) below the world bottom so the
   * hero is visibly off-screen before death triggers — prevents
   * accidental death from a hero whose sprite center happens to dip
   * one pixel into a thin gap.
   */
  private checkFellOffWorld(): void {
    if (this.hasEnded || this.hero === undefined) {
      return;
    }
    if (this.hero.y > this.worldHeight + 18) {
      this.endLevel("gameover");
    }
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
    const onNarratorChange = (_parent: unknown, value: unknown): void => {
      if (typeof value === "string" && value === "") {
        this.activeBeatId = undefined;
      }
    };
    const eventName = Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_NARRATOR_TEXT;
    this.registry.events.on(eventName, onNarratorChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(eventName, onNarratorChange);
    });
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
            // Capture pickup position BEFORE onCollect() destroys the
            // sprite — the burst needs world coords + the sprite is gone
            // immediately after.
            const burstX = sprite.x;
            const burstY = sprite.y;
            onCollect();
            playCarrotBurst(this, burstX, burstY);
            this.requireSoundFx()?.playCarrotCollect();
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
            // Pickup-moment flash on the hero (discrete spark vs the
            // continuous gold tint that follows while powered).
            playPowerupPickupFx(this, hero);
            this.requireSoundFx()?.playPowerup();
            // Publish the freshly-applied window to the HUD. The
            // remainingMs read in update() refreshes the counter
            // each frame; this seeds the initial value.
            this.registry.set(REGISTRY_KEY_POWERUP_REMAINING_MS, hero.getPowerupRemainingMs());
          });
          break;
        }
        case "lava": {
          // Lava: a rectangular zone with a static physics body.
          // Hero overlap fires hero.takeHit() with the zone center as
          // the knock-from x. Hero's invuln window (post-hit) filters
          // multi-frame retrigger.
          const cx = entity.x + entity.w / 2;
          const cy = entity.y + entity.h / 2;
          const zone = this.add.zone(cx, cy, entity.w, entity.h);
          this.physics.add.existing(zone, true);
          // Visual: tinted orange rect rendered above the gameplay
          // layer so it reads as a hazard, not as floor.
          this.add
            .rectangle(cx, cy, entity.w, entity.h, this.parseHexToNumber(PALETTE_HEX.uiCarrot), 0.8)
            .setOrigin(0.5)
            .setStrokeStyle(2, this.parseHexToNumber(PALETTE_HEX.uiHeart), 0.9)
            .setDepth(50);
          this.physics.add.overlap(hero, zone, () => {
            this.onHeroLavaContact(cx);
          });
          break;
        }
        case "water": {
          // Water: same physics-zone shape as lava, but the contact
          // mechanic is "slow movement" (no damage). LevelScene's
          // per-frame update() polls each water zone to refresh the
          // hero's inWaterCount (Phaser has no "overlap end" event).
          const cx = entity.x + entity.w / 2;
          const cy = entity.y + entity.h / 2;
          const zone = this.add.zone(cx, cy, entity.w, entity.h);
          this.physics.add.existing(zone, true);
          // Visual: tinted blue rect rendered ABOVE the hero sprite
          // so the hero appears half-submerged when standing in it.
          // Hero sprite default depth = 0; we use depth 200 for water.
          this.add
            .rectangle(cx, cy, entity.w, entity.h, 0x4488cc, 0.55)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0x66bbee, 0.7)
            .setDepth(200);
          this.waterZones.push(zone);
          break;
        }
      }
    }
  }

  /**
   * Hero × lava overlap handler. Same routing as enemy-contact: hero
   * takes a hit, possibly transitions to gameover.
   */
  private onHeroLavaContact(zoneX: number): void {
    if (this.hero === undefined || this.hasEnded) {
      return;
    }
    const outcome = this.hero.takeHit(zoneX);
    if (outcome === "hurt") {
      this.publishHeroLives();
    } else if (outcome === "gameover") {
      this.publishHeroLives();
      this.endLevel("gameover");
    }
  }

  /**
   * Per-frame water-zone poll. Rectangle-intersection test against
   * every water zone; the hero's enterWater/leaveWater calls maintain
   * the slow-movement modifier. Polled (not callback-driven) because
   * Phaser doesn't fire an "overlap end" event.
   */
  private pollWaterZones(): void {
    if (this.hero === undefined || this.waterZones.length === 0) {
      return;
    }
    const heroBounds = this.hero.getBounds();
    let nowInWater = false;
    for (const zone of this.waterZones) {
      const zb = zone.getBounds();
      if (Phaser.Geom.Intersects.RectangleToRectangle(heroBounds, zb)) {
        nowInWater = true;
        break;
      }
    }
    if (nowInWater && !this.heroWasInWater) {
      this.hero.enterWater();
    } else if (!nowInWater && this.heroWasInWater) {
      this.hero.leaveWater();
    }
    this.heroWasInWater = nowInWater;
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
    // Persist progress on BOTH outcomes (v0.3 carrot persistence rules):
    //   - "complete": carrots carry to next level + level marked done.
    //   - "gameover": carrots reset to 0 (death penalty).
    // SaveService failure is non-blocking (we log + continue).
    this.persistProgress(outcome);
    // Stop UIScene explicitly (it runs in parallel; scene.start on
    // GameOverScene only stops the calling scene). Then transition.
    //
    // We deliberately do NOT call scene.pause() before this. Earlier
    // versions did, but pause()+start() left LevelScene in a state
    // where the SHUTDOWN event handlers (registry-listener cleanup,
    // etc.) didn't reliably fire, and the next Play-again-after-death
    // restart ended up with stale registry subscriptions. scene.start
    // on its own properly shuts down the calling scene.
    this.scene.stop("UIScene");
    this.scene.start("GameOverScene", {
      outcome,
      levelId: this.levelId,
      outcomeCarrots: this.carrotsCollected,
    });
  }

  /**
   * Write the run's contributions into SaveState. Behavior depends on
   * outcome:
   *   - "complete": persist currentCarrots (they carry to next level)
   *     + add this level to completedLevelIds.
   *   - "gameover": reset currentCarrots to 0 (death penalty per
   *     agreed v0.3 rules). completedLevelIds NOT updated since the
   *     level wasn't actually finished.
   *
   * Reads the active profile from the registry (game.ts seeds it to
   * LEGACY_PROFILE_KEY at boot; MenuScene profile picker updates it
   * when the player switches profiles).
   * Failure is non-blocking and only logged.
   */
  private persistProgress(outcome: "complete" | "gameover"): void {
    const saveService = this.registry.get(REGISTRY_KEY_SAVE_SERVICE) as SaveService | undefined;
    if (saveService === undefined) {
      // SaveService failed to construct at boot (e.g. private-mode storage
      // disabled). Game-state changes are session-only.
      return;
    }
    const profileKey = this.activeProfileKey();
    try {
      const current = saveService.load(profileKey);
      const newCarrots = outcome === "gameover" ? 0 : this.carrotsCollected;
      const newCompletedLevels =
        outcome === "complete"
          ? [...current.completedLevelIds, this.levelId]
          : current.completedLevelIds;
      saveService.save(profileKey, {
        version: 2,
        profileHandle: current.profileHandle,
        currentCarrots: newCarrots,
        gems: current.gems,
        abilities: current.abilities,
        completedLevelIds: newCompletedLevels,
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
   * Retrieve the shared SoundFx. Returns undefined when missing (test
   * harness, very old browser without WebAudio). All callers use
   * optional-chaining so audio is non-blocking by design.
   */
  private requireSoundFx(): SoundFx | undefined {
    return this.registry.get(REGISTRY_KEY_SOUND_FX) as SoundFx | undefined;
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
