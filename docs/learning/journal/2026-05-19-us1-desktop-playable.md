# Journal — 2026-05-19 (evening) — US1 desktop-playable

> Tasks: T033, T034 (finish), T036, T037 (checklist authored).
> Builds on the afternoon's [tilemap-renders entry](./2026-05-19-us1-tilemap-renders.md).

## Context

The afternoon session shipped the visible tilemap (T029–T032 + partial T034). The user picked "Option A" from the offered plan: solo through everything I can verify on desktop, leave T035 (mobile) for a later phone-in-hand session. The goal: by end-of-evening, `npm run dev` lets you play the level you authored in Tiled this afternoon, with a working game-over screen.

## What happened

- **Test-first for the hero resolver.** Wrote `tests/unit/hero.test.ts` (13 cases covering: horizontal direction including both-held-cancels, jump on press when grounded vs in-coyote vs past-coyote, jump-press buffering when can't jump, jump on land via consumed buffer, variable-height release-cap including the "not capped if still held" and "not capped if already falling" cases). Tests RED until the resolver existed.
- **Split the hero into two modules.** First attempt put both the pure resolver and the Phaser sprite class in one file. Vitest tried to load the file → Phaser tried to find a window/WebGL → cascade of "Cannot read properties of undefined" failures during test discovery. Refactored into:
  - `src/entities/hero-input.ts` — pure resolver + types. Zero Phaser imports.
  - `src/entities/hero.ts` — Phaser sprite class that re-exports from `hero-input.ts` for one-import-path convenience. Tests now import directly from `hero-input.js`.
- Tests pass GREEN immediately on first resolver implementation (no debug iteration needed — the test cases drove the implementation correctly).
- **Finished T034 in `LevelScene`.** Restructured `create()` into seven private helpers (read cache, parse, build tilemap, render with collision, spawn hero, configure camera, set up end-trigger). Added `override update(time, delta)` that forwards to `hero.update(delta)`. The `terrain` layer now `setCollisionByExclusion([-1, 0])` so every non-zero tile id is solid. Camera switched from `centerOn(spawn)` to `startFollow(hero, true)` (the `true` second arg = `roundPixels` to avoid sub-pixel tile-edge jitter).
- **End-trigger overlap.** Built an invisible `add.zone` matching `level.endTrigger.{x,y,w,h}`, made it a static physics body, registered an overlap with the hero that pauses the scene and transitions to `GameOverScene` with `{ outcome: "complete", levelId }`. Added a subtle orange outlined rectangle as a visual hint so the player can see where they're heading.
- **GameOverScene full rewrite.** Two outcomes (`"complete"` vs `"gameover"`), localized headline via `t()`, big Play-again button with hover + click + Enter + Space all working, dimmed panel behind the text for legibility. Restart goes through BootScene → fresh LevelScene cycle (cleanest way to rebuild the level state).
- **T037 playtest checklist** authored at `specs/001-vertical-slice/playtests/us1.md`. Setup → keyboard play-through → end-trigger flow → spec acceptance cross-reference → tuning-observations block → sign-off line. T035 mobile section deferred with a note.
- **Phaser 4 type narrowing surprise.** `map.createLayer()` now returns `TilemapLayer | TilemapGPULayer` (the GPU variant is new). Had to narrow with `instanceof Phaser.Tilemaps.TilemapLayer` before assigning to a `TilemapLayer | null` variable.
- **TS strict `override` requirement** caught `update()` not being marked `override` on the `Hero` class (since `Phaser.Physics.Arcade.Sprite` already has one). One-word fix.
- All 5 gates green: typecheck, lint, format, **68 tests across 7 files** (was 55, +13 hero), build.

## Decisions

| Decision | Rationale | Reversible? |
|---|---|---|
| Split hero into pure resolver + Phaser sprite (two files) instead of one | Tests can't import Phaser in node without a giant mock. Pure resolver in its own file = clean unit tests; sprite class re-exports the types for convenience | Yes — merge later if it becomes annoying |
| `HeroInput` is a plain `{left, right, jumpPressed, jumpHeld}` interface, not an input-source abstraction | T035 just publishes the same flag set from pointer events; no abstraction needed | Yes |
| `setCollisionByExclusion([-1, 0])` instead of `setCollisionByProperty({ collides: true })` | The Kenney tileset doesn't ship per-tile properties; using "every tile != 0" is the no-config path that works today. Per-tile collision granularity (e.g. one-way platforms) can be added later by toggling specific ids | Yes — easy migration once a level needs per-tile policy |
| Restart goes BootScene → LevelScene (full cycle) rather than `scene.restart()` | Phaser's `scene.restart()` keeps cached assets but the LevelScene was paused, not stopped, on the overlap, so the cleanest reset is a full unload | Hard — switch would mean changing the overlap handler to stop-not-pause |
| `playtests/us1.md` lives in `specs/001-vertical-slice/playtests/`, not at repo root | It's a per-spec artifact and updates as the spec evolves; co-locating with the spec makes it findable | Yes |
| Player-visible orange outline on the end-trigger | Without a hint, the player walks past the end-rect since it's invisible. The outline uses `PALETTE_HEX.uiCarrot` for thematic consistency | Trivially — change opacity or remove |

## What worked

- **Test-first paid off.** All 13 resolver cases passed on first implementation run. Catching the "both held cancels" case in tests-first saved a "why does the hero stop randomly?" debug session.
- **Pure-resolver split** stayed under 130 lines and is easy to read. The Phaser sprite class is also ~90 lines of mostly wiring, with the actual decision logic delegated to the resolver.
- **Helper-method refactor of `LevelScene.create()`** (seven private methods) made the scene feel structured rather than a 60-line linear blob. Each helper is one concept, named for its concept.
- **`Phaser.Tilemaps.TilemapLayer` narrowing trick** (instanceof before assigning) is clean; documenting it as a comment so future-me doesn't wonder why.
- **The journal+HANDOVER discipline** held up — coming back to this evening's session after the afternoon's was instant; just read the latest HANDOVER and pick up.

## What didn't

- **`create_file` doubled `GameOverScene.ts` again.** Pattern fully confirmed now: when the file existed (even as a stub), `create_file` appends the new content rather than overwriting. The stub's old "Stub for T012" comment ended up after my real implementation. Fix: Node truncation script. Going forward I should: (a) `Remove-Item` first (which I did for BootScene/LevelScene), or (b) when the file's a fresh stub, accept it'll need a truncate pass.
- **`node` one-liner for `_hero-write.mjs` script had a stray trailing backtick** that crashed before writing — wasted ~30 seconds. Lesson: ALWAYS terminate the template literal before `writeFileSync()`.
- **Phaser 4 GPU layer variant** added a small type-narrowing hassle I didn't see coming. The Phaser 4 migration notes didn't surface in my context.

## What I'd do differently

- **For `create_file` on a stub:** treat it like rewriting a file, not creating one. Either `Remove-Item` first, OR write the new content + truncate after, OR use a Node script.
- **Stop using multi-line PowerShell here-strings (`@"..."@`) inside `run_in_terminal` commands** to generate file content. The newline preservation is unreliable across the chain (`@".."@` → stdin → `Out-File` → file). Node `fs.writeFileSync` is the deterministic primitive for this.

## Open questions / next session

- [ ] **Walk through [playtests/us1.md](../../specs/001-vertical-slice/playtests/us1.md).** First time the maintainer actually plays the level. Expect tuning observations — jump arc, gravity, the variable-height feel.
- [ ] If jump feels off: tune `HERO.jumpVelocityPxPerSec` and/or `PHYSICS.gravityYPxPerSec2`. Goal: from a standing start, hold-jump just clears the first platform (3 tiles up); short-tap-jump doesn't.
- [ ] **T035 in a phone-in-hand session.** Local LAN test (`npm run dev -- --host`) on user's phone, watch the touch buttons behave, tune button positions / hit-boxes.
- [ ] Commit message says "almost done with US1" but T037 sign-off line is unchecked until the maintainer runs the playtest. Strictly speaking US1 isn't done-done until that sign-off.
- [ ] The 1.36 MB Phaser bundle warning is still flagged in build output. Not blocking; address in polish phase.

## Artifacts touched

- `tests/unit/hero.test.ts` (new — 13 tests)
- `src/entities/hero-input.ts` (new — pure resolver)
- `src/entities/hero.ts` (new — Phaser sprite + re-exports)
- `src/scenes/LevelScene.ts` (T034 finish: collider, hero spawn, camera follow, end-trigger overlap)
- `src/scenes/GameOverScene.ts` (full rewrite from stub)
- `specs/001-vertical-slice/playtests/us1.md` (new — T037 checklist)
- `docs/learning/HANDOVER.md` (current-state refresh)
