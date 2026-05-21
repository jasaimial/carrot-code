# Contracts

In a typical web service, "contracts" describe HTTP request/response shapes. `carrot-code` has no backend, so the equivalent contracts here describe **the boundaries between layers that cross a serialization or interface seam**:

| Contract | Boundary it governs | File |
|---|---|---|
| **Level format** | Tiled JSON file → `LevelData` (consumed by `LevelScene`) | [level-format.md](./level-format.md) |
| **Save state** | `localStorage` ↔ `SaveService` ↔ scenes | [save-state.md](./save-state.md) |
| **Services** | TypeScript interfaces between scenes and I/O modules | [services.md](./services.md) |

Each contract is the source of truth that:

- The producer must satisfy (asset pipeline, `SaveService` writer, etc.)
- The consumer can rely on (scenes, factories, etc.)
- Tests assert against (Vitest unit tests in `tests/unit/`)

When a contract changes, the spec changes first (Constitution Principle II), then this contract, then the implementation, then the tests.
