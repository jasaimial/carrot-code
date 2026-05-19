# Tasks: Vertical Slice

**Input**: Design documents from `/specs/001-vertical-slice/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **Included** — Constitution Principle VI requires Vitest unit tests for all pure-logic modules. Test tasks below are not optional for this project. Manual playtest verification (per Principle VI's gameplay-feel rule) lives at the end of each user story phase.

**Organization**: Tasks are grouped by user story to enable independent implementation, testing, and demoability per the spec's P1–P4 prioritization. Within each story, the order is **types → tests → implementation → integration**.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on other in-flight tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4) or `[SETUP]` / `[FND]` / `[POLISH]`
- File paths shown are exact and match the structure in [plan.md](./plan.md#project-structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the project scaffolding and CI gates before any feature work.

- [ ] **T001 [SETUP]** Initialize `package.json` at repo root with `name: "carrot-code"`, `type: "module"`, `private: true`, scripts (`dev`, `build`, `preview`, `test`, `test:watch`, `test:coverage`, `lint`, `format`, `format:check`, `typecheck`), and dev-only `engines.node` ≥ 20.
- [ ] **T002 [P] [SETUP]** Create `tsconfig.json` with `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "Bundler"`, `noEmit: true`. Constitution Principle III.
- [ ] **T003 [P] [SETUP]** Add `vite.config.ts` with `vite-plugin-pwa` registered (Workbox preset), `manifest` block declaring `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `theme_color`, `background_color`, and the icon set (paths under `public/icons/`). Spec FR-032/033/034/035, plan research Q2.
- [ ] **T004 [P] [SETUP]** Add `vitest.config.ts` defaulting to `node` environment with a per-test override pattern enabling `jsdom` for tests under `tests/unit/dom/` (none yet, but the seam exists). Plan Technical Context.
- [ ] **T005 [P] [SETUP]** Add `eslint.config.js` (flat config) with `typescript-eslint` strict rules, `eslint-plugin-prettier`, and a custom rule (or one-line override) requiring JSDoc on exported declarations. Constitution Principles III + IX.
- [ ] **T006 [P] [SETUP]** Add `.prettierrc`, `.prettierignore`, `.gitattributes` (LF line endings), and an `.editorconfig`.
- [ ] **T007 [P] [SETUP]** Update repo `.gitignore` to add `dist/`, `coverage/`, `.vite/`, `*.tsbuildinfo`, `dev-dist/` (vite-plugin-pwa output).
- [ ] **T008 [SETUP]** Install dependencies via a single `npm install` of: `phaser`, `vite`, `vite-plugin-pwa`, `vitest`, `@vitest/coverage-v8`, `jsdom`, `typescript`, `eslint`, `typescript-eslint`, `prettier`, `eslint-plugin-prettier`, `eslint-config-prettier`. Commit the resulting `package-lock.json`. (Depends on T001.)
- [ ] **T009 [SETUP]** Create `.github/workflows/ci.yml`: single job, Node 20 LTS, `npm ci` → `npm run typecheck` → `npm run lint` → `npm test -- --coverage` → `npm run build`. Upload coverage HTML as a workflow artifact. Constitution Principle VIII.
- [ ] **T010 [P] [SETUP]** Create `netlify.toml` at repo root: `build = "npm run build"`, `publish = "dist"`, headers block setting `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`, and a basic CSP that allows `'self'` + Phaser's WebGL needs. Plan research Q6.
- [ ] **T011 [P] [SETUP]** Add a minimal repo-root `README.md` that points readers at [docs/learning/](../../docs/learning/) and the live deploy URL (placeholder until first deploy). Constitution Principle IX.

