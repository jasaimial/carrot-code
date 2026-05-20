# US2 manual playtest checklist

> **Task:** T046. **Outcome:** Story 2 "Face stakes and gather rewards" demoably complete.
> **Required by:** Constitution Principle VI. Run on top of [US1](./us1.md); US2 doesn't remove anything, only adds.

Re-run after any change to `src/config/enemy.ts`, `src/config/hero.ts`, the level's enemy patrol bounds, or `src/entities/{hero,enemy,pickup}.ts`.

## Setup

- [ ] Latest `001-vertical-slice` HEAD pulled.
- [ ] `npm run dev` opens at <http://localhost:5173>. No console errors at boot.

## HUD (visible on desktop AND mobile)

- [ ] **Top-left:** three small heart icons aligned in a row. Each is the upscaled Pixel Platformer heart tile.
- [ ] **Top-right:** carrot icon + `× 00` counter. Right-aligned; doesn't shift when count changes (zero-padded).

## Enemy (1 on level-01, patrolling on the floor)

- [ ] **Enemy is rendered** as a distinct character sprite (Kenney character sheet frame 17 — different color/shape from hero).
- [ ] **Enemy patrols horizontally** between roughly col 32 and col 45 on the floor. Reverses direction at both ends.
- [ ] **Enemy sprite flips horizontally** with patrol direction (faces the way it's moving).
- [ ] **Enemy collides with floor** — doesn't fall through.

## Hero takes damage on contact

- [ ] **Walking into the enemy reduces lives by 1.** Top-left HUD updates from 3 hearts → 2 → 1.
- [ ] **Brief invulnerability window after a hit.** During ~1 sec the hero sprite blinks (alpha cycles) and further enemy touches don't subtract another life.
- [ ] **Hero knocked horizontally away** from the contact source. Small upward bump too. Feels like a hit.
- [ ] **After the invuln window, walking back into the enemy hits again** (lives drop by another 1).

## Carrots (3 on level-01, one above each platform)

- [ ] **Each carrot is rendered** as a small orange-ish tile (frame 67 of `icons-pixel-platformer-tiles`). One on top of each elevated platform.
- [ ] **Overlapping a carrot collects it** — the sprite disappears, the top-right counter increments (00 → 01 → 02 → 03).
- [ ] **Collected carrots don't re-spawn** within the same run.
- [ ] **Restarting the level (via "Play again") resets carrots** back to all three uncollected and the counter back to 00.

## Game over on third hit

- [ ] **Third enemy contact triggers GameOverScene with "Game over" headline** (not "Level complete"). The Play-again button shows.
- [ ] **Mouse click + Enter + Space all restart** the level (same as US1's complete path).
- [ ] **After restart: 3 hearts, 0 carrots, enemy back at original patrol position.**

## End-trigger still works (regression check)

- [ ] **Walking past the enemy and into the orange end-trigger fires "Level complete!"** with the same Play-again behaviour.
- [ ] **Walking past the enemy WITHOUT collecting carrots also fires "Level complete"** — carrots are optional in v0.

## Mobile touch (regression check)

- [ ] **Touch buttons still appear at the bottom of the screen on phone.** Multi-touch (right + jump) still works.
- [ ] **HUD reads at arm's length** on phone in landscape.

## Spec acceptance per US2

Cross-reference [Story 2 acceptance scenarios](../spec.md#user-story-2--face-stakes-and-gather-rewards-priority-p2):

- [ ] AS-1 — Hero touches enemy → life lost. (Carrots + powerup not on the AS-1 axis; just life loss.)
- [ ] AS-2 — Hero collects a carrot → HUD counter increments.
- [ ] AS-3 — Hero with 0 lives → game over → restart resets everything. (Powerup test deferred — see "Open items" below.)
- [ ] AS-4 — Hero reaches end-trigger → level complete + carrot count persisted (the persistence check lives in T046a, after SaveService integration lands).

## Open items (NOT covered by this commit; tracked for the next one)

These are explicitly deferred:

- **Powerup pickup + invincibility effect** — Hero.applyPowerup(), HUD power-up timer, pickup.ts powerup branch. The Tiled `kind: powerup` is loader-accepted but `LevelScene` skips it with a `console.warn` until the next commit wires it.
- **SaveService integration** — `lifetimeCarrots` + `completedLevelIds` aren't persisted yet. T045.
- **Cross-session persistence playtest** (T046a) — needs T045 first.
- **Accessibility minimum-bar playtest** (T046b) — applies after powerup + HUD are complete.

## Tuning observations (open items)

- _(none yet — fill in after first run)_

## Sign-off

- [ ] US2-alpha (enemy + carrots + lives + game-over) playtest sign-off: ____ (YYYY-MM-DD, @<git-sha>)
- [ ] US2 full sign-off (after powerup + SaveService): ____ (YYYY-MM-DD, @<git-sha>)
