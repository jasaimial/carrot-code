# Journal — 2026-05-19 (late evening) — T035 mobile + Enter-restart fix

> Tasks: T035, GameOverScene keyboard-restart bug-fix.
> Builds on the evening's [desktop-playable entry](./2026-05-19-us1-desktop-playable.md).

## Context

After the previous session shipped US1 desktop-playable, the maintainer ran [the playtest checklist](../../specs/001-vertical-slice/playtests/us1.md) on their own. All items passed except one nit: **on the Game Over screen, Enter doesn't trigger Play-again** (mouse click does work, Space wasn't tested but has the same bug). Also confirmed: gameplay feel is right, gravity right, head-bonk-drops-you-faster works like SMB.

This session: fix the Enter bug and ship T035 (mobile touch buttons + portrait-rotate prompt). Maintainer was home with phone in hand on the same router.

## What happened

- **Enter-restart fix.** Root cause in `src/scenes/GameOverScene.ts`: I wrote `keydown-${KeyCodes.ENTER.toString()}` which produces the string `"keydown-13"`. Phaser's keyboard event names use the **key NAME** ("ENTER"), not the numeric code. Handler silently never fired. Same bug on Space. Fix: hardcode the right strings (`"keydown-ENTER"`, `"keydown-SPACE"`) with a comment explaining the gotcha so this doesn't recur.
- **Head-bonk = fast-drop is a Phaser arcade-physics default.** I didn't code it; it emerges from the collision-resolution behaviour (perpendicular velocity zeroed on impact → gravity reasserts immediately → looks identical to Mario's "bonk and drop"). Worth journaling because it's the kind of "well-tuned engine defaults are gameplay-feel" insight that shapes how I think about future tuning.
- **TouchInputStore** (`src/systems/touch-input-store.ts`): tiny stateful boolean container with edge-detected jump-press. Tested first; 10 cases cover the directional flags, edge-detect semantics ("setJump(true) twice in a row only fires one press"), release-then-press resets the edge, and the empty-initial-state contract.
- **UIScene full rewrite.** Three translucent square buttons (`◄`, `►`, `JUMP`) sized 88 px, positioned via new `UI.touch*` constants. `setScrollFactor(0)` keeps them fixed during camera scroll. Pointer events `pointerdown` / `pointerup` / `pointerupoutside` / `pointerout` map to TouchInputStore writes. Crucial: `pointerupoutside` handles "finger slides off while still pressed" — without it, the button stays stuck.
- **Touch detection:** `'ontouchstart' in window || navigator.maxTouchPoints > 0`. If false (desktop), buttons aren't rendered. Hero still reads the empty store unconditionally, so the code path stays the same.
- **Portrait-rotate prompt:** `window.matchMedia("(orientation: portrait)")` + change listener. A translucent full-canvas overlay with the localized prompt text shows while portrait, auto-hides on landscape rotation. Falls back to legacy `addListener` for older Safari versions.
- **Skipped `screen.orientation.lock("landscape")`.** Cross-browser support is too poor (iOS Safari rejects entirely, Chrome requires fullscreen first). The PWA manifest already declares landscape orientation, so installed PWAs get it natively. The in-browser fallback is the visual prompt.
- **Hero merges touch flags** into the per-frame `HeroInput` build. The store is read once via the registry at constructor time; per-frame reads are nullish-coalesced (`?? false`) so missing store / desktop = no-op.
- **LevelScene launches UIScene** in `create()` and stops it on end-trigger (so touch buttons + portrait overlay don't sit on top of GameOverScene). The `launch` (not `start`) call keeps LevelScene running underneath.
- All 5 gates green: typecheck, lint, format, **78 tests across 8 files** (+10 for TouchInputStore), build.

## Decisions

| Decision | Rationale | Reversible? |
|---|---|---|
| Touch buttons hidden on desktop entirely (option A from the offered plan) | Maintainer's call: clicking buttons with a mouse gives no game-feel value, only visual noise. Keep the play area unobstructed | Yes — flip `isTouchDevice()` to always-true to test from desktop |
| Hardcode `"keydown-ENTER"` / `"keydown-SPACE"` instead of going through KeyCodes enum | The KeyCodes enum has numeric values; Phaser's event names want the key NAME. The "right" way is `Phaser.Input.Keyboard.KeyCodes[code]` lookup, but for two well-known constants, hardcoded strings + a comment are clearer | Yes — bigger refactor if we add many keys |
| Skip `screen.orientation.lock()` | iOS Safari rejects entirely; Chrome needs fullscreen-first; cost/benefit of the cross-browser dance isn't worth it for v0 | Yes — add the API call later if iOS Chrome users complain |
| `pointerupoutside` + `pointerout` both wired as release | Different pointer-device behaviours: fast finger drags fire one, slow ones fire the other. Belt + suspenders | Yes — drop one if we see double-fire issues |
| Touch buttons use opaque background (low opacity) + text on top | Cleaner than text-only buttons; gives a visible target area without dominating the gameplay view. Opacity bumps from 0.35 → 0.7 when pressed for tactile feedback | Yes |
| TouchInputStore lives in `src/systems/`, not `src/services/` | It's pure logic (no I/O), same as coyote-time and jump-buffer. Services own I/O seams; systems own pure game state | Yes |
| Edge-detected jump-press via `consumeJumpPressed()`, mirroring `Phaser.Input.Keyboard.JustDown()` | Hero's resolver expects the same press semantics regardless of input source. Same shape = no resolver change | Yes |
| One commit bundles Enter-fix + T035 | The Enter bug is small and tightly related (both touch GameOverScene/UI interaction); bundling keeps history readable | Hard — split would need git rebase |

## What worked

- **Test-first on the store paid off again.** 10 cases captured the edge-detect semantics before the implementation existed. The implementation came in on first try, no debug iteration.
- **The Hero already accepted injected input** via the abstract `HeroInput` shape, so wiring touch was literally adding three `|| (this.touch?.<flag> ?? false)` clauses. No resolver change. Architecture decision from earlier session paying dividends.
- **Portrait-overlay via matchMedia change-listener** is rock-solid cross-browser. No polling, no orientation API quirks.
- **`pointerupoutside`** is the unsung hero of touch UI. Almost certainly the reason this "just works" on first phone test.

## What didn't

- **`create_file` doubled UIScene.ts again** despite the prior delete. Truncation pass + Node script to restore the trailing few lines that the truncate cut. Repo-memory note already exists from previous occurrence; this confirms the pattern is reliable.
- **Tried `public override shutdown()` on UIScene** — TypeScript rejected because `Phaser.Scene` declares `shutdown` as a callback property, not a base-class method. Removed the `override`.
- **Phaser keyboard event-name format** (KEY NAME not numeric code) cost the previous session a bug; now documented in repo memory.

## What I'd do differently

- **For every `keydown-*` I write going forward:** use the literal string, not a KeyCode lookup. Or use `kb.on("keydown", e => ...)` and switch on `e.code`. Don't string-concat against the KeyCodes enum.

## Open questions / next session

- [ ] **Maintainer plays the level on phone.** Verify the touch-section items in `playtests/us1.md`. File observations: button positions, hit-box generosity, whether the rotate prompt is intrusive.
- [ ] **Tune button positions if awkward.** All four `touch*` knobs are in `src/config/ui.ts` — `touchLeftButtonLeftPx`, `touchRightButtonLeftPx`, `touchJumpButtonRightPx`, `touchButtonBottomPx`. No code change needed for tuning.
- [ ] **T037 final sign-off.** When all items pass, fill in the date + git SHA at the bottom of `playtests/us1.md`. Then US1 is officially shipped and US2 (T041 = first enemy) can begin.
- [ ] **The 1.36 MB Phaser bundle** warning is still there. Code-splitting the Phaser core into a separate chunk is a polish-phase win.

## Artifacts touched

- `src/systems/touch-input-store.ts` (new)
- `tests/unit/touch-input-store.test.ts` (new — 10 tests)
- `src/scenes/UIScene.ts` (full rewrite from stub)
- `src/scenes/LevelScene.ts` (launch + stop UIScene)
- `src/scenes/GameOverScene.ts` (Enter-restart bug fix)
- `src/entities/hero.ts` (merge touch flags into HeroInput)
- `src/game.ts` (seed TouchInputStore on registry)
- `src/config/ui.ts` (touch button constants)
- `src/i18n/en.ts` (button labels + rotate prompt)
- `specs/001-vertical-slice/playtests/us1.md` (mobile section enabled)
- `docs/learning/HANDOVER.md` (current-state refresh)
