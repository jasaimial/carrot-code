# Phase 1: Data Model

Typed shapes for everything that crosses a boundary (save state, level data, runtime entity configuration). All types live in `src/types/` and are imported by both producers (`src/data/`, `SaveService`) and consumers (scenes, factories). This is the structural enforcement of Constitution Principle IV (data-driven) and Principle XI (serializable state).

## RuntimeMode

```ts
// src/types/runtime-mode.ts
export type RuntimeMode = "single-player-local"; // future: | "multiplayer-host" | ...
```

One value today (Principle XI). The string-literal-union shape means adding a new mode later is a one-line type change, not a refactor.

## EntityConfig

```ts
// src/types/entity-config.ts

/** A patrolling enemy. Avoidance-only per spec FR-014 (no defeat in v0). */
export interface EnemyConfig {
  readonly kind: "enemy";
  readonly id: string;                   // unique within level
  readonly spriteKey: string;            // asset key (declared in AssetService)
  readonly patrol: {
    readonly axis: "horizontal" | "vertical";
    readonly speedPxPerSec: number;
    readonly bounds: {                   // world coordinates
      readonly min: number;
      readonly max: number;
    };
  };
}

/** A collectible carrot. Disappears on contact; resets on level restart. */
export interface CarrotConfig {
  readonly kind: "carrot";
  readonly id: string;
  readonly spriteKey: string;
}

/** Brief-invincibility power-up. */
export interface PowerupConfig {
  readonly kind: "powerup";
  readonly id: string;
  readonly spriteKey: string;
  readonly effect: "invincibility";      // future: | "double-jump" | ...
  readonly durationMs: number;           // exact value tuned in src/config/powerups.ts
}

export type EntityConfig = EnemyConfig | CarrotConfig | PowerupConfig;
```

Discriminated union by `kind` so the entity factory dispatches without a type cast.

## NarratorBeat

```ts
// src/types/narrator-beat.ts (data lives in src/data/narrator-beats.ts)

export interface NarratorBeat {
  readonly id: string;
  readonly trigger: NarratorTrigger;
  readonly text: string;                 // ORIGINAL prose; no copyrighted phrasing per spec FR-029
  readonly dismissable: true;            // always true in v0 (FR-028)
}

export type NarratorTrigger =
  | { kind: "after-spawn"; delayMs: number }
  | { kind: "on-position"; x: number; y: number; radius: number }
  | { kind: "on-event"; event: "first-jump" | "first-carrot" };
```

The `kind`-discriminated trigger lets us add new trigger types without touching the dispatcher (Principle IV).

## LevelData

```ts
// src/types/level.ts

export interface LevelData {
  readonly id: string;                   // matches the file name; used in SaveState
  readonly name: string;                 // human-readable
  readonly tiledMap: object;             // raw Tiled JSON, passed to Phaser tilemap loader
  readonly spawn: { readonly x: number; readonly y: number };
  readonly endTrigger: {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  };
  readonly entities: readonly EntityConfig[];
  readonly narratorBeats: readonly NarratorBeat[];
  readonly assetBudgetBytes: number;     // declared per Principle X; verified at build
}
```

`LevelData` is what the **pure** `level-loader` produces from a Tiled `.tmj` file plus our custom properties on its object layers. `LevelScene` accepts `LevelData` as input — never a file path — which makes both the loader and the scene independently testable (Principle VI).

## SaveState

```ts
// src/types/save-state.ts

export interface SaveState {
  readonly version: 1;                   // bump on breaking schema change
  readonly completedLevelIds: readonly string[];
  readonly lifetimeCarrots: number;
  readonly lastPlayedAtIso: string;      // ISO 8601, written by SaveService
}

export const EMPTY_SAVE_STATE: SaveState = Object.freeze({
  version: 1,
  completedLevelIds: [],
  lifetimeCarrots: 0,
  lastPlayedAtIso: new Date(0).toISOString(),
});
```

**Invariants** (enforced by `SaveService`, verified in `tests/unit/save-service.test.ts`):

- All fields present and of the declared type after `JSON.parse`.
- Unknown `version` → return `EMPTY_SAVE_STATE` and log a warning (forward-compat).
- `completedLevelIds` is deduplicated and sorted on write (deterministic round-trip).
- `lifetimeCarrots ≥ 0` and integer.

This shape is the `JSON.stringify`-able contract Principle XI requires.

## What is NOT in the data model

- **Player** — runtime entity, not data. Owned by the active scene; constructed from `src/config/hero.ts` constants. Not stored in `SaveState` (no in-level checkpoints in v0).
- **Audio cues** — deferred (research.md Q7).
- **Analytics events** — explicit non-goal per Principle XI.
