# Service interfaces

The TypeScript interfaces that scenes depend on. Concrete implementations live in `src/services/`. This is the structural enforcement of Principle XI's "I/O lives in services, not in scenes" rule.

## SaveService

```ts
// src/services/save-service.ts
export interface SaveService {
  load(): SaveState;
  save(state: SaveState): void;
  clear(): void;
}

export class SaveQuotaExceededError extends Error {}
```

Default implementation: `LocalStorageSaveService` (in the same file). Tests use a `MemorySaveService` fake that implements the same interface — no jsdom needed for `SaveService` tests themselves.

## AssetService

```ts
// src/services/asset-service.ts
export interface AssetService {
  /** All asset declarations (key → URL). The single source of truth for what BootScene preloads. */
  readonly assets: ReadonlyArray<AssetDeclaration>;

  /** Resolved URL for a given key — useful in HUD/UIScene where Phaser keys aren't directly reachable. */
  urlOf(key: string): string;
}

export interface AssetDeclaration {
  readonly key: string;
  readonly type: "image" | "spritesheet" | "tilemap-json";
  readonly url: string;
  readonly approxBytes: number;          // used by the build-time asset-budget verifier
}
```

The `assets` array is the only place Phaser asset keys are declared. `BootScene` iterates it; `AssetService.urlOf()` provides a typed lookup. The asset-budget verifier (a small build-time script) sums `approxBytes` per level and fails the build if it exceeds the level's `assetBudgetBytes` (Principle X).

## What scenes are NOT allowed to do

- Call `localStorage.*` directly. Always go through `SaveService`.
- Call `fetch()` or other network APIs. (No network in v0; if added later, behind a `NetworkService`.)
- Hard-code asset URLs or asset keys. Always go through `AssetService`.
- Mutate `LevelData` (it's frozen by the loader).

These are review-time checks (no automated linter rule for the architectural ones in v0; ESLint covers the lower-level mechanical rules from Principle III).

## What scenes CAN do (per Principle XI's softened wording)

- Use Phaser's `scene.registry` and global `EventEmitter` for in-engine state coordination between scenes (e.g., HUD listening for "carrot collected" events). The "no hidden globals" rule was explicitly dropped from the constitution to allow these framework-blessed idioms.
- Inject a `SaveService` / `AssetService` into a scene via the scene's `init(data)` payload or via `scene.registry.set("saveService", svc)` at game-bootstrap time. Tests construct scenes with fakes the same way.
