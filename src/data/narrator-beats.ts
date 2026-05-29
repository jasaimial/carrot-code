// -----------------------------------------------------------------------------
// carrot-code — narrator beats (level-bound) + post-outcome narrator text
//
// Two related but distinct content sources:
//
// 1. LEVEL-BOUND BEATS (`getNarratorBeatsForLevel`)
//    - Fired by the in-level narrator-trigger system while playing.
//    - Currently only "after-spawn" beats are used (level intros).
//    - Each level has at most a few beats; v0.4 ships intro-only.
//
// 2. POST-OUTCOME LINES (`getPostOutcomeLine`)
//    - One-off narrator text the TreasureScene displays when the player
//      arrives from a level outcome (complete / gameover). Different
//      shape: a single line per outcome, not a list of triggers.
//    - Kept here so all narrator prose lives in one file (single
//      source of truth for Principle I review).
//
// All text is original prose (Constitution Principle I / spec FR-029).
// No copyrighted phrasing.
//
// This module remains data-only: no Phaser imports, no scene
// dependencies, no trigger evaluation logic (lives in
// src/systems/narrator-trigger.ts).
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

const LEVEL_02_BEATS: readonly NarratorBeat[] = Object.freeze([
  Object.freeze({
    id: "level-02-intro",
    trigger: Object.freeze({ kind: "after-spawn", delayMs: 2000 }),
    text: "You earned the second path. Trees overhead, a castle in the distance. Stay light on your feet.",
    dismissable: true,
  }),
]);

/**
 * Read-only narrator beat list for a level id.
 *
 * Returns a stable, frozen array so scenes can safely reuse the value
 * without cloning on each call.
 *
 * @param levelId - The level whose beats are wanted.
 * @returns Frozen array of beats for that level.
 */
export function getNarratorBeatsForLevel(levelId: LevelId): readonly NarratorBeat[] {
  switch (levelId) {
    case "level-01":
      return LEVEL_01_BEATS;
    case "level-02":
      return LEVEL_02_BEATS;
  }
}

/** The two outcomes that produce a post-level narrator line. */
export type PostOutcome = "complete" | "gameover";

/**
 * One-off narrator text the TreasureScene shows when the player arrives
 * from a level outcome. Substitution token `{N}` is replaced by the
 * carrot count the caller passes in.
 *
 * These are NOT level-bound — the same line plays for level-01 and
 * level-02 completion. Intentional: the rule ("what you carry, you
 * keep") is the same in every level; the world rules don't change
 * scene by scene.
 *
 * @param outcome - The outcome the player reached.
 * @returns The post-outcome line. Caller is responsible for
 *   substituting `{N}` if present.
 */
export function getPostOutcomeLine(outcome: PostOutcome): string {
  switch (outcome) {
    case "complete":
      return "Level cleared. Your satchel still holds {N}. That's the rule: what you carry, you keep.";
    case "gameover":
      return "The satchel spills. Carrots roll away. Your gems sit safe in the Treasure Box — that's what they're for.";
  }
}
