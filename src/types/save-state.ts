// -----------------------------------------------------------------------------
// carrot-code — SaveState
//
// The JSON-serializable contract for persisted player progress. Every field
// is `readonly` because save state is treated as immutable at the boundary;
// SaveService produces a new value rather than mutating in place.
//
// Invariants (enforced by SaveService, verified in
// tests/unit/save-service.test.ts when T019/T020 land):
//   - All fields present and of the declared type after JSON.parse.
//   - Unknown `version` → return EMPTY_SAVE_STATE and log a warning.
//   - `completedLevelIds` is deduplicated and sorted on write.
//   - `lifetimeCarrots ≥ 0` and integer.
//
// See:
//   specs/001-vertical-slice/data-model.md#savestate
//   specs/001-vertical-slice/contracts/save-state.md
//   .specify/memory/constitution.md   — Principle XI (serializable state)
// -----------------------------------------------------------------------------

/**
 * Persisted player progress. JSON-serializable by construction.
 *
 * Treated as immutable: SaveService returns new SaveState values rather
 * than mutating an existing one. Bump `version` on any breaking schema
 * change; the loader will fall back to `EMPTY_SAVE_STATE` on unknown
 * versions (forward-compatible).
 */
export interface SaveState {
  /** Schema version; bump on any breaking change. */
  readonly version: 1;
  /** Level IDs the player has finished at least once; deduped + sorted on write. */
  readonly completedLevelIds: readonly string[];
  /** Lifetime carrot count across all sessions. Non-negative integer. */
  readonly lifetimeCarrots: number;
  /** ISO 8601 timestamp of the last write, in UTC. */
  readonly lastPlayedAtIso: string;
}

/**
 * The empty / "first launch" save state. Frozen so accidental mutation
 * throws in strict mode rather than silently corrupting future loads.
 *
 * `lastPlayedAtIso` is the Unix epoch as an explicit sentinel; SaveService
 * overwrites it on first real save.
 */
export const EMPTY_SAVE_STATE: SaveState = Object.freeze({
  version: 1,
  completedLevelIds: Object.freeze<string[]>([]),
  lifetimeCarrots: 0,
  lastPlayedAtIso: new Date(0).toISOString(),
});
