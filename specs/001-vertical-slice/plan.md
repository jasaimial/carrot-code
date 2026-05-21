# Implementation Plan: Vertical Slice

**Branch**: `001-vertical-slice` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)

## Summary

Ship the project's MVP as defined in [spec.md](./spec.md): one playable level with hero (run + variable-height jump + coyote/buffer), one avoidance-only enemy, three or more carrot collectibles, one invincibility power-up, one narrator dialog beat, HUD (lives / carrots / timer), restartable on game-over, installable as a PWA on desktop / Android / iOS standalone, fully playable offline, deployed to a public HTTPS URL.

The technical approach is a single TypeScript + Vite browser game using **Phaser 3** for the runtime, **Tiled JSON** for level authoring, **vite-plugin-pwa** for service-worker / manifest generation, **localStorage** for save state, **Vitest** for unit tests, and **GitHub Actions → Netlify** for CI and deployment. Architecture enforces Constitution Principle IV (data-driven extensibility) by routing all level and entity definitions through typed config files consumed by generic factories and a generic `LevelScene`; new levels and new entity types require zero scene-code changes.

## Technical Context

**Language/Version**: TypeScript 5.x with `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`. Target ES2022. No JavaScript source files (Constitution Tech Constraints).

**Primary Dependencies**:

- Game runtime: `phaser` ^3.80
- Build / dev server: `vite` ^5.x
- PWA: `vite-plugin-pwa` ^0.x (Workbox-based service worker)
- Testing: `vitest` ^1.x, `@vitest/coverage-v8`, `jsdom` (only for tests touching DOM globals)
- Linting / formatting: `eslint` ^9 (flat config), `typescript-eslint`, `prettier` ^3, `eslint-plugin-prettier`

Explicit non-goals: no UI framework, no state-management library, no DI container.

**Storage**: Browser `localStorage` for save state via a typed `SaveService` wrapper. Single key (`carrot-code:v1:save`), versioned JSON payload. No IndexedDB, no server-side state.

**Testing**: Vitest with two environments — `node` for pure logic (default), `jsdom` only for tests that touch DOM. Per Principle VI: every spec acceptance criterion that depends on pure-logic code (loaders, helpers, services) gets a unit test. Coverage reported, never gated.

**Target Platform**:

- Desktop: latest stable Chromium (Chrome, Edge), Firefox, Safari (latest two major versions of each)
- Mobile: latest stable Chrome on Android, Safari on current-generation iPhone
- PWA install: native prompt on Chromium / Android Chrome; "Add to Home Screen" with full standalone-mode support on iOS (custom icon, splash screen, no browser chrome — per spec FR-034 and Constitution Principle V)

**Project Type**: Single-project SPA (browser game). No backend, no separate frontend/backend split.

**Performance Goals**: Sustained 60 FPS during normal gameplay on the constitution's baseline hardware (2020-era integrated-graphics laptop; 2022-era mid-range Android phone; current-generation iPhone). Per-level asset-payload budget: **≤ 2 MB total** (sprites + tilemap atlas + JSON; excludes optional audio). Cold-load to playable in < 5 s offline on baseline mobile (matches spec SC-004).

**Constraints**:

