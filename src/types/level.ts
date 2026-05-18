// -----------------------------------------------------------------------------
// carrot-code — LevelData
//
// What the pure level-loader (T022) produces from a Tiled .tmj file plus
// the custom properties on its object layers. LevelScene accepts
// `LevelData` as input — never a file path — so loader and scene are
// independently testable (Principle VI).
//
// `assetBudgetBytes` is declared per level (Principle X) and verified at
// build by scripts/verify-asset-budgets.mjs (T059).
//
// See:
//   specs/001-vertical-slice/data-model.md#leveldata
//   specs/001-vertical-slice/contracts/level-format.md
//   .specify/memory/constitution.md   — Principles IV + VI + X
// -----------------------------------------------------------------------------

import type { EntityConfig } from "./entity-config.js";
import type { NarratorBeat, NarratorTrigger } from "./narrator-beat.js";

// Re-exports per tasks.md T016: consumers (LevelScene, level-loader) can
// import NarratorBeat / NarratorTrigger from this module without reaching
// into the narrator-beat module directly.
export type { NarratorBeat, NarratorTrigger };

/**
 * A fully-loaded level: tilemap + spawn + end-trigger + entities + beats.
 *
 * Produced by the pure `loadLevel(tiledJson, ...)` function (T022).
 * Consumed by `LevelScene` (T034). All fields are `readonly`; the loader
 * returns a frozen value so scenes cannot accidentally mutate level data
 * mid-run.
 */
export interface LevelData {
  /** Matches the file name; used as a key in SaveState.completedLevelIds. */
  readonly id: string;
  /** Human-readable name for HUD / debug. */
  readonly name: string;
  /** Raw Tiled JSON, passed straight to Phaser's tilemap loader. */
  readonly tiledMap: object;
  /** Hero spawn point in world coordinates. */
  readonly spawn: {
    /** Spawn x in world coordinates. */
    readonly x: number;
    /** Spawn y in world coordinates. */
    readonly y: number;
  };
  /** Rectangular trigger that fires the "level-complete" event on overlap. */
  readonly endTrigger: {
    /** End-trigger x in world coordinates. */
    readonly x: number;
    /** End-trigger y in world coordinates. */
    readonly y: number;
    /** End-trigger width in pixels. */
    readonly w: number;
    /** End-trigger height in pixels. */
    readonly h: number;
  };
  /** Every entity declared on the level's `entities` object layer. */
  readonly entities: readonly EntityConfig[];
  /** Narrator beats authored for this level (may be empty). */
  readonly narratorBeats: readonly NarratorBeat[];
  /** Declared per-level asset budget (Principle X). Verified at build (T059). */
  readonly assetBudgetBytes: number;
}
