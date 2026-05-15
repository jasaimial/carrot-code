# Save state contract

The shape `SaveService` writes to and reads from `localStorage`. This is the project's serializable-state seam (Constitution Principle XI).

## Storage location

Single key: `carrot-code:v1:save`

The `:v1:` segment is **the storage-key version**, distinct from the in-payload `version` field. Bump the key segment only for migrations the loader cannot perform in-place.

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