- Public-facing PWA on HTTPS — must work behind common ISP / corporate proxies
- iOS standalone-mode quirks: requires the `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, and `apple-touch-startup-image` meta-tag set for chromeless launch + splash; `vite-plugin-pwa` is configured to emit them
- No telemetry / accounts / network calls beyond initial asset fetch (Constitution Principle XI; spec assumption)
- Single deployable artifact: `dist/` is shipped as static files

**Scale/Scope**: Single user, single device, single level for v0. Estimated surface area: ~12–15 source files, ~6–8 test files, 1 Tiled JSON level, ~30 sprite frames + 1 tilemap atlas. CI build target: < 30 s end-to-end.

## Constitution Check

*Gate: must pass before Phase 0 research. Re-checked after Phase 1 design (no changes — all principles still pass).*

| # | Principle | Verdict | Notes |
|---|---|---|---|
| I | Original IP Only | ✅ | Plan references only Kenney.nl CC0 placeholder assets and our original code, data, and narrator prose. Asset attribution lives in `public/assets/CREDITS.md`. |
| II | Spec-First, Always | ✅ | Every technical choice in this plan derives from a requirement in [spec.md](./spec.md); no scope additions. |
| III | Production-Quality Code From v0 | ✅ | TS strict + ESLint flat config + Prettier + `src/config/` for tuning constants are first-PR deliverables. No-secrets rule honored: no environment-based secrets needed in v0; `.env` files are gitignored regardless. |
| IV | Data-Driven & Extensible | ✅ | Single generic `LevelScene` consumes Tiled JSON; `src/data/levels/index.ts` is the level registry; `EnemyConfig` / `CarrotConfig` / `PowerupConfig` types drive generic factories. Adding level 2 = drop in `level-02.tmj` + add one line to the registry. |
| V | Vertical Slice Before Breadth | ✅ | Plan implements exactly the spec's 4 stories. No level-2 scaffolding, no extra entity types, no future-feature plumbing beyond Principle XI's serializable-state discipline. |
| VI | Tested Where It Matters | ✅ | Vitest configured; pure-logic test list enumerated in Project Structure (`tests/unit/`). Manual playtest checklist will be appended to spec before merge. Coverage reported, not gated. |
| VII | Free / Open Assets Only | ✅ | Kenney.nl CC0 packs are the v0 baseline; `public/assets/CREDITS.md` records source + license per asset. |
| VIII | Ships From Day One | ✅ | First implementation PR includes `.github/workflows/ci.yml` (typecheck + lint + test + build) and `netlify.toml`. Netlify auto-deploys `main`. Branch protection on `main` configured on first push to GitHub (per Principle VIII's softened wording). |
| IX | Readable Over Clever | ✅ | No clever abstractions in plan. ESLint enforces JSDoc on exports. |
| X | Performance Is A Feature | ✅ | Phaser 3 WebGL renderer comfortably hits 60 FPS for 2D pixel-art at the spec's scope on baseline hardware. Per-level asset budget declared above (≤ 2 MB) and verified by a tiny build-time script. Dev build enables Phaser's `showFPS` overlay; production hides it. |
| XI | Don't Build The Future, Don't Preclude It Either | ✅ | `SaveState` is JSON-serializable and schema-checked at the service boundary. `Player` is an instance owned by the active scene, never a global. `RuntimeMode` is a string-literal type with one value today (`"single-player-local"`). I/O lives in `src/services/`; scenes never call `localStorage` or `fetch` directly. Phaser's `registry` and global event emitter are used freely for in-engine state coordination per the softened wording. |

**Result**: All 11 principles pass. **Complexity Tracking section omitted** (no violations to justify).

## Project Structure

### Documentation (this feature)

```text
specs/001-vertical-slice/
├── spec.md                       # Feature spec (already committed)
├── plan.md                       # This file
├── research.md                   # Phase 0: tech-choice rationale & alternatives
├── data-model.md                 # Phase 1: typed entity & save-state shapes
├── quickstart.md                 # Phase 1: clone → run → test → build
├── contracts/
│   ├── README.md                 # What "contracts" means in a game context
│   ├── level-format.md           # Tiled JSON + our custom properties
│   ├── save-state.md             # SaveState shape + JSON example + invariants
│   └── services.md               # SaveService / AssetService TS interfaces
├── checklists/
│   └── requirements.md           # Spec quality checklist (already committed)
└── tasks.md                      # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── config/                       # typed gameplay constants (Principle III)
│   ├── physics.ts                #   gravity, max-velocity, friction
│   ├── hero.ts                   #   move-speed, jump-velocity, coyote/buffer ms
│   ├── enemy.ts                  #   patrol speed, hit/respawn timing
│   ├── powerups.ts               #   invincibility duration
│   └── ui.ts                     #   HUD positions, dialog timings
├── data/                         # typed runtime data (Principle IV)
│   ├── levels/
│   │   ├── level-01.tmj          # Tiled JSON export
│   │   └── index.ts              # LevelRegistry (id → JSON import)
│   └── narrator-beats.ts         # narrator dialog content (typed array)
├── types/                        # shared type declarations
│   ├── entity-config.ts
│   ├── level.ts
│   ├── runtime-mode.ts
│   └── save-state.ts
├── services/                     # I/O isolation (Principle XI)
│   ├── save-service.ts           # localStorage wrapper; round-trips SaveState
│   ├── asset-service.ts          # central asset URL/key registry
│   └── level-loader.ts           # pure: Tiled JSON → LevelData (testable)
├── systems/                      # cross-cutting pure logic
│   ├── coyote-time.ts            # ledge-grace state machine (pure)
│   ├── jump-buffer.ts            # input-buffer state machine (pure)
│   └── physics-helpers.ts        # vector / contact math (pure)
├── entities/                     # typed factories
│   ├── hero.ts
│   ├── enemy.ts
│   └── pickup.ts                 # factory handles both carrot and power-up via config
├── scenes/
│   ├── BootScene.ts              # asset preload + warm cache
│   ├── MenuScene.ts              # main menu / play
│   ├── LevelScene.ts             # generic level renderer (Tiled-driven)
│   ├── UIScene.ts                # HUD + narrator dialog + touch controls + FPS overlay
│   └── GameOverScene.ts
├── pwa.ts                        # iOS detection, install-prompt orchestration
├── game.ts                       # Phaser game config + scene registration
└── main.ts                       # Vite entry → mounts game

public/
├── manifest.webmanifest          # generated/augmented by vite-plugin-pwa
├── icons/                        # PWA + apple-touch icons (multiple sizes)
├── splash/                       # iOS apple-touch-startup-image set
└── assets/
    ├── sprites/                  # Kenney CC0 sprites + atlas JSON
    ├── tilemaps/                 # Tiled tileset images
    └── CREDITS.md                # asset source + license per Principle VII

tests/
└── unit/
    ├── save-service.test.ts      # round-trip, version handling, schema
    ├── coyote-time.test.ts       # state-machine transitions
    ├── jump-buffer.test.ts       # buffer window, consume-on-land
    ├── level-loader.test.ts      # Tiled JSON → LevelData parsing
    ├── physics-helpers.test.ts   # contact math
    └── narrator-beats.test.ts    # trigger evaluation

.github/
└── workflows/
    └── ci.yml                    # typecheck + lint + test + build

config files at root:
├── tsconfig.json                 # strict mode, no any
├── vite.config.ts                # Vite + vite-plugin-pwa config
├── vitest.config.ts              # node default, jsdom for DOM tests
├── eslint.config.js              # flat config, typescript-eslint, prettier
├── .prettierrc
├── .gitattributes                # LF line endings
├── netlify.toml                  # build command + headers (immutable assets, basic CSP)
└── package.json                  # scripts: dev, build, preview, test, lint, format, typecheck
```

**Structure Decision**: Single-project SPA layout (Option 1 from the template). The `services/` and `systems/` separation is the structural enforcement of Principle XI's I/O-isolation rule and Principle III's design-discipline bullets. The `config/` and `data/` split is the structural enforcement of Principle IV.

## Complexity Tracking

*No constitution violations. Section intentionally empty.*
