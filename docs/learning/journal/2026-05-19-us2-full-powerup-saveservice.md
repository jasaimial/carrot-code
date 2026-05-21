# Journal — 2026-05-19 (late night) — US2 full: powerup + SaveService

> Tasks: T040 (powerup branch), T042 (Hero.applyPowerup), T043 (HUD power-up timer), T045 (SaveService integration), T046a (cross-session persistence playtest authored).

## Context

US2 alpha shipped earlier and the maintainer confirmed it works smoothly. This commit closes the remaining US2 work: powerup pickup + SaveService persistence. After playtest sign-off, MVP is shipped and US3 (narrator) opens.

## What happened

- **Pure-logic split for the powerup timer.** Same pattern as HeroLivesState — `HeroPowerupState` in its own Phaser-free module with 9 unit tests covering refresh / extend / ignore stack modes (only "refresh" is wired in production but all three are documented + tested for the polish phase).
- **Hero gained applyPowerup() / isPowered() / getPowerupRemainingMs().** Pre-existing takeHit() now short-circuits on `powerup.isPowered()` — that's the "invincibility makes you immune" behavior.
- **Visual feedback split:** powered → gold tint (matches `PALETTE.uiPowerup`); invuln post-hit → alpha-cycle blink; neither → normal. Power takes precedence so the gold tint reads cleanly while you're in the immunity window.
- **pickup.ts powerup branch.** Both kinds now share the same static-body setup; difference is just frame index + a gold setTint for the powerup. The earlier `throw` on powerup is gone.
- **LevelScene wires powerup overlap:** on contact, `hero.applyPowerup(entity.durationMs)` + publishes the freshly-applied remaining ms to the registry. `update()` republishes every frame (rounded to 100ms so registry change-detection doesn't fire every single frame).
- **UIScene HUD power-up timer.** Top-center, gold text on dialog-dark background. Visible only when remaining > 0; auto-hides on expiry. Subscribes to `REGISTRY_KEY_POWERUP_REMAINING_MS` registry change events.
- **SaveService instance lives on the registry.** `game.ts postBoot` constructs `new LocalStorageSaveService()` inside a try/catch — if `window.localStorage` is unavailable (incognito + storage-disabled corner cases) we log + continue; the game still plays.
- **LevelScene.endLevel("complete") persists.** Loads current SaveState, appends this levelId to `completedLevelIds`, adds this run's `carrotsCollected` to `lifetimeCarrots`, writes. Save failures are non-blocking (log + continue) per the design rule "non-blocking degradation."
- **Powerup added to level-01.tmj** at (612, 288) — floor height between platform 3 and the slime patrol area. Maintainer can walk through, grab it, immediately run into slime safely.
- All 5 gates green: typecheck, lint, format, **96 tests across 10 files** (+9 powerup), build.

## Decisions

| Decision | Rationale |
|---|---|
| Pure-logic split for `HeroPowerupState` (same as `HeroLivesState`) | Established pattern; keeps Phaser out of unit tests; cheap to write |
| Powerup branch reuses the carrot pickup body shape | Same physical contract (static, immovable, hero overlap = collect). Difference is purely cosmetic (frame + tint) |
| Gold sprite tint while powered, no per-frame blink | Distinguishable from the post-hit invuln blink; cleaner read at a glance |
| Power-up HUD timer at top-center (between hearts + carrot counter) | Doesn't fight either existing HUD element for screen space |
| Round powerup-remaining to 100ms before publishing | Registry CHANGE_DATA_KEY fires only on actual value changes; rounding avoids spam (~60 publishes/sec → ~10/sec) |
| SaveService construction in try/catch at postBoot | One bad browser shouldn't crash the game at boot. Log + continue, mark progress as session-only |
| Persist only on level-complete, not on every carrot pickup | One write per run is enough; per-collect would thrash localStorage on a slow phone |
| Restart goes BootScene → fresh LevelScene (existing behavior) | SaveState was already saved; rebuilding from `new` is the cleanest reset |

## What worked

- **Test-first kept paying off.** Powerup state machine landed clean on first implementation. Hero integration was a 4-line touch with zero debugging.
- **Registry-event pattern scales.** HUD now subscribes to three keys (lives, carrots, powerup) with no code reorganization — each is one `registry.events.on(CHANGE_DATA_KEY + key, ...)` listener.
- **The PowerupConfig already had `durationMs`** in the level-loader from earlier work (T021), so LevelScene didn't need any loader-side changes.

## What didn't

- **Initial worry about update() per-frame registry writes** spamming the HUD turned out to be real — without the rounding-to-100ms guard, the registry would fire ~60 CHANGE_DATA_KEY events per second. Rounding fixed it. Worth noting in repo memory: Phaser's registry.set() fires CHANGE_DATA_KEY unconditionally on every set, NOT just on actual value changes. The "did the value actually change?" guard is the caller's responsibility.

## Open questions / next session

- [ ] Maintainer playtests US2 full (powerup + persistence sections).
- [ ] Sign-off lines at the bottom of `playtests/us2.md`.
- [ ] **US3 next: T047** (narrator-beats.ts with one beat) + T048 (pure trigger evaluator) + T049 (UIScene dialog overlay) + T051 (US3 playtest).

## Artifacts touched

- `src/entities/hero-powerup.ts` (new)
- `tests/unit/hero-powerup.test.ts` (new — 9 tests)
- `src/entities/hero.ts` (powerup integration, visual feedback split, applyPowerup/isPowered/getPowerupRemainingMs)
- `src/entities/pickup.ts` (unified body setup + powerup branch + gold tint)
- `src/scenes/LevelScene.ts` (powerup overlap wiring, per-frame remaining-ms publish, persistProgress)
- `src/scenes/UIScene.ts` (power timer text + REGISTRY_KEY_POWERUP_REMAINING_MS subscriber)
- `src/game.ts` (SaveService construction + REGISTRY_KEY_SAVE_SERVICE export)
- `src/data/levels/level-01.tmj` (added shield-1 powerup at floor height)
- `specs/001-vertical-slice/playtests/us2.md` (powerup + persistence sections enabled)
- `docs/learning/HANDOVER.md` (current-state refresh)
