# US3 manual playtest checklist

> **Task:** T051. **Outcome:** Story 3 "Hear the narrator" demoably complete.
> **Required by:** Constitution Principle VI. Run on top of [US1](./us1.md) + [US2](./us2.md); US3 doesn't remove anything, only adds the narrator dialog.

Re-run after any change to `src/data/narrator-beats.ts`, `src/systems/narrator-trigger.ts`, the narrator wiring in `src/scenes/LevelScene.ts`, or the dialog rendering in `src/scenes/UIScene.ts`.

## Setup

- [ ] Latest `001-vertical-slice` HEAD pulled.
- [ ] `npm run dev` opens at <http://localhost:5173>. No console errors at boot.

## Narrator dialog appears after spawn (FR-026)

- [ ] **Within ~2 seconds of spawn**, a dark dialog box appears bottom-center.
- [ ] The body text reads (verbatim, original prose — no copyrighted IP per Principle I):
  > Welcome to your first cartridge run. Keep moving, jump clean, and trust your timing.
- [ ] A dismiss hint reads `Press [Space] to continue` directly under the body text.
- [ ] The box has a cream-colored border on a dark fill; legible at arm's length on phone.

## Dialog does not block gameplay (FR-028)

- [ ] **While the dialog is visible**, the hero can still move left/right and jump.
- [ ] Carrots can still be collected; HUD still updates; powerup pickup still works.
- [ ] The dialog never traps input — there is always a visible dismiss affordance.

## Dismiss paths (FR-027)

- [ ] **Pressing `Space` while the dialog is visible** dismisses it immediately.
- [ ] **Pressing `Enter`** also dismisses the dialog.
- [ ] **Clicking the dialog box** (desktop) dismisses it.
- [ ] **Tapping the dialog box** on a touch device dismisses it.
- [ ] Once dismissed, the dialog stays gone for the rest of the run (does not re-fire mid-run).

## Replay re-fires the beat (FR-029 / T050)

- [ ] **Complete the level** → click `▶ Play again` on the Game Over screen → on respawn, the dialog re-appears ~2 seconds after spawn with the same text.
- [ ] **Die to the enemy** (lose all 3 lives) → click `▶ Play again` → dialog re-appears on respawn.
- [ ] **Repeat a third time** — dialog still re-fires (no first-run-only gating).

## Coexistence with HUD + powerup timer

- [ ] Hearts (top-left), carrot counter (top-right), and powerup timer (top-center when active) remain readable while the dialog is up.
- [ ] **Pick up the gold powerup while the dialog is visible** — both the powerup timer (top-center) and the narrator dialog (bottom-center) render at the same time without overlap.

## Mobile / landscape phone

- [ ] On a phone in landscape, the dialog sits above the touch buttons (left/right/jump) without covering them.
- [ ] Tapping the dialog dismisses it without accidentally triggering a touch button below it.
- [ ] Dialog body text wraps cleanly within the box; nothing clipped off-screen.

## Restart from Play-again does NOT get stuck on "Loading…"

- [ ] After clicking `▶ Play again` (from either `Level complete!` or `Game over`), the game returns to the level **immediately** — no permanent "Loading…" screen.
- [ ] Same restart behaviour on the second, third, fourth Play-again in the same session.

## Spec acceptance per US3

Cross-reference [Story 3 acceptance scenarios](../spec.md#user-story-3--hear-the-narrator-priority-p3):

- [ ] AS-1 — Within a few seconds of spawn, a narrator dialog with short, original tutorial prose appears.
- [ ] AS-2 — The assigned dismiss input removes the dialog and play continues.
- [ ] AS-3 — Dialog never blocks input indefinitely (always a visible dismiss affordance).
- [ ] AS-4 — On replay, the dialog re-appears at the same trigger on the new run.

## Tuning observations (open items)

- _(none yet — fill in after first run)_

## Sign-off

- [ ] US3 minimal sign-off (narrator beat + dismiss + replay reset): ____ (YYYY-MM-DD, @<git-sha>)
