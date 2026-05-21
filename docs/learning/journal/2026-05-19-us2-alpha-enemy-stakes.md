# Journal — 2026-05-19 (night) — US2 alpha: enemy + carrots + lives

> Tasks: T038 (Tiled entities — authored directly in JSON, no Tiled session), T039 (enemy entity), T040 partial (carrot pickup; powerup deferred), T041 (LevelScene dispatch + collisions), T042 partial (Hero.takeHit + lives state machine; applyPowerup deferred), T043 partial (HUD hearts + carrot counter), T044 (game-over wiring), T046 (playtest checklist).

## Context

US1 shipped earlier in the day with playtest sign-off. The maintainer pushed back on my "you author the Tiled file" framing — fair point: for entity placement (just coordinates + properties), I can author the `.tmj` JSON directly. We agreed on a scaling model: terrain in Tiled (visual judgement), entities via direct JSON edit (just data). T038 was the first execution of that pattern.

Goal of this session: ship enemy + carrots + lives + game-over in one commit (US2 alpha). Powerup + SaveService deferred to next commit to keep this one's scope tight.

## What happened

- **EntityConfig types gained `x` + `y` fields.** Previously the loader extracted Tiled `x`/`y` but discarded them — fine when entities were unimplemented, broken once LevelScene needed to spawn them. Updated `EnemyConfig`, `CarrotConfig`, `PowerupConfig`, the loader's per-kind readers, and the level-loader.test.ts `toEqual` blocks. 11 loader tests still pass.
- **Pure-logic split for hero lives.** Extracted `HeroLivesState` to its own module (no Phaser imports) so 9 unit tests can exercise the state machine (initial, takeHit while vulnerable, takeHit while invulnerable, expiry, game-over-on-final-hit, post-gameover ignored, reset). Tests written first, all GREEN on first implementation.
- **Enemy entity.** Phaser sprite + Arcade body, drives velocity from the existing `nextPatrolDirection` helper (which already has 18 tests — no new patrol tests needed). Constructor reads `EnemyConfig`, sprite-flips on direction change, collides with terrain via the scene-side wiring. ~110 lines.
- **Pickup factory.** Single `createPickup` function that dispatches on `config.kind`. Carrot branch implemented; powerup branch throws a clear error (so a Tiled author can't ship a powerup before the wiring exists). Static body, no gravity, destroys self on collect.
- **LevelScene `dispatchEntities`.** Exhaustive switch on `entity.kind`, instantiates Enemy / pickup, wires the appropriate physics overlap. Carrot collect increments a per-scene counter; enemy contact calls hero.takeHit() which returns `"hurt" | "gameover" | "ignored"`; `"gameover"` routes to GameOverScene with the proper outcome.
- **Registry-based HUD.** LevelScene publishes `heroLives` + `carrotCount` to the scene registry on change. UIScene subscribes to `Phaser.Data.Events.CHANGE_DATA_KEY + key` and re-renders hearts row / updates carrot text. The two scenes don't import each other (only the registry key constants are shared) so they stay loosely coupled.
- **HUD glyphs from the existing tileset.** Re-declared `tilemap_packed.png` under a new asset key `icons-pixel-platformer-tiles` as a spritesheet (18×18 frames). Phaser dedups the actual image load. Frame 44 = heart, frame 67 = carrot — both eyeballed from the image; user can swap with one-line edits if they look wrong in-game.
- **Enemy + 3 carrots authored directly in `level-01.tmj`** using exact world coordinates derived from the tile grid (each platform's top surface y, mid-platform x). Verified via a throwaway Vitest invocation that ran the actual on-disk `.tmj` through `loadLevel()` — caught all 4 entities at the expected coordinates.
- **All 5 gates green**: typecheck, lint, format, 87 tests across 9 files, build.

## Decisions

| Decision | Rationale |
|---|---|
| Add `x`/`y` to EntityConfig instead of wrapping with `PlacedEntity` | Simpler; preserves the discriminated-union dispatch; existing tests only needed `toEqual` updates |
| Extract HeroLivesState to its own pure-logic module | Same pattern as hero-input.ts — Phaser-free, tests don't need a window |
| Carrot pickup is a `physics.add.sprite` with disabled gravity + immovable, not a Zone | Sprite gives visual rendering for free; overlap works either way |
| Powerup branch throws in `createPickup` | Fail loud rather than ship a broken pickup if someone adds `kind: "powerup"` in Tiled before the wiring exists |
| HUD events use Phaser's registry CHANGE_DATA_KEY pattern, not custom emitter | Built-in, deduped, scene-lifetime-managed automatically |
| Asset key `icons-pixel-platformer-tiles` re-binds the same PNG as a spritesheet | Phaser dedups; cost = zero. Lets us pull any 18×18 tile as a standalone sprite by frame index |
| One commit covers enemy + carrots + lives + game-over; powerup + SaveService deferred | Coherent slice ("game has stakes now"); deferring keeps the diff reviewable |
| Direct JSON edit of `.tmj` for entity authoring (no Tiled session) | First execution of the agreed scaling model. Verified via a throwaway loader test |

## What worked

- **Test-first on HeroLivesState.** 9 cases nailed the contract in advance, implementation went in clean on first try.
- **Loader change → entity-config extension → tests updated → typecheck → still GREEN** at every step. The level-loader's strict contract caught the missing-x/y reads at the boundary; nothing downstream needed defensive code.
- **JSON-edit of `level-01.tmj` was painless.** Pattern-matched the existing spawn/end objects, picked sensible IDs, ran the throwaway Vitest verifier, saw all 4 entities at expected coordinates. The promised scaling model holds up — adding more entities to existing levels is now a few minutes of JSON, not a Tiled session.
- **Phaser's registry change events** are well-suited for HUD wiring. LevelScene `set()`, UIScene `on(CHANGE_DATA_KEY + key)` — no listener cleanup needed, scene lifecycle handles it.

## What didn't

- **multi_replace_string_in_file partial application.** A single batch had two operations succeed and one fail (couldn't find the match). The failed one wasn't critical (it was for an import block on a file the user had touched) — fixed by re-reading the file and doing an isolated replacement. The pattern that emerged: when the user has edited a file between my reads, multi_replace is fragile; better to read fresh + use one targeted replace_string_in_file per change.
- **HUD frame numbers guessed.** Heart = 44, carrot = 67 — both eyeballed from the image at low res. Could be wrong; we'll see on first run and swap if they render the wrong tile. Architecturally correct, just possibly visually off.
- **pngjs not installed** so my labeled-tileset script idea (auto-generate index labels onto an upscaled tileset PNG) failed. Reverted to eyeball.

## Open questions / next session

- [ ] Maintainer plays `playtests/us2.md`. File observations.
- [ ] If heart/carrot frame numbers are wrong, swap (one-line edit each in `UIScene.HEART_FRAME` / `UIScene.CARROT_HUD_FRAME` and `pickup.ts CARROT_FRAME`).
- [ ] **Next commit: powerup + SaveService.** Implements Hero.applyPowerup, pickup powerup branch, HUD power-up timer (small overlay near top-center), SaveService persistence of `lifetimeCarrots` + `completedLevelIds`. Closes T045 / T046a / T046b.
- [ ] After US2 full sign-off: US3 begins at T047 (narrator dialog).

## Artifacts touched

- `src/entities/hero-lives.ts` (new)
- `tests/unit/hero-lives.test.ts` (new — 9 tests)
- `src/entities/enemy.ts` (new)
- `src/entities/pickup.ts` (new — carrot only)
- `src/entities/hero.ts` (lives integration + takeHit + invuln blink)
- `src/types/entity-config.ts` (added x/y to each *Config)
- `src/services/level-loader.ts` (readPlacementCoord helper, x/y on each kind)
- `tests/unit/level-loader.test.ts` (toEqual blocks updated)
- `src/services/asset-service.ts` (enemy-character-b + icons-pixel-platformer-tiles declarations)
- `src/scenes/LevelScene.ts` (dispatchEntities, hero-enemy overlap, game-over wiring, registry publish)
- `src/scenes/UIScene.ts` (buildHud + hearts container + carrot counter + registry subscribe)
- `src/data/levels/level-01.tmj` (4 new entities: 1 enemy + 3 carrots)
- `specs/001-vertical-slice/playtests/us2.md` (new — T046 checklist)
- `docs/learning/HANDOVER.md` (current-state refresh)
