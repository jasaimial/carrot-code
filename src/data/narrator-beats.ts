// -----------------------------------------------------------------------------
// carrot-code — narrator beats (T047)
//
// Canonical narrator content for the vertical slice. Beat text must be
// original prose (Constitution Principle I / spec FR-029).
//
// This module is intentionally data-only: no Phaser imports, no scene
// dependencies, no trigger evaluation logic (lands in T048).
// -----------------------------------------------------------------------------

import type { LevelId } from "./levels/index.js";
import type { NarratorBeat } from "../types/level.js";

const LEVEL_01_BEATS: readonly NarratorBeat[] = Object.freeze([
  Object.freeze({
    id: "level-01-intro",
    trigger: Object.freeze({ kind: "after-spawn", delayMs: 2000 }),
    text: "Welcome to your first cartridge run. Keep moving, jump clean, and trust your timing.",
    dismissable: true,
  }),
]);

/**
 * Read-only narrator beat list for a level id.
 *
 * Returns a stable, frozen array so scenes can safely reuse the value
 * without cloning on each call.
 */
export function getNarratorBeatsForLevel(levelId: LevelId): readonly NarratorBeat[] {
  void levelId;
  return LEVEL_01_BEATS;
}
