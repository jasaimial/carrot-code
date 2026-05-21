# Save state contract

The shape `SaveService` writes to and reads from `localStorage`. This is the project's serializable-state seam (Constitution Principle XI).

## Storage location

Single key: `carrot-code:v1:save`

The `:v1:` segment is **the storage-key version**, distinct from the in-payload `version` field. Bump the key segment only for migrations the loader cannot perform in-place.

## Versioning protocol (two concepts, one slot each)

There are two version concepts in the save subsystem. They handle different magnitudes of change and have different ergonomics. Keep them straight.

| Version | Where | Bumped when | How returning players are handled |
| --- | --- | --- | --- |
| **Payload version** — `version: 1` inside the JSON | the payload itself | the schema changes (field added/removed/renamed, semantics shifted) | the loader migrates `vN → vCURRENT` in place, returning a valid current-version `SaveState` |
| **Storage-key version** — `:v1:` in `carrot-code:v1:save` | the localStorage key | the schema change is so big that an in-place migration isn't possible (e.g., a different storage backend, or completely incompatible data) | the new code reads/writes a new key; old data is orphaned but recoverable from devtools |

**Today (v0) the loader is strict, not migrating.** Any payload `version !== 1` falls back to `EMPTY_SAVE_STATE`. So a returning v1 player on a future v2 build will lose progress.

**When the next schema bump ships**, `load()` should grow a migration step like:

```ts
function migrate(parsed: { version: number; [k: string]: unknown }): SaveState {
  if (parsed.version === CURRENT_SCHEMA_VERSION) return parsed as SaveState;
  if (parsed.version === 1) return migrateV1ToV2(parsed);
  if (parsed.version > CURRENT_SCHEMA_VERSION) {
    // Forward-incompatible: a future build wrote this. Refuse rather than corrupt.
    return EMPTY_SAVE_STATE;
  }
  // Older than anything we know how to migrate from: treat as empty.
  return EMPTY_SAVE_STATE;
}
```

Where `migrateV1ToV2` is responsible for filling in any new fields with sensible defaults. The migration MUST be covered by a new test case (e.g., `"migrates v1 payload to v2 with defaulted fields"`).

**Bump the storage-key segment (`:v1:` → `:v2:`) only when** the migration step would be impossible or risky — e.g., switching from `localStorage` to `IndexedDB`, or when the user-facing data model changes so drastically that "starting over" is the safest outcome.

## Payload shape

See [`SaveState` in data-model.md](../data-model.md#savestate). Reproduced here for contract clarity:

```ts
export interface SaveState {
  readonly version: 1;
  readonly completedLevelIds: readonly string[];
  readonly lifetimeCarrots: number;
  readonly lastPlayedAtIso: string;
}
```

## Example payload (JSON)

```json
{
  "version": 1,
  "completedLevelIds": ["level-01"],
  "lifetimeCarrots": 47,
  "lastPlayedAtIso": "2026-05-14T22:30:00.000Z"
}
```

## SaveService responsibilities (the contract)

| Operation | Behaviour |
|---|---|
| `load()` | Return the parsed `SaveState` if present and valid. Return `EMPTY_SAVE_STATE` if absent, malformed, or with an unknown `version`. **Never throws.** |
| `save(state)` | Validate against the schema. Sort `completedLevelIds` and dedupe. Write `JSON.stringify(state)` to the storage key. Throw `SaveQuotaExceededError` if `setItem` throws (e.g., quota / private mode). |
| `clear()` | Remove the storage key. |

All three operations are **synchronous** by virtue of `localStorage` being synchronous; this matches the rest of the game loop.

## Test coverage (`tests/unit/save-service.test.ts`)

- Round-trip: any valid `SaveState` → `save` → `load` → equal.
- Empty: missing key → `load()` returns `EMPTY_SAVE_STATE`.
- Malformed JSON in storage → `load()` returns `EMPTY_SAVE_STATE` and emits a warning.
- Unknown `version` → `load()` returns `EMPTY_SAVE_STATE` and emits a warning.
- Dedupe + sort: `completedLevelIds: ["b", "a", "a"]` is persisted as `["a", "b"]`.
- Quota exhaustion: simulated `setItem` throw → `save()` raises `SaveQuotaExceededError`.
