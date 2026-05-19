/**
 * Asset preload scene (T032).
 *
 * Runs first on game start. Responsibilities:
 *   1. Show a small "Loading…" indicator while the player waits.
 *   2. Resolve the requested level's `.tmj` URL via {@link LevelRegistry}
 *      (a dynamic import — Vite serves a code-split chunk per level).
 *   3. Iterate the active {@link AssetService}'s declarations and queue
 *      the matching Phaser loader call for each (`load.image`,
 *      `load.spritesheet`).
 *   4. Queue the level `.tmj` itself via `load.tilemapTiledJSON`.
 *   5. When all loads complete, transition to `LevelScene` with the
 *      `levelId` so the scene can `make.tilemap({ key: levelId })`.
 *
 * Owns the dev FPS overlay until UIScene graduates from stub (T035).
 *
 * Scene-data contract:
 *   - Optional `{ levelId: LevelId }`. Defaults to `"level-01"` for v0.
 *
 * See:
 *   src/data/levels/index.ts          — LevelRegistry source
 *   src/services/asset-service.ts     — asset declarations
 *   .specify/memory/constitution.md   — Principles III + X + XI
 */

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";
import { LevelRegistry, type LevelId } from "../data/levels/index.js";
import { t } from "../i18n/index.js";
import {
  type AssetDeclaration,
  type AssetService,
  KennyAssetService,
} from "../services/asset-service.js";
import { attachFpsOverlay } from "../systems/debug-overlay.js";

/** What this scene expects in its `init(data)` call. */
interface BootSceneData {
  /** Which level to boot into. Defaults to `"level-01"` when omitted. */
  readonly levelId?: LevelId;
}

/** Default level the game boots into. Single-level v0; expand here later. */
const DEFAULT_LEVEL_ID: LevelId = "level-01";

/** Registry key for the shared AssetService instance (Principle XI seam). */
export const REGISTRY_KEY_ASSET_SERVICE = "assetService";

/** Preloads every required asset, then hands off to {@link LevelScene}. */
export class BootScene extends Phaser.Scene {
  private levelId: LevelId = DEFAULT_LEVEL_ID;

  public constructor() {
    super({ key: "BootScene" });
  }

  /** Phaser hook — record which level to boot into. */
  public init(data: BootSceneData): void {
    this.levelId = data.levelId ?? DEFAULT_LEVEL_ID;
  }

  /**
   * Phaser hook — show a loading message, resolve the level URL, queue
   * every load, and transition out when complete.
   *
   * `create()` (not `preload()`) hosts this work because the level URL
   * comes from an async dynamic import. We queue loads on the scene's
   * loader plugin and start it manually, which is fully supported.
   */
  public create(): void {
    this.drawLoadingText();
    attachFpsOverlay(this);

    // Get-or-create the shared AssetService. game.ts seeds it via
    // postBoot; this fallback keeps the scene independently runnable
    // in tests (Principle XI).
    let assetService = this.registry.get(REGISTRY_KEY_ASSET_SERVICE) as AssetService | undefined;
    if (assetService === undefined) {
      assetService = new KennyAssetService();
      this.registry.set(REGISTRY_KEY_ASSET_SERVICE, assetService);
    }

    // Kick off the level URL resolve + asset load pipeline. We don't
    // await at the top level because Phaser create() is sync; the
    // chain settles via .then() and the loader's `complete` event.
    void this.preloadLevelAndAssets(assetService);
  }

  /** Render the centered "Loading…" message visible during preload. */
  private drawLoadingText(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, t("boot.loading"), {
        fontFamily: "monospace",
        fontSize: "20px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5);
  }

  /**
   * Resolve the level URL, queue the tilemap + every asset declaration,
   * and transition to {@link LevelScene} when the loader reports
   * complete.
   */
  private async preloadLevelAndAssets(assetService: AssetService): Promise<void> {
    const levelLoader = LevelRegistry[this.levelId];
    const levelModule = await levelLoader();
    const levelUrl: string = levelModule.default;

    // Tilemap JSON keyed by levelId so LevelScene can `make.tilemap({ key })`.
    this.load.tilemapTiledJSON(this.levelId, levelUrl);

    for (const decl of assetService.assets) {
      this.queueAsset(decl);
    }

    // Phaser fires `complete` even when the loader queue is empty,
    // so this works whether the asset list has 0 or N entries.
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.scene.start("LevelScene", { levelId: this.levelId });
    });
    this.load.start();
  }

  /**
   * Dispatch a single asset declaration to the matching Phaser loader.
   *
   * The discriminated-union shape on {@link AssetDeclaration} means
   * TypeScript verifies every variant is handled. Adding a new asset
   * type (audio, bitmap font) is a compile-time error here until
   * wired in.
   */
  private queueAsset(decl: AssetDeclaration): void {
    switch (decl.type) {
      case "image":
        this.load.image(decl.key, decl.url);
        return;
      case "spritesheet":
        this.load.spritesheet(decl.key, decl.url, {
          frameWidth: decl.frameWidth,
          frameHeight: decl.frameHeight,
        });
        return;
    }
  }
}
