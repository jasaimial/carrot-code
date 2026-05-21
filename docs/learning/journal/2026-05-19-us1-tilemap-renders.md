# Journal — 2026-05-19 — US1 milestone: tilemap renders

> Tasks: T029, T030, T031, T032, partial T034.

## Context

Picking up after Phase 2 closed on 2026-05-18. Phase 3 (US1, P1 MVP-floor) opens at **T029**: hand-author the first Tiled level. The session goal was to land the smallest visible game outcome — a real level rendered from a real `.tmj` — by bundling T029 + T030 + T031 + T032 plus enough of T034 to actually see something on screen.

## What happened

- Selected the [Kenney Pixel Platformer pack](https://kenney.nl/assets/pixel-platformer) (CC0, v1.2). Drafted, then iteratively cleaned, `public/assets/CREDITS.md` with a preamble + per-pack convention section + future-expansion accommodation (Industrial Expansion docked as a commented-out template block).
- Established the **asset organization convention** in CREDITS.md: per-pack subdirectories under `public/assets/<category>/`, namespaced Phaser asset keys (`<category>-<pack-slug>-<asset-name>`), and per-subdir verbatim `License.txt` copies. Goal: adding a future pack should be a directory + a couple of `AssetDeclaration` lines, never a refactor.
- Copied four files into the repo: the 5.9 KB packed tilemap PNG, the 2.0 KB 27-character spritesheet, and a `License.txt` in each subdirectory (the latter on the principle that each pack subdir should be self-contained).
- Walked the maintainer through Tiled step-by-step (their first time): New Map → import tileset (embed in map) → rename layer to `terrain` → paint floor + three platforms + tree-trunk decorations at both edges → add `entities` object layer → add spawn point + end rectangle → set custom property `kind` on both → Save As `.tmj`.
- The resulting `src/data/levels/level-01.tmj` was verified by running it through the existing pure `loadLevel()` from a throwaway Vitest. Spawn at (61, 296), end rectangle 36×54 at (1026, 252). All four loader invariants pass without modification.
- Wrote the surrounding code in dependency order:
  - **T031 / `asset-service.ts`** — replaced the loose `AssetDeclaration` interface with a discriminated union (`ImageAssetDeclaration | SpritesheetAssetDeclaration`), added an optional `tilesetName` field on the image variant (the seam that lets a level's tileset bind to an asset by name), filled in the two real Kenney declarations.
  - **T030 / `src/data/levels/index.ts`** — typed `LevelRegistry` mapping `LevelId` → dynamic-import factory returning the `.tmj` URL. Adding a level is a one-line append; Vite code-splits each level into its own chunk for free.
  - **T032 / `BootScene.ts`** — full rewrite from stub. Resolves the requested level's URL via `LevelRegistry`, queues the tilemap + every `AssetService` declaration, transitions to `LevelScene` on loader complete. Shows a brief `Loading…` text. Owns the FPS overlay until UIScene graduates.
  - **Partial T034 / `LevelScene.ts`** — minimum-viable render: build tilemap from cached JSON, dynamically bind each `.tmj` tileset to its `AssetDeclaration` via `tilesetName` (handles multi-tileset levels natively for the expansion-pack accommodation we promised), render every tile layer, set world + camera bounds, center camera on spawn. Plus a dev caption explaining the missing pieces. No hero yet (T033), no collider, no entity dispatch.
  - **`game.ts`** — `postBoot` now seeds the shared `KennyAssetService` onto the scene registry alongside the `devMode` flag.
- All five gates green: typecheck, lint, format, 55 tests, build. Bundle adds a code-split 5.81 KB `dist/assets/level-01-<hash>.tmj` plus a tiny dynamic-import wrapper chunk.

## Decisions

| Decision | Rationale | Reversible? |
|---|---|---|
| Embed the Pixel Platformer tileset inside `level-01.tmj` rather than ship it as a sibling `.tsj` | One file per level keeps deploys simple; if multiple levels share a tileset later we can promote it to external | Yes — Tiled can convert between embedded/external in-place |
| Discriminated-union `AssetDeclaration` (image vs spritesheet) instead of one interface with optional fields | Type-safer; adding a new asset type later is a compile-time error in BootScene until handled (caught by the `switch` exhaustiveness) | Yes — collapse back to optional fields if it becomes annoying |
| Tileset binding goes through `ImageAssetDeclaration.tilesetName`, not a separate `TilesetImage` type | Phaser uses `this.load.image()` for both regular images and tileset images; the discriminant is "is there a `tilesetName`?", not loader-API choice | Yes — promote to separate variant if we add other tileset-only fields |
| `LevelRegistry` uses dynamic-import factories (`() => import(...)`), not static URL imports | Honors the original spec language; gets Vite code-splitting for free; supports future multi-level lazy-loading | Yes — flatten to static if we never end up with N levels |
| Hero character: frame 0 of the Kenney pack (top-left character) as the v0 placeholder | Decisively pick *something* now so T031/T032 can ship; recolor / custom carrot art lands in a later iteration as an original-asset commit | Trivially — change one number in `asset-service.ts` |
| Bundle T029 + T030 + T031 + T032 + partial T034 in one commit (Option B) | T029 alone is a data drop with no visible effect; bundling delivers the first satisfying visible output, lets the commit message describe one milestone, keeps history readable | Hard — would need `git rebase -i` to split |
| Tilemap rendered via `make.tilemap({ key })` + dynamic tileset binding loop (not a hardcoded `addTilesetImage` call) | Supports the multi-pack expansion case (Pixel Platformer + Industrial Expansion in one level) without a future refactor; barely more code than the hardcoded path | Yes |

## What worked

- The Tiled walkthrough hit no real friction. The maintainer went from "what's a tileset?" to a saved `.tmj` that passes all loader invariants in one session.
- The pure `loadLevel()` paid for itself instantly: a throwaway 20-line Vitest verified the on-disk `.tmj` against the contract before any scene code touched it. That's the "test the data, not just the code" Principle VI win.
- Asset organization convention turned an open question ("how do we handle the Industrial Expansion later?") into a documented, tested-by-design pattern in CREDITS.md. Adding the expansion is now a directory + a `tilesetName`-tagged `AssetDeclaration`, no refactor.
- Discriminated union on `AssetDeclaration` made BootScene's queue loop compile-time-exhaustive. Adding audio support later will error in `queueAsset()` until we handle the variant — exactly the discipline we want.
- Three platforms instead of one was a great call from the maintainer — gives the slice a genuine "jump up, jump across, jump up higher" feel rather than the FR-009 minimum.

## What didn't

- **`create_file` tool kept doubling content** on both BootScene.ts and LevelScene.ts. Pattern: file got exactly `2 × intended_content` bytes. Root cause likely: the file was open in the editor, and the create call concatenated rather than replaced. Cost: ~20 min of confused fix-attempts.
- **`Set-Content -NoNewline | Get-Content` chain stripped every line ending**, leaving both files as one giant string. Looked OK in line count (`Measure-Object -Line` returned 1) but obvious in `(Get-Item).Length` and the read_file output. Recovery: wrote a Node `_scene-rewrite.mjs` that did `fs.writeFileSync` with proper newlines.
- **Prettier interpreted `+` and `-` at line starts as Markdown list markers** in the first CREDITS.md draft, mangling the preamble. Fix: rewrite the preamble as flowing prose with explicit bullets only where I meant them. Lesson: when prettier formats, it's normalizing to the strictest interpretation of the syntax — write Markdown that can't be misread as something else.
- The HANDOVER edit batch had an internal overlap: edit #2 ate the "Next 3 actions" section, then edit #3 tried to also replace it and failed. Recovered by re-inserting the section as a separate replace.

## What I'd do differently

- **For multi-file full-rewrites: write a Node script from the start.** `create_file` on already-open files is unreliable. Node's `fs.writeFileSync` is the deterministic primitive.
- **Don't use `Set-Content -NoNewline` for restoring lost content.** The `-NoNewline` flag means "no trailing newline on the whole file," but for a pipeline of input strings it ALSO drops separators. Use plain `Set-Content`, or for real fidelity use Node.
- For HANDOVER edits via multi-replace: when two edits target adjacent sections, do them as separate calls or merge their target text into a single edit. The conflict-detector can't handle overlap.

## Open questions / next session

- [ ] **T033** — author `src/entities/hero.ts`. Wire the existing `CoyoteTimer` + `JumpBuffer` primitives to Phaser keyboard input. Sprite uses `hero-pixel-platformer-character-a` frame 0.
- [ ] **Finish T034** — flag the `terrain` layer as collide-able; instantiate the hero at `level.spawn`; add a collider; replace `cameras.main.centerOn(spawn)` with `startFollow(hero)`; add an end-trigger overlap.
- [ ] Verify the live deploy on Azure SWA still shows the level after the build chunk-split lands (`level-01-<hash>.tmj` should serve correctly under the `/assets/` cache policy).
- [ ] The Phaser bundle is now 1.36 MB (warning in build output) — still on the "address in polish phase" list, not blocking.

## Artifacts touched

- `public/assets/CREDITS.md` (new)
- `public/assets/tilemaps/kenney-pixel-platformer/{tilemap_packed.png,License.txt}` (new)
- `public/assets/sprites/kenney-pixel-platformer/{tilemap-characters_packed.png,License.txt}` (new)
- `src/data/levels/level-01.tmj` (new — authored in Tiled)
- `src/data/levels/index.ts` (new — LevelRegistry)
- `src/services/asset-service.ts` (discriminated union + 2 real declarations)
- `src/scenes/BootScene.ts` (full rewrite from stub)
- `src/scenes/LevelScene.ts` (full rewrite from stub; partial T034)
- `src/game.ts` (postBoot seeds AssetService)
- `src/i18n/en.ts` (new keys `boot.loading`, `dev.levelLoaded`)
- `docs/learning/HANDOVER.md` (current-state refresh)
- `.vscode/settings.json` (terminal auto-approve entries cleaned up)