**Checkpoint**: `npm install && npm run typecheck && npm run lint && npm test && npm run build` all succeed on an empty source tree (no `src/` files yet — TS will pass with no inputs; Vitest will pass with no tests; Vite will fail until T012). T012 unblocks the build.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The minimum source-tree skeleton + typed contracts + services that EVERY user story will depend on. After this phase, US1–US4 can in principle be worked in parallel (though for a solo project we'll do them in priority order).

- [ ] **T012 [FND]** Create `src/main.ts` (Vite entry: imports `game` and mounts it on a `#game` div in `index.html`) and `index.html` at repo root with the `#game` mount point, viewport meta tag, and the iOS-specific meta tags (`apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-touch-icon`, `apple-touch-startup-image` set). Spec FR-034, plan Constraints.
- [ ] **T013 [P] [FND]** Create `src/types/runtime-mode.ts`: the `RuntimeMode` string-literal union with one value (`"single-player-local"`). [data-model.md](./data-model.md#runtimemode), Constitution Principle XI.
- [ ] **T014 [P] [FND]** Create `src/types/save-state.ts`: the `SaveState` interface and `EMPTY_SAVE_STATE` frozen constant exactly as in [data-model.md](./data-model.md#savestate).
- [ ] **T015 [P] [FND]** Create `src/types/entity-config.ts`: `EnemyConfig`, `CarrotConfig`, `PowerupConfig`, and the `EntityConfig` discriminated union exactly as in [data-model.md](./data-model.md#entityconfig).
- [ ] **T016 [P] [FND]** Create `src/types/level.ts`: the `LevelData` interface and a `NarratorBeat` / `NarratorTrigger` re-export. [data-model.md](./data-model.md#leveldata).
- [ ] **T017 [P] [FND]** Create `src/types/narrator-beat.ts`: the `NarratorBeat` interface and `NarratorTrigger` discriminated union. [data-model.md](./data-model.md#narratorbeat).
- [ ] **T018 [P] [FND]** Create `src/config/physics.ts`, `src/config/hero.ts`, `src/config/enemy.ts`, `src/config/powerups.ts`, `src/config/ui.ts` — each a typed `as const` export of the constants named in [plan.md](./plan.md#project-structure). Initial values are well-commented placeholders to be tuned in playtest. Constitution Principle III (no magic numbers).
- [ ] **T019 [P] [FND]** Create `tests/unit/save-service.test.ts` covering all six cases listed in [contracts/save-state.md](./contracts/save-state.md#test-coverage-testsunitsave-servicetestts). All tests MUST FAIL initially (no implementation yet).
- [ ] **T020 [FND]** Create `src/services/save-service.ts`: `SaveService` interface, `SaveQuotaExceededError` class, `LocalStorageSaveService` implementation, and exported `MemorySaveService` for tests. Make T019's tests pass. [contracts/services.md](./contracts/services.md#saveservice).
- [ ] **T021 [P] [FND]** Create `tests/unit/level-loader.test.ts` covering all loader invariants from [contracts/level-format.md](./contracts/level-format.md#loader-contract): rejects missing required custom properties, rejects 0 or 2+ `spawn` objects, rejects missing `end` object, returns frozen `LevelData`. Tests MUST FAIL initially.
- [ ] **T022 [FND]** Create `src/services/level-loader.ts`: pure `loadLevel(tiledJson, levelId, levelName, assetBudgetBytes): LevelData` function and `LevelLoadError` class. Make T021's tests pass. [contracts/level-format.md](./contracts/level-format.md#loader-contract).
- [ ] **T023 [P] [FND]** Create `src/services/asset-service.ts`: the `AssetService` interface, `AssetDeclaration` type, and a concrete `KennyAssetService` whose `assets` array starts empty (entries land per user story). [contracts/services.md](./contracts/services.md#assetservice).
- [ ] **T024 [P] [FND]** Create `tests/unit/coyote-time.test.ts` and `src/systems/coyote-time.ts` together (test-first within the file pair): a pure state machine `update(dt, isOnGround): "grounded" | "coyote" | "airborne"`. Spec assumption (~100 ms grace), Constitution Principle VI.
- [ ] **T025 [P] [FND]** Create `tests/unit/jump-buffer.test.ts` and `src/systems/jump-buffer.ts`: pure state machine `pressed(now)` / `consumeIfBuffered(now): boolean`. Spec assumption (~100 ms buffer).
- [ ] **T026 [P] [FND]** Create `tests/unit/physics-helpers.test.ts` and `src/systems/physics-helpers.ts`: pure vector / contact math used by entities and the level scene.
- [ ] **T027 [FND]** Create `src/game.ts`: Phaser game config (WebGL renderer; pixelArt true; `physics.default = "arcade"`; `scale.mode = FIT`; `dom.createContainer = false`; FPS overlay enabled in dev only via `import.meta.env.DEV`). Registers BootScene + MenuScene + LevelScene + UIScene + GameOverScene as **stubs** (each scene is a 5-line file that just calls `this.add.text(0,0,"<sceneName> stub")`). Constitution Principle X (FPS overlay).

**Checkpoint**: `npm test` runs the unit tests for all pure logic and they pass. `npm run dev` opens a window showing "BootScene stub" or similar. CI is green. **No game yet — but the foundation is solid and every user story below builds on tested primitives.**

---

## Phase 3: User Story 1 — Play through a level (Priority: P1) 🎯 MVP-floor

**Goal**: Player can move, jump (variable height + coyote + buffer), reach the level-end trigger, and see "level complete." Touch controls work on mobile.

**Independent Test**: Open `npm run dev`, walk + jump from spawn to end-trigger using keyboard. Same on a touch device using on-screen controls. See spec [Story 1 acceptance scenarios](./spec.md#user-story-1--play-through-a-level-priority-p1).

### Tests for User Story 1

- [ ] **T037 [US1]** Append a Manual Playtest Checklist to [spec.md](./spec.md) under Story 1 (or create `specs/001-vertical-slice/playtests/us1.md`): keyboard play-through, touch play-through, jump arc feels right, coyote/buffer feel right, end-trigger fires. Constitution Principle VI.

### Implementation for User Story 1

> Note: T028 was originally a vacuous narrator-test placeholder in this phase. It has been **moved to Phase 5 (User Story 3)** where the narrator implementation actually lives. See T028 below in Phase 5.

- [ ] **T029 [US1]** Author `src/data/levels/level-01.tmj` in Tiled: a small horizontal level with at least one elevated platform (FR-009), a `spawn` point object, a rectangular `end` trigger, ground tiles, and a CC0 tileset image referenced from `public/assets/tilemaps/`. Source tileset from Kenney.nl; **record the exact pack name(s) and download date in `public/assets/CREDITS.md`** for reproducibility per Constitution Principle VII. Constitution Principles I + IV + VII.
- [ ] **T030 [P] [US1]** Create `src/data/levels/index.ts` — typed `LevelRegistry` exporting `{ "level-01": () => import("./level-01.tmj?url") }`. Adding level 2 later = one line. Constitution Principle IV.
- [ ] **T031 [P] [US1]** Add Kenney CC0 hero spritesheet (idle + run + jump frames) under `public/assets/sprites/hero/`. Update `KennyAssetService.assets` (T023) with declarations for hero sprite + tileset. Update `public/assets/CREDITS.md` with attribution.
- [ ] **T032 [US1]** Implement `src/scenes/BootScene.ts`: iterates `assetService.assets` and calls the matching Phaser loader (`load.image` / `load.spritesheet` / `load.tilemapTiledJSON`). Emits a simple progress text. Transitions to `LevelScene` on complete (skipping MenuScene for the slice; MenuScene can be a stub for now).
- [ ] **T033 [US1]** Implement `src/entities/hero.ts`: factory `createHero(scene, x, y, config)` that returns a typed `Hero` runtime object wrapping a Phaser arcade sprite. State machine wired to `coyote-time` and `jump-buffer` modules from T024/T025. Variable-height jump implemented by zeroing upward velocity on jump-key release (FR-003). Constitution Principle XI ("`Player` is an instance, not a global").
- [ ] **T034 [US1]** Implement `src/scenes/LevelScene.ts` — generic, level-data-driven: `init(data: { levelId: string })` looks up `LevelData` via `level-loader` + `LevelRegistry`, builds the tilemap, places the hero at `data.spawn`, registers the end-trigger overlap, and on overlap emits an `event: "level-complete"` to the scene registry. NO entities yet beyond the hero (US2 adds them). Constitution Principle IV.
- [ ] **T035 [US1]** Implement `src/scenes/UIScene.ts` (parallel scene, runs above LevelScene): renders touch controls when `scene.sys.game.device.input.touch === true` (left half = movement zone, right side = jump button). Forwards touch events as the same Phaser keyboard-style events the hero already listens to. **Lock orientation to landscape on phones**: set `orientation: "landscape"` in the PWA manifest (T003/T054) and call `screen.orientation.lock("landscape")` on first user gesture, swallowing the rejection on browsers that disallow it (e.g., desktop, iOS Safari). Spec FR-006, plan research Q4.
- [ ] **T036 [US1]** Implement `src/scenes/GameOverScene.ts` (used by US2, but the "level complete" outcome from US1 also routes here in a "complete" mode): displays the outcome text and a "Play again" button that restarts `LevelScene` with the same `levelId`. Spec Story 1 acceptance #4.
- [ ] **T037 [US1]** Append a Manual Playtest Checklist to [spec.md](./spec.md) under Story 1 (or create `specs/001-vertical-slice/playtests/us1.md`): keyboard play-through, touch play-through, jump arc feels right, coyote/buffer feel right, end-trigger fires. Constitution Principle VI.

**Checkpoint**: A first-time player can load `npm run dev`, walk + jump from spawn to the end-trigger, and see "Level complete" with a Play-again button. Same works in touch mode. **Spec Story 1 (P1) is independently demoable.**

---

## Phase 4: User Story 2 — Face stakes and gather rewards (Priority: P2)

**Goal**: Add enemy (avoidance-only), three+ carrots, one invincibility power-up, lives + game-over, HUD.

**Independent Test**: Same level, with enemy + carrots + power-up + HUD. See spec [Story 2 acceptance scenarios](./spec.md#user-story-2--face-stakes-and-gather-rewards-priority-p2).

### Implementation for User Story 2

- [ ] **T038 [US2]** Update `src/data/levels/level-01.tmj` (in Tiled): add one `enemy` object (with patrol bounds), three or more `carrot` objects, one `powerup` object — each with the custom properties defined in [contracts/level-format.md](./contracts/level-format.md#custom-properties-per-object-on-the-entities-layer). Update tileset / sprite references and `CREDITS.md` if any new Kenney assets are added.
- [ ] **T039 [P] [US2]** Implement `src/entities/enemy.ts`: factory `createEnemy(scene, config: EnemyConfig)` that returns a Phaser sprite plus a tiny patrol behaviour driven by `physics-helpers` (T026). Avoidance-only — no defeat logic. Spec FR-014.
- [ ] **T040 [P] [US2]** Implement `src/entities/pickup.ts`: a single factory `createPickup(scene, config: CarrotConfig | PowerupConfig)` that branches on `config.kind`. Returns a sprite + `onCollect(hero)` callback. Constitution Principle IV (one factory, two configs).
- [ ] **T041 [US2]** Extend `src/scenes/LevelScene.ts` to instantiate every `EntityConfig` from the loaded `LevelData` via the appropriate factory. Wires up overlaps: hero × enemy → `hero.takeHit()`; hero × carrot → `pickup.onCollect()` + emit `"carrot-collected"`; hero × power-up → `hero.applyPowerup()` + emit `"powerup-applied"`. (Depends on T034, T039, T040.)
- [ ] **T042 [US2]** Extend `src/entities/hero.ts` with: `lives` field (default from `src/config/hero.ts`), `takeHit()` (no-op if powered, else `lives--`, brief invulnerability, respawn at level start), `applyPowerup()` (start/refresh invincibility timer, emit `"powered-state-changed"` events with on/off + remaining ms). Spec FR-019 / FR-020 / FR-022 / FR-023.
- [ ] **T043 [US2]** Extend `src/scenes/UIScene.ts` to render the HUD: hearts (lives), carrot count, power-up timer ring/bar (only when active). Listens to scene-registry events emitted in T041/T042. Spec FR-030 / FR-031.
- [ ] **T044 [US2]** Wire game-over: when `hero.lives` reaches 0, `LevelScene` transitions to `GameOverScene` in a "game-over" mode that displays "Game Over" + "Play again" (vs. "Level complete" + "Play again" in the success path). Spec FR-024 / FR-025.
- [ ] **T045 [US2]** Wire `SaveService` integration: on `"level-complete"`, `LevelScene` calls `saveService.save({ ...current, completedLevelIds: [...current.completedLevelIds, "level-01"], lifetimeCarrots: current.lifetimeCarrots + carrotsThisRun })`. On `BootScene` start, `saveService.load()` to populate scene-registry initial state. Spec FR-037, Constitution Principle XI.
- [ ] **T046 [US2]** Append the Manual Playtest Checklist for US2: enemy contact → life lost; powered + enemy contact → no damage; carrots disappear and HUD updates; restart resets carrots + enemy; game-over after 3 hits; carrots persist across sessions per FR-037.

- [ ] **T046a [US2]** Cross-session persistence playtest (FR-037): in a deployed (or `npm run preview`) build, complete the level once; close the tab/app; re-launch from the same browser/install; verify `lifetimeCarrots` and `completedLevelIds` survive. Sign off in the US2 playtest checklist.

- [ ] **T046b [US2]** Accessibility minimum-bar playtest (FR-042 + FR-043): play a full level using only the keyboard, then again using only touch (no input crossover). On a 2022-era mid-range phone in landscape, confirm HUD text (lives / carrots / power-up timer) is legible at arm's length. Sign off in the US2 playtest checklist.

**Checkpoint**: The level is now a *game* — risk, reward, lives, save state. **Spec Story 2 (P2) is independently demoable**, and Story 1 still works.

---

## Phase 5: User Story 3 — Hear the narrator (Priority: P3)

**Goal**: One narrator dialog beat appears shortly after spawn; original prose; dismissable; re-fires on replay.

**Independent Test**: See spec [Story 3 acceptance scenarios](./spec.md#user-story-3--hear-the-narrator-priority-p3).

### Tests for User Story 3

- [ ] **T028 [US3]** Create `tests/unit/narrator-beats.test.ts` and assert pure `NarratorTrigger` evaluation for each `kind` (`after-spawn`, `on-position`, `on-event`). Test-first within the file pair with T048; tests MUST FAIL initially.

### Implementation for User Story 3

- [ ] **T047 [P] [US3]** Create `src/data/narrator-beats.ts` — a typed `readonly NarratorBeat[]` containing exactly one `{ kind: "after-spawn", delayMs: 2000 }` beat for `level-01`. The `text` field MUST be original prose with no copyrighted phrasing (spec FR-029, Constitution Principle I). Suggested first draft: a tutorial-flavoured single sentence in our own narrator voice — to be reviewed by the user before commit.
- [ ] **T048 [US3]** Extend `src/services/level-loader.ts` (or add `src/systems/narrator-trigger.ts`) with a pure trigger evaluator: `evaluate(beat, gameTimeSinceSpawnMs, heroPosition, recentEvents): boolean`. Add tests to `tests/unit/narrator-beats.test.ts` (T028) for each `NarratorTrigger.kind`.
- [ ] **T049 [US3]** Extend `src/scenes/UIScene.ts` to render a dialog box when the trigger evaluator fires: dialog text, a visible "▶ Tap to continue" / "Press [key] to continue" affordance, dismiss-on-input. Spec FR-026 / FR-027 / FR-028.
- [ ] **T050 [US3]** On level restart, narrator beats reset (re-fireable). On scene leave, dialog dismisses cleanly. Spec Story 3 acceptance #4.
- [ ] **T051 [US3]** Append Manual Playtest Checklist for US3: dialog appears within 2s of spawn; dismiss works (key + tap); replay re-shows dialog; dialog never blocks indefinitely.

**Checkpoint**: The slice now has its distinguishing personality. **Spec Story 3 (P3) is independently demoable**; Stories 1 + 2 still work.

---

## Phase 6: User Story 4 — Install and play like a real app (Priority: P4)

**Goal**: PWA installable on desktop / Android / iOS standalone; offline-capable; persistent. This is the *definition* of "shipped" per Constitution Principle V.

**Independent Test**: See spec [Story 4 acceptance scenarios](./spec.md#user-story-4--install-and-play-like-a-real-app-priority-p4).

### Implementation for User Story 4

- [ ] **T052 [P] [US4]** Create the full PWA icon set under `public/icons/` (192, 512, maskable 512). Generate from a single source SVG; record provenance + license in `public/assets/CREDITS.md`. (If user's CC0 icon source is undecided, use a Kenney UI-pack icon as v0 placeholder.) Spec FR-035.
- [ ] **T053 [P] [US4]** Create the iOS `apple-touch-startup-image` set under `public/splash/` for at least the current iPhone aspect ratios (config helpers exist for vite-plugin-pwa). Spec FR-034.
- [ ] **T054 [US4]** Update `vite.config.ts` (T003) with the final `manifest` values, the icon list (T052), iOS-specific `linkRel: "apple-touch-icon"` blocks, and Workbox `runtimeCaching` for `/assets/*` (cache-first) and the document (network-first with offline fallback). Plan Constraints, research Q2.
- [ ] **T055 [US4]** Create `src/pwa.ts`: detects iOS Safari (`/iPad|iPhone|iPod/.test(navigator.userAgent)` + standalone-mode check), exposes a small `isStandalone()` helper, and on non-iOS browsers listens for `beforeinstallprompt` and stashes it for an in-game "Install" UI affordance. Imported from `src/main.ts`. Spec FR-032 / FR-033 / FR-034.
- [ ] **T056 [US4]** Add an unobtrusive "Install" UI affordance in `MenuScene` (or `UIScene` overlay): visible only when `pwa.canInstall()` is true; on click, invokes the stashed prompt; hides itself once installed.
- [ ] **T057 [US4]** Manual playtest: deploy to Netlify (T058) + verify on real iOS, Android, desktop devices per spec Story 4 acceptance scenarios 1–5. Document the playtest sign-off in [docs/learning/journal/](../../docs/learning/journal/) — per Constitution II.6.

### Deployment for User Story 4

- [ ] **T058 [US4]** Promote the existing Azure SWA preview to production. The deploy pipeline already exists (shipped by spec 002 — see [docs/learning/journal/2026-05-18-shipping-infrastructure.md](../../docs/learning/journal/2026-05-18-shipping-infrastructure.md)) and currently auto-deploys `001-vertical-slice` HEAD to <https://happy-desert-0fe507f1e.7.azurestaticapps.net>. When this slice merges to `main`, in the same PR: (a) edit `.github/workflows/azure-static-web-apps-*.yml` to change every `001-vertical-slice` reference under `on.push.branches` / `on.pull_request.branches` to `main`; (b) run `az staticwebapp update --name carrot-code --resource-group rg-carrot-code --branch main` to update the SWA's production-branch setting; (c) confirm the next push to `main` triggers a production deploy. Branch protection on `main` (require CI green) was configured 2026-05-18 (commit 8b1c477) and is already in place. The public URL is already in `README.md`.
- [ ] **T059 [US4]** Add a build-time asset-budget verifier: a tiny Node script (`scripts/verify-asset-budgets.mjs`) run after `vite build` that reads each `LevelData.assetBudgetBytes` (via the registry) and sums actual sizes of declared `AssetDeclaration` URLs, failing the build if any level exceeds its budget. Wired into `package.json` `build` script. Constitution Principle X.

**Checkpoint**: The deployed URL is the shipped game. Installs as a PWA on desktop, Android, and iOS standalone. Plays offline. **Spec Story 4 (P4) is independently demoable, and the slice meets the constitution's definition of "shipped."**

---

## Phase 7: Polish & Cross-Cutting

- [ ] **T060 [P] [POLISH]** Tune values in `src/config/*.ts` based on playtest feedback from US1–US3 checklists (jump arc, coyote/buffer ms, enemy patrol speed, power-up duration). Single PR collecting tuning changes; no other diffs.
- [ ] **T061 [P] [POLISH]** Update [docs/learning/00-setup-from-zero.md](../../docs/learning/00-setup-from-zero.md) and [docs/learning/01-spec-kit-workflow.md](../../docs/learning/01-spec-kit-workflow.md) with anything learned during implementation that contradicts or extends them.
- [ ] **T062 [P] [POLISH]** Write a comprehensive journal entry under `docs/learning/journal/` covering the full implementation — first time CI ran red, first time a constitution gate caught something, anything surprising about Phaser / vite-plugin-pwa / iOS standalone in practice. Per Constitution II.6.
- [ ] **T063 [POLISH]** Run `quickstart.md` end-to-end on a clean clone (different folder) to verify the steps actually work as written. Update `quickstart.md` if anything is wrong.
- [ ] **T064 [POLISH]** Confirm zero known correctness bugs (Spec FR-039, SC-007) by walking the spec's full Acceptance Scenarios + Edge Cases checklist on the deployed PWA. File any failures as new specs (per Principle II — bugs become specs, not "drive-by fixes").
- [ ] **T064a [POLISH]** Cross-browser baseline verification (Spec FR-040 + FR-041): load the deployed URL on the latest two major versions of Chromium-based browsers (Chrome, Edge), Firefox, and Safari (desktop + mobile per the constitution's browser baseline). Confirm normal play on each; confirm the unsupported-browser fallback (FR-041) renders correctly when forced (e.g., spoofed UA or actual old browser if available). Record the matrix and outcomes in the polish-phase journal entry.
- [ ] **T065 [POLISH]** Open the PR from `001-vertical-slice` → `main`. PR description: link to spec/plan/tasks, completed playtest checklists, screenshots / install demo video. Self-review (Solo Project Realities preamble). Merge when CI green.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T011)** has no source-code dependencies and can start immediately.
- **Foundational (T012–T027)** depends on Setup completion (specifically T002 / T004 / T008 for tooling).
- **User Story 1 (T028–T037)** depends on Foundational completion. Once US1 lands, Stories 2/3/4 can in principle run in parallel; for solo work we'll do them in priority order.
- **User Story 2 (T038–T046)** depends on Foundational. US2 extends but does not break US1.
- **User Story 3 (T047–T051)** depends on Foundational. Independent of US2 (the narrator system reads no shared state with carrots/enemy beyond the scene registry).
- **User Story 4 (T052–T059)** depends on Foundational + at least US1 being demoable (otherwise there's nothing to install). T058 (push + branch protection) is also a hard prerequisite for the team-share milestone.
- **Polish (T060–T065)** depends on US1–US4 completion.

### Within Each User Story

- Types (Foundational) → tests → implementation → integration → playtest checklist.
- For pure-logic modules (loaders, helpers, services): tests written first and asserted to FAIL before implementation lands. Constitution Principle VI.

### Parallel Opportunities

- All `[P]` tasks in **Setup** (T002–T007, T010, T011) can run in parallel.
- All `[P]` tasks in **Foundational** (T013–T019, T021, T023–T026) can run in parallel — they touch independent files. T020 / T022 / T027 are integration points.
- Within US2: T039 (enemy) and T040 (pickup) are parallel-safe (different files). T041 integrates them.
- Within US4: T052 (icons) and T053 (splash) are parallel-safe asset work.

---

## Implementation Strategy

### MVP-floor first (US1 only)

1. Phase 1 (Setup) → CI green on empty source tree.
2. Phase 2 (Foundational) → all unit tests passing on pure logic.
3. Phase 3 (User Story 1) → walk + jump + level-end. **Stop. Validate via T037 playtest checklist. Demo to yourself.**
4. **Decision point:** US1 alone is a competent platformer demo. Stories 2–4 add what makes it the *project's* MVP.

### Incremental delivery

1. Setup + Foundational → CI green; nothing playable.
2. + US1 → walk + jump demo; CI green.
3. + US2 → game with stakes; CI green.
4. + US3 → game with personality; CI green.
5. + US4 → installable PWA, deployed publicly. **Slice is shipped per Constitution Principle V.**
6. + Polish → PR merge to `main`.

### Solo + agent strategy

- Tackle phases in order; within a phase, use parallel `[P]` markers as a TODO checklist for one-after-another work (you, the human, are the bottleneck — but the markers tell you which tasks have no inter-dependencies, so order doesn't matter).
- After each user-story checkpoint, **stop and play the slice yourself**. The playtest checklists exist to make this concrete.
- Commit after each task or each small group; if you bend a rule, write the reason in the per-task commit message — that's the journal-entry seed for the polish phase.

---

## Notes

- `[P]` = different files, no in-flight dependencies.
- `[Story]` label maps each task to a story for traceability against the spec.
- Tests for pure logic are mandatory (Constitution VI) and authored before the implementation file in the same task pair where called out.
- Manual playtest checklists per user story are the human-facing test layer (Constitution VI's gameplay-feel rule).
- Each user story's checkpoint must hold before moving to the next — that's the slice-not-mush discipline.
- Avoid: vague tasks, same-file conflicts in parallel work, cross-story coupling that breaks the independent-demoability of any prior story.
