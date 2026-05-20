# US1 manual playtest checklist

> **Task:** T037. **Outcome:** Story 1 "Play through a level" demoably complete.
> **Required by:** Constitution Principle VI (gameplay-feel rule). Code can be unit-tested; how the game _feels_ cannot. A human walks this list before US1 is considered shipped.

This is a per-build, per-platform manual checklist. Mark each item ☑ when satisfied, ☒ when broken (and file a tuning observation in the open-items block at the bottom). Re-run the full list after any change to `src/config/hero.ts`, `src/config/physics.ts`, or `src/entities/hero.ts`.

## Setup

- [ ] Pulled latest `001-vertical-slice` HEAD.
- [ ] `npm install` ran cleanly (only needed if `package.json` changed).
- [ ] `npm run dev` opened at <http://localhost:5173>. No console errors.

## Keyboard play-through (desktop browser)

Walk the level from spawn → end-trigger. Note the platform sequence: the three elevated platforms you authored in Tiled at increasing heights, then the end-rectangle just before the right tree.

- [ ] **Hero appears at spawn.** Top-left character sprite (frame 0 of the Kenney character sheet) renders sitting on the ground floor at roughly column 3, on top of the grass-topped dirt. Camera centered on the hero.
- [ ] **Left/right movement.** Pressing `←` / `→` (and `A` / `D` as alternates) moves the hero horizontally. Acceleration is responsive but not instant — the hero doesn't snap to top speed in one frame, and stops promptly when no key is held.
- [ ] **Sprite flips with direction.** Moving left flips the sprite horizontally; moving right flips it back. Idle preserves the last-faced direction.
- [ ] **Hero falls off platforms when walked off the edge.** Gravity feels right — not floaty (over-light), not lead-boots (over-heavy).
- [ ] **Jump (basic).** A short tap of `↑` / `W` / `Space` produces a short jump. A held press produces a tall jump that gets the hero onto the first elevated platform from a standing position.
- [ ] **Jump arc feels right.** The hero rises smoothly, peaks, and falls. Doesn't pop instantly to peak height (overpowered) or float at peak (under-gravity).
- [ ] **Variable-height jump (FR-003).** Releasing the jump key mid-rise visibly cuts the apex short. A tap-and-release barely clears the first platform; a hold reaches the third platform.
- [ ] **Coyote-time (FR forgiveness).** Walk straight off the edge of a platform and press jump within ~100ms — the jump still fires. The hero should not "fall through" the jump just because they pressed slightly after leaving the platform.
- [ ] **Jump-buffer (FR forgiveness).** While falling, press jump shortly _before_ landing on the ground or a platform. The jump fires immediately on touchdown, not requiring a second press. Buffer window is ~100ms; presses earlier than that don't queue.
- [ ] **No double-jump (FR-004 — single jump only).** While airborne past the coyote window, repeated jump presses do nothing. The hero only re-jumps after touching ground.
- [ ] **Platform-to-platform jump sequence.** Standing on platform 1, hold jump and walk right — the hero clears the gap to platform 2. Repeat for platform 2 → 3.
- [ ] **No accidental wall-cling.** Running into the side of a platform doesn't stick the hero to it; horizontal velocity zeros on collision but vertical velocity continues normally.
- [ ] **World bounds work.** Hero cannot leave the left, right, or bottom of the level. The camera stops scrolling at the level edge.

## End-trigger + game-over flow

- [ ] **End-trigger is visible.** A subtle orange outlined rectangle marks the trigger zone just before the right tree.
- [ ] **Reaching the end fires "Level complete!"** GameOverScene appears with the localized headline and a "Play again" button.
- [ ] **Mouse hover on the Play-again button highlights it** (text color shifts from carrot orange to cream).
- [ ] **Click "Play again" restarts the level.** Back to BootScene → Loading → LevelScene with the hero at spawn.
- [ ] **`Enter` and `Space` also trigger Play-again** from the GameOverScene.

## Touch / mobile (DEFERRED to T035)

T035 wires touch buttons + landscape orientation lock. Skip this section until T035 lands; you'll need a phone in hand to verify.

## Acceptance per spec

Cross-reference with the [US1 acceptance scenarios](../spec.md#user-story-1--play-through-a-level-priority-p1):

- [ ] AS-1 — _Player starts the game_ → spawn point renders, game is playable.
- [ ] AS-2 — _Player jumps onto an elevated platform_ → variable-height jump succeeds, hero lands cleanly.
- [ ] AS-3 — _Player walks off a ledge and presses jump in time_ → coyote-time honors the late press.
- [ ] AS-4 — _Player reaches the level-end trigger_ → "Level complete" shown, restart option provided.

## Tuning observations (open items)

> Append a one-line observation per anything that felt off. These feed into the polish-phase re-tune (T060).

- _(none yet — fill in after first run)_

## Sign-off

When all unchecked items pass, US1 is demoable per Constitution Principle VI's gameplay-feel rule. Sign off below with the date + git SHA the playtest covered:

- [ ] Playtest sign-off: ____ (YYYY-MM-DD, @<git-sha>)
