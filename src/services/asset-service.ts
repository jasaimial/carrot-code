// -----------------------------------------------------------------------------
// carrot-code — AssetService (T023)
//
// The single source of truth for what BootScene preloads (Constitution
// Principle XI: I/O lives in services, not scenes). Scenes never
// hard-code asset URLs or asset keys; they iterate
// `AssetService.assets` or call `AssetService.urlOf(key)`.
//
// In v0 the concrete implementation (`KennyAssetService`) ships with
// an empty `assets` array. Each user story phase fills it in: hero +
// tile sprites land with T029 / T033, enemies + collectibles with US2,
// HUD glyphs with US3. The shape + the seam exist now so adding an
// asset is a one-line append rather than a refactor.
//
// The asset-budget verifier (T059) sums `approxBytes` per level and
// fails the build if it exceeds the level's `assetBudgetBytes`
// (Principle X). Authors update `approxBytes` when they swap art.
//
// See:
//   specs/001-vertical-slice/contracts/services.md#assetservice
//   .specify/memory/constitution.md  — Principles X + XI
// -----------------------------------------------------------------------------

/**
 * Declarative description of a single Phaser asset. Authoring rule:
 * every key referenced anywhere in the codebase (Tiled custom
 * properties, entity configs, HUD, etc.) MUST appear in exactly one
 * `AssetDeclaration` on the active `AssetService`.
 */
export interface AssetDeclaration {
  /** Phaser asset key. Unique across the entire game. */
  readonly key: string;
  /** Which Phaser loader the BootScene should dispatch to. */
  readonly type: "image" | "spritesheet" | "tilemap-json";
  /** URL relative to `public/` (e.g. `assets/hero/idle.png`). */
  readonly url: string;
  /**
   * Approximate on-disk size in bytes. Used by the build-time
   * asset-budget verifier (T059); authors update this when they swap
   * the underlying file. A few bytes off is fine; the budget itself
   * is in tens-of-kilobytes ranges.
   */
  readonly approxBytes: number;
}

/**
 * Read-only registry of every asset the game preloads. Scenes consume
 * it; they do not mutate it. The interface is the seam (Principle XI):
 * tests inject a fake; production uses {@link KennyAssetService}.
 */
export interface AssetService {
  /** All asset declarations. The single source of truth for BootScene. */
  readonly assets: readonly AssetDeclaration[];
  /**
   * Resolve the URL for a given key. Useful in UIScene where Phaser
   * keys aren't directly reachable (e.g. building a `<img>` for a
   * narrator portrait, or a CSS background).
   *
   * @param key - The asset key to resolve.
   * @returns The declared URL for that key.
   * @throws {Error} If the key is not declared on this service.
   */
  urlOf(key: string): string;
}

/**
 * Production AssetService. Sources its declarations from a frozen
 * array shipped with the build. Constructed once in `game.ts` (T027)
 * and registered on the scene registry so every scene can reach it
 * without an explicit injection wrapper.
 *
 * The `assets` array starts empty; entries are appended per user
 * story (US1 hero + tile, US2 enemies + collectibles, etc.) so the
 * seam exists from day one but no asset is shipped without a story
 * driving it.
 */
export class KennyAssetService implements AssetService {
  /** @inheritdoc */
  public readonly assets: readonly AssetDeclaration[];

  /**
   * Build an AssetService.
   *
   * @param declarations - The full asset list. Defaults to the empty
   *   v0 list; tests may pass a custom array.
   */
  public constructor(declarations: readonly AssetDeclaration[] = ASSETS) {
    this.assets = Object.freeze(declarations.slice());
  }

  /** @inheritdoc */
  public urlOf(key: string): string {
    for (const decl of this.assets) {
      if (decl.key === key) {
        return decl.url;
      }
    }
    throw new Error(`AssetService: no declaration for asset key "${key}"`);
  }
}

/**
 * The shipped v0 asset list. Intentionally empty — entries land per
 * user story so we never ship a file the game doesn't actually use
 * (Principle X). Authoring rule: append to this array when adding a
 * new sprite; never reach for URLs inline in scenes.
 */
const ASSETS: readonly AssetDeclaration[] = Object.freeze([]);
