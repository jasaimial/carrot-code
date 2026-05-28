// -----------------------------------------------------------------------------
// carrot-code — SaveState (v2)
//
// The JSON-serializable contract for persisted player progress. Every field
// is `readonly` because save state is treated as immutable at the boundary;
// SaveService produces a new value rather than mutating in place.
//
// v2 SCHEMA (2026-05-27): introduces the Treasure Box economy.
//
//   - `profileHandle`: the player-chosen display name (e.g. "speedy").
//     Storage keying uses a hash of (handle + recovery phrase); the
//     handle alone is kept here for display purposes only.
//   - `currentCarrots`: carrots currently in the player's satchel.
//     Carries across levels. Lost entirely on hero death.
//   - `gems`: persistent valuable in the Treasure Box. Survives death.
//     Hard-capped at MAX_GEMS_PER_PROFILE — the world contains only
//     so many gems.
//   - `abilities`: persistent list of owned ability identifiers
//     (e.g. ["bunny-hop"]). Permanent once purchased.
//   - `completedLevelIds`: unchanged from v1. Set of finished level ids.
//   - `lastPlayedAtIso`: ISO 8601, written by SaveService.
//
// v1 → v2 migration (automatic on first load):
//   - lifetimeCarrots → gems (best semantic match: "existing wealth")
//   - currentCarrots starts at 0
//   - abilities starts empty
//   - profileHandle defaults to "guest"
//   - completedLevelIds + lastPlayedAtIso pass through unchanged
//
// Invariants (enforced by SaveService, verified in
// tests/unit/save-service.test.ts):
//   - All fields present and of the declared type after JSON.parse.
//   - Unknown / future `version` → return EMPTY_SAVE_STATE and log a warning.
//   - `completedLevelIds` is deduplicated and sorted on write.
//   - `currentCarrots ≥ 0` integer.
//   - `gems ≥ 0` integer AND `gems ≤ MAX_GEMS_PER_PROFILE`.
//   - `abilities` is a deduplicated sorted array of strings on write.
//   - `profileHandle` is a non-empty string.
//
// See:
//   specs/001-vertical-slice/data-model.md#savestate
//   specs/001-vertical-slice/contracts/save-state.md
//   .specify/memory/constitution.md   — Principle XI (serializable state)
// -----------------------------------------------------------------------------

/**
 * Hard cap on gems held by a single profile. A world rule, not a UX
 * affordance: the universe contains exactly this many gems and no
 * mechanic in the game may mint a (cap + 1)-th gem.
 */
export const MAX_GEMS_PER_PROFILE = 21_000_000;

/**
 * Persisted player progress (v2 schema). JSON-serializable by construction.
 *
 * Treated as immutable: SaveService returns new SaveState values rather
 * than mutating an existing one. Bump `version` on any breaking schema
 * change; the loader will fall back to `EMPTY_SAVE_STATE` on unknown
 * versions (forward-compatible).
 */
export interface SaveState {
  /** Schema version; bump on any breaking change. */
  readonly version: 2;
  /** Player-chosen display name. Storage keying uses a hash of this + the recovery phrase. */
  readonly profileHandle: string;
  /** Carrots in the satchel. Carries across levels; lost on death. */
  readonly currentCarrots: number;
  /** Persistent valuables in the Treasure Box. Hard-capped at MAX_GEMS_PER_PROFILE. */
  readonly gems: number;
  /** Owned ability identifiers. Permanent once purchased. */
  readonly abilities: readonly string[];
  /** Level IDs the player has finished at least once; deduped + sorted on write. */
  readonly completedLevelIds: readonly string[];
  /** ISO 8601 timestamp of the last write, in UTC. */
  readonly lastPlayedAtIso: string;
}

/**
 * The empty / "first launch" save state. Frozen so accidental mutation
 * throws in strict mode rather than silently corrupting future loads.
 *
 * `lastPlayedAtIso` is the Unix epoch as an explicit sentinel; SaveService
 * overwrites it on first real save.
 *
 * `profileHandle` defaults to "guest" — the v1→v2 migration path and the
 * first-launch path both flow through this default. The MenuScene profile
 * picker (separate work) lets the player rename + secure-with-phrase.
 */
export const EMPTY_SAVE_STATE: SaveState = Object.freeze({
  version: 2,
  profileHandle: "guest",
  currentCarrots: 0,
  gems: 0,
  abilities: Object.freeze<string[]>([]),
  completedLevelIds: Object.freeze<string[]>([]),
  lastPlayedAtIso: new Date(0).toISOString(),
});

/**
 * Shape of a v1-era save payload. Kept here only for the v1→v2 migration
 * helper in SaveService. New code should never reference this type.
 *
 * @deprecated v1 is read-only legacy; all writes go through {@link SaveState}.
 */
export interface SaveStateV1 {
  readonly version: 1;
  readonly completedLevelIds: readonly string[];
  readonly lifetimeCarrots: number;
  readonly lastPlayedAtIso: string;
}
