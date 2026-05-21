# Level format contract

A level is a [Tiled](https://www.mapeditor.org/) `.tmj` (Tiled JSON Map) file plus a small set of **custom properties on object layers** that our level-loader translates into [`LevelData`](../data-model.md#leveldata).

## Tiled side (what the file contains)

Standard Tiled JSON map with at least:

- One **tile layer** named `terrain` — defines collidable ground and walls.
- One **object layer** named `entities` — contains points and rectangles for the spawn, end trigger, and every entity (enemy, carrots, power-up). Custom properties below identify each.

## Custom properties (per object on the `entities` layer)

| Property | Type | Required for | Notes |
|---|---|---|---|
| `kind` | string | every object | One of: `spawn`, `end`, `enemy`, `carrot`, `powerup` |
| `id` | string | enemy / carrot / powerup | Unique within the level |
| `spriteKey` | string | enemy / carrot / powerup | Phaser asset key (declared in `AssetService`) |
| `patrolAxis` | string (`horizontal` \| `vertical`) | enemy | |
| `patrolSpeedPxPerSec` | number | enemy | |
| `patrolMin` | number | enemy | World-coord min in patrol axis |
| `patrolMax` | number | enemy | World-coord max in patrol axis |
| `effect` | string (`invincibility`) | powerup | Future-extensible |
| `durationMs` | number | powerup | |

The `end` object should be a **rectangle**; everything else is a **point**.

## Loader contract

```ts
// src/services/level-loader.ts (pure function — testable per Principle VI)
export function loadLevel(
  tiledJson: object,
  levelId: string,
  levelName: string,
  assetBudgetBytes: number
): LevelData;

export class LevelLoadError extends Error {}
```

**Loader invariants** (verified in `tests/unit/level-loader.test.ts`):

- Throws `LevelLoadError` (with the failing object's name) if any required custom property is missing.
- Throws `LevelLoadError` if no `spawn` object exists or if more than one is found.
- Throws `LevelLoadError` if no `end` object exists.
- Returns a frozen `LevelData` (no caller can mutate the parsed level).
- Does **not** read from disk or network — input is the already-parsed `tiledJson` object.

## Example custom-property block (Tiled JSON excerpt)

```json
{
  "name": "carrot-1", "type": "", "x": 320, "y": 480,
  "properties": [
    { "name": "kind",      "type": "string", "value": "carrot" },
    { "name": "id",        "type": "string", "value": "carrot-1" },
    { "name": "spriteKey", "type": "string", "value": "carrot" }
  ]
}
```
