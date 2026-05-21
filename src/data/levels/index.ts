// -----------------------------------------------------------------------------
// carrot-code — LevelRegistry (T030)
//
// The canonical list of every playable level, keyed by `levelId`. Each
// entry is a *factory* returning a dynamic-import promise that resolves
// to the level's `.tmj` URL. The factory shape lets Vite code-split each
// level into its own chunk, so adding level-02 doesn't enlarge the
// initial bundle (Principle X). For v0 there's only `level-01`.
//
// Why a separate registry from `AssetService`:
//   - Levels are keyed by `levelId`, not by Phaser asset key.
//   - Levels are lazy-loaded (you don't preload every level on boot).
//   - The level data is structured (spawn + entities + budget), not
//     a flat URL-by-key lookup.
//
// Each `.tmj` file references one or more tileset *images*. Those
// images are declared in `KennyAssetService.assets` with a matching
// `tilesetName` field, and `LevelScene` binds them at scene-build time.
//
// Adding a new level (e.g. level-02):
//   1. Author `src/data/levels/level-02.tmj` in Tiled.
//   2. Add `"level-02": () => import("./level-02.tmj?url"),` below.
//   3. Add the matching union member to `LevelId`.
//
// See:
//   src/data/levels/level-01.tmj       \u2014 the only v0 level
//   src/services/asset-service.ts      \u2014 tileset image declarations
//   src/services/level-loader.ts       \u2014 .tmj \u2192 LevelData translator
//   .specify/memory/constitution.md    \u2014 Principles IV + X
// -----------------------------------------------------------------------------

/**
 * Every legal level identifier in the game. Each value MUST appear as a
 * key in {@link LevelRegistry} below. TypeScript enforces parity via the
 * `Record<LevelId, ...>` type on the registry constant.
 */
export type LevelId = "level-01";

/**
 * Iterable form of {@link LevelId}, useful for build-time verifiers
 * (T059) and tests that iterate every level.
 */
export const LEVEL_IDS: readonly LevelId[] = Object.freeze(["level-01"]);

/**
 * The shape of a level entry: a thunk returning a dynamic import that
 * resolves to a module whose `default` export is the level `.tmj` URL.
 *
 * The `?url` query is a Vite directive: at build time the file is
 * fingerprinted, copied into `dist/assets/`, and the module's default
 * export is the resolved URL string.
 */
export type LevelLoader = () => Promise<{ readonly default: string }>;

/**
 * The registry. Every {@link LevelId} maps to a {@link LevelLoader}.
 *
 * BootScene resolves the loader for the requested level, gets the URL,
 * and queues it on Phaser's tilemap loader before transitioning to
 * `LevelScene`.
 */
export const LevelRegistry: Readonly<Record<LevelId, LevelLoader>> = Object.freeze({
  "level-01": () => import("./level-01.tmj?url"),
});

/**
 * Narrow an arbitrary string to a {@link LevelId}, returning `true` if
 * the value is a registered level.
 *
 * @param value - The candidate string (e.g. from a save-state field or
 *   a query parameter).
 * @returns `true` if `value` is a valid level id, `false` otherwise.
 */
export function isLevelId(value: string): value is LevelId {
  return (LEVEL_IDS as readonly string[]).includes(value);
}
