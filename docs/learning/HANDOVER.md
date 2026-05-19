# Handover — carrot-code

**Last updated:** 2026-05-19 (US1 milestone: tilemap renders on screen)
**Active branches:** [`001-vertical-slice`](https://github.com/jasaimial/carrot-code/pull/1) (the slice) and `main` (CI-gated, currently lags the slice)
**Current task:** Phase 3 (US1) underway. **T029 + T030 + T031 + T032 + partial T034 COMPLETE** as of this commit — `npm run dev` now renders `level-01.tmj` (forest tilemap, 60×18 tiles, three platforms) with camera centered on the spawn point. Next is **T033** (hero entity wired to coyote-time + jump-buffer).
**Live build:** <https://happy-desert-0fe507f1e.7.azurestaticapps.net> (auto-deploys from `001-vertical-slice` via Azure SWA Free; preview URLs spawn for every other branch / PR)
**Local dev:** `npm run dev` → http://localhost:5173 → brief "Loading…" → forest level renders with three platforms, two trees, and a dev caption "Level loaded — hero entity lands in T033"

> This doc is a **living snapshot** of where the project is right now. It's
> the single page to read when picking up the project after time away — by
> future-you, by a new agent in a fresh chat, or by anyone joining.
>
> When something material changes, update this file in the same commit.
> History lives in [`docs/learning/journal/`](./journal/); this file is the
> current state.

---

## TL;DR — where we are

- **Phase 1 (Setup) complete** — toolchain, CI, deploy config, README.
- **Phase 2 (Foundational) complete** — every prerequisite is on disk, typed,
  and tested.
- **Phase 3 (US1, P1 MVP-floor) IN PROGRESS** — T029 (Tiled level), T030
  (LevelRegistry), T031 (Kenney asset declarations), T032 (real BootScene
  with async asset preload), and a minimum-viable slice of T034 (tilemap
  renders, camera bounded + centered on spawn) all landed in one commit.
  The first satisfying visible output of the game ships from this PR.
- 55 unit tests across 6 files; all five gates green (typecheck / lint /
  format / test / build); CI green; live build deploys from the branch.
- **Phase 3 (US1) continues** — next is **T033** (hero entity). The hero
  wires the existing coyote-time + jump-buffer primitives to a Phaser
  sprite, adds a collider against the `terrain` layer, and replaces the
  dev caption.
- **Repo is public**, CI is green on PR #1, branch protection on `main`
  requires CI green. Principle VIII is mechanically enforced.

## Quick-start: come back to a working dev loop

From a fresh terminal in the repo root:

```powershell
git status                  # should show clean tree on 001-vertical-slice
npm install                 # idempotent; needed only if node_modules is gone
npm run dev                 # opens dev server at http://localhost:5173

# In another terminal:
npm test                    # vitest (55 unit tests across 6 files)
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
npm run format:check        # prettier --check
npm run build               # vite build → dist/
```

All five validators should be green on `001-vertical-slice` HEAD. If
something is red, **stop and fix before any new feature work** —
Constitution Principle VIII is enforced now.

## Where things live

| Looking for... | Path |
| --- | --- |
| Project rules | [.specify/memory/constitution.md](../../.specify/memory/constitution.md) (v1.1.0) |
| What we're building | [specs/001-vertical-slice/spec.md](../../specs/001-vertical-slice/spec.md) |
| How we're building it | [specs/001-vertical-slice/plan.md](../../specs/001-vertical-slice/plan.md) |
| Ordered task list | [specs/001-vertical-slice/tasks.md](../../specs/001-vertical-slice/tasks.md) |
| Replicable setup how-to | [docs/learning/00-setup-from-zero.md](./00-setup-from-zero.md) |
| Workflow reference | [docs/learning/01-spec-kit-workflow.md](./01-spec-kit-workflow.md) |
| Session-by-session story | [docs/learning/journal/](./journal/) |

## What's on disk

```
src/
├── main.ts                ← Vite entry; mounts Phaser into #game; registers SW
├── game.ts                ← T027 + T032 — full Phaser config (WebGL, pixelArt,
│                            arcade with PHYSICS.gravityY, FIT scale,
│                            dom.createContainer disabled). postBoot seeds
│                            `devMode` + KennyAssetService on the registry.
├── vite-env.d.ts          ← Vite + vite-plugin-pwa type refs
├── types/                 ← T013–T017 — typed contracts (no runtime)
│   ├── runtime-mode.ts    ←   RuntimeMode string-literal union
│   ├── save-state.ts      ←   SaveState + EMPTY_SAVE_STATE frozen const
│   ├── entity-config.ts   ←   EnemyConfig | CarrotConfig | PowerupConfig
│   ├── narrator-beat.ts   ←   NarratorBeat + NarratorTrigger union
│   └── level.ts           ←   LevelData (re-exports narrator types)
├── config/                ← T018 + T018a + T027 — tuning constants (Principle III)
│   ├── physics.ts         ←   gravity, max fall speed, friction
│   ├── hero.ts            ←   move/jump, coyote+buffer, lives, hit i-frames
│   ├── enemy.ts           ←   default patrol speed, contact knockback
│   ├── powerups.ts        ←   invincibility duration + stack mode + blink
│   ├── ui.ts              ←   HUD positions, dialog timings, fonts, FPS overlay
│   └── palette.ts         ←   T018a — PALETTE_HEX + PALETTE color tokens
├── i18n/                  ← T035a — translation seam (Principle III)
│   ├── en.ts              ←   EN catalog + I18nKey + I18nCatalog types
│   └── index.ts           ←   t() lookup, setLocale(), getActiveCatalog()
├── data/                  ← NEW — game-content data (separate from src/types/)
│   └── levels/
│       ├── index.ts       ←   T030 — LevelRegistry: typed map levelId → dynamic
│       │                       import factory returning the .tmj URL
│       └── level-01.tmj   ←   T029 — Tiled JSON map, 60×18 tiles @ 18px, embedded
│                               pixel-platformer-tiles tileset, three platforms,
│                               spawn point + end rectangle on `entities` layer
├── services/              ← T020, T022, T023, T031 — I/O seams (Principle XI)
│   ├── save-service.ts    ←   SaveService interface + LocalStorageSaveService
│   ├── level-loader.ts    ←   T022 — pure loadLevel(); LevelLoadError
│   └── asset-service.ts   ←   T023 + T031 — discriminated-union
│                              AssetDeclaration (image | spritesheet);
│                              KennyAssetService.assets has 2 entries:
│                              the Pixel Platformer tileset image (with
│                              `tilesetName` for level-binding) and the
│                              24×24 character spritesheet.
├── systems/               ← T024–T026 + T027 — pure logic + debug overlay
│   ├── coyote-time.ts     ←   CoyoteTimer state machine (8 tests)
│   ├── jump-buffer.ts     ←   JumpBuffer (8 tests)
│   ├── physics-helpers.ts ←   clamp, pointInRect, pointDistanceSq,
│   │                          nextPatrolDirection (18 tests)
│   └── debug-overlay.ts   ←   T027 — attachFpsOverlay(scene), dev-only.
└── scenes/
    ├── BootScene.ts       ← T032 — resolves level URL via dynamic import,
    │                          queues tilemap + every AssetService
    │                          declaration, transitions to LevelScene on
    │                          loader complete. Owns FPS overlay (until T035).
    ├── MenuScene.ts       ← stub (stays a stub for v0)
    ├── LevelScene.ts      ← partial T034 — builds tilemap from cached JSON,
    │                          binds tilesets via AssetService lookup
    │                          (`tilesetName`), renders every tile layer,
    │                          sets world+camera bounds, centers camera on
    │                          spawn. NO hero yet (T033), NO entity
    │                          dispatch (T041+).
    ├── UIScene.ts         ← stub (real: T035 / T043 / T049)
    └── GameOverScene.ts   ← stub (real: T036)

public/assets/             ← T029 + T031 — Kenney Pixel Platformer (CC0)
├── CREDITS.md             ←   provenance for every asset, per Principle VII
├── tilemaps/kenney-pixel-platformer/
│   ├── tilemap_packed.png ←   180-tile sheet (20×9 @ 18×18)
│   └── License.txt        ←   verbatim upstream CC0 license
└── sprites/kenney-pixel-platformer/
    ├── tilemap-characters_packed.png ← 27-character sheet (9×3 @ 24×24)
    └── License.txt

tests/
└── unit/
    ├── save-service.test.ts      ← T019/T020b — 7 tests
    ├── i18n.test.ts              ← T035a — 3 tests
    ├── level-loader.test.ts      ← T021 — 11 tests (4 invariants + happy
    │                                paths + extensibility safety nets)
    ├── coyote-time.test.ts       ← T024 — 8 tests
    ├── jump-buffer.test.ts       ← T025 — 8 tests
    └── physics-helpers.test.ts   ← T026 — 18 tests
                                    Total: 55 tests across 6 files.

(src/entities/ — still empty; lands T033 with the hero. public/icons/
 still has PWA icon stubs from T011; real icons land T052.)
```

## What's NOT on disk yet (and why that's fine)

- **No hero entity** (`src/entities/hero.ts`) — T033. The coyote-time +
  jump-buffer primitives are ready; the hero wires them up to a sprite
  drawn from the character spritesheet (frame 0 per CREDITS.md). A dev
  caption in LevelScene says "hero entity lands in T033" so the missing
  piece is visible from the running game.
- **No collider between hero and terrain** — part of T033/T034. The
  `terrain` layer is rendered but not yet collision-flagged; that
  happens when the hero exists.
- **No entity dispatch** in LevelScene (enemy / carrot / powerup
  sprites) — US2 (T041) for enemies, US3 (T042) for collectibles. The
  level-loader already parses these; LevelScene just doesn't act on
  them yet.
- **No end-trigger overlap** — lands with the hero. The `endTrigger`
  rectangle is in `LevelData` but no overlap callback is wired.
- **No HUD** (UIScene) — stays a stub until T035 (touch controls +
  landscape lock) / T043 (HUD elements) / T049 (narrator dialog).
- **Config values are placeholders** — the numbers in `src/config/*.ts`
  are reasonable starting points, NOT playtested. T060 (polish) is the
  retune pass; per-task playtest checklists (T037 / T046 / T051) feed it.

## Next 3 actions (Phase 3, US1 — P1 MVP-floor continued)

T029–T032 + partial T034 just landed. The game now loads `level-01.tmj`
and renders it. Next:

1. **T033** — Create `src/entities/hero.ts`. Sprite from
   `hero-pixel-platformer-character-a` frame 0. Wires the existing
   `CoyoteTimer` (T024) and `JumpBuffer` (T025) primitives to actual
   keyboard / pointer input. Reads movement constants from
   `src/config/hero.ts`. Exposes a `Phaser.Physics.Arcade.Sprite` so
   LevelScene can `add.existing(hero)` and `physics.add.collider(hero, terrain)`.
2. **Finish T034** — In `LevelScene.create()`, after `buildTilemap()`:
   - Set collide-by-property (or per-tile-id) on the `terrain` layer
     so the hero can land on it.
   - Instantiate the hero at `level.spawn.{x,y}`.
   - `physics.add.collider(hero, terrain)`.
   - `cameras.main.startFollow(hero, true)` (and drop the
     `centerOn(spawn)` call — the follow takes over).
   - Add an overlap on the `level.endTrigger` rectangle that transitions
     to `GameOverScene` with a `levelComplete: true` outcome.
   - Remove the dev caption from `drawDevCaption()` once the hero is
     visible; replace with HUD when T035 arrives.
3. **T035** — UIScene real impl: on-screen touch controls (left/right/jump
   buttons) + `screen.orientation.lock("landscape")` for mobile. Also
   take over FPS-overlay ownership from BootScene.

After T035 the slice plays end-to-end on desktop AND mobile. T036
(GameOverScene) + T037 (playtest checklist) complete US1.

Natural stopping points: after T029/T030 (level data + registry), after
T032 (BootScene actually loads things), after T034 (hero can move on
the level), after T037 (US1 done, P1 MVP-floor demoable).

## Design ground rules (apply to every new piece of code or content)

These are the cross-cutting rules that haven't earned a dedicated
constitution principle but should be applied without re-asking:

- **Non-blocking degradation.** When something fails that the player
  didn't cause (storage refused a save, asset failed to load, network
  hiccup), the game MUST: (1) keep running, (2) show a non-blocking
  notice if the failure is player-visible, (3) log to console for
  diagnostics, (4) never retry in a tight loop. The first concrete
  example is `SaveQuotaExceededError` (Safari private mode); the same
  rule applies to any future I/O failure.
- **No hardcoded player-visible strings.** All UI text goes through
  `t("key")` from `src/i18n/index.ts`. Even if EN is the only locale,
  the seam stays.
- **No hardcoded colors.** All colors come from `PALETTE_HEX` /
  `PALETTE` in `src/config/palette.ts`. Exception: parse-time-only
  surfaces (index.html `<style>`, vite.config.ts manifest) keep the
  literal but ship with a comment naming the equivalent token.
- **No magic numbers in gameplay code.** All tuning lives in
  `src/config/*.ts`. Per-task playtest checklists feed the polish-phase
  re-tune (T060).
- **Services own all I/O.** Scenes never call `localStorage`, `fetch`,
  or asset URLs directly. Always through a service module.
- **Per-task commits with rationale.** Each commit explains the WHY,
  not just the what, in the body. Per-file scope where possible.

## Future roadmap (not in v0; doors are open)

These are explicitly OUT of scope for the 001 slice but mentioned
here so the architecture decisions don't accidentally close the door:

- **Multi-user profiles.** Each profile would have its own SaveState.
  Door open via the SaveService dependency-injection seam: extend the
  storage key from `carrot-code:v1:save` to `carrot-code:v1:save:<profileId>`
  and have SaveService take a `profileId` arg. Add a ProfileService for
  the picker UI. Estimated <1 day of work when needed.
- **User-selectable levels.** Player picks from a level list at the
  MenuScene. LevelRegistry (T030) is already the seam; what's missing
  is the MenuScene UI + unlock logic gated on
  `SaveState.completedLevelIds`. Per-level tuning stays in code (no
  runtime config tuning); a new level baseline = a redeploy.
- **Backend persistence (sync across devices).** Today SaveService is
  the authority; later it could become a write-back cache for a
  `RemoteSaveService`. The StorageLike interface is the seam. Likely
  triggered by "play on phone, continue on desktop" use case.
- **Difficulty settings.** Easy/Normal/Hard difficulty would layer on
  top of `src/config/hero.ts` via a small `DIFFICULTY_OVERRIDES` map.
  Post-v0; no playtest data justifies it until v0 ships.
- **Server-driven config / live-tune.** Explicit NON-goal. Per
  Constitution Principle XI we don't add network dependencies for
  things that work fine as static files.

## Open TODOs not blocking anything

These can stay open until they bite:

- **Node 20 in Actions runners** will be deprecated 2026-06-02. Bump to
  Node 22 in `.github/workflows/ci.yml` whenever the runner warning becomes
  an error. Currently informational only.
- **Phaser bundle size warning** in CI build output (1.3 MB). Address
  with code-splitting in the polish phase or when actual gameplay assets
  push us toward a payload budget concern.
- **README live demo line** points at the Azure SWA URL since spec 002
  shipped. Re-verify after every infra change.
- **CONTRIBUTING.md / CODE_OF_CONDUCT.md / issue templates** — not needed
  until the first stranger opens an issue or PR. See the
  2026-05-17-constitution-v1.1.0 journal entry for the Principle XII
  follow-up.
- **PWA icons missing** (404 on `/icons/icon-192.png`). The manifest
  declares them; the PNGs land in T052 (under `public/icons/`). Browser
  warning is informational; doesn't break install or play. If the
  warning becomes annoying before T052, comment out the icon block in
  [vite.config.ts](../../vite.config.ts) temporarily.
- **Constitution v1.1.1 ratified 2026-05-18.** Principle III now
  formally requires all player-visible text via `t()` and all colors
  via `PALETTE_HEX` / `PALETTE`. Parse-time-only surfaces (index.html,
  vite.config.ts) carry the literal with a `= PALETTE_HEX.<token>`
  comment so the cross-reference stays grep-able.

## How to pick up in a fresh chat

If you're a new agent reading this:

1. Read [.specify/memory/constitution.md](../../.specify/memory/constitution.md) (the rules; v1.1.1).
2. Read [specs/001-vertical-slice/spec.md](../../specs/001-vertical-slice/spec.md) (what we're building).
3. Read [specs/001-vertical-slice/plan.md](../../specs/001-vertical-slice/plan.md) (how we're building it; Constitution Check at the bottom).
4. Read [specs/001-vertical-slice/tasks.md](../../specs/001-vertical-slice/tasks.md) and find the first unchecked task.
5. Scan the most recent journal entry under [docs/learning/journal/](./journal/) for any open thread.
6. Confirm `npm run dev` works and CI is green on PR #1 before adding new code.

If you're a returning agent or a returning maintainer: this doc + the
latest journal entry should be enough. The slice scope hasn't changed
since 2026-05-14; only progress has.

## Conventions reminders (often-forgotten)

- **Per-task commits**, message prefixed `feat(setup): T0NN` or
  `feat(phase-2): T0NN`. Each commit body should explain *why*, not just
  what.
- **Never run `npm run format`** against the whole repo — it touches
  spec-kit-owned files and introduced mojibake once already. Use
  `npx prettier --write <path>` to format specific files. See the
  2026-05-18 journal (forthcoming) for the recovery story.
- **Stay on `001-vertical-slice`** until the slice ships. Merging to
  `main` requires CI green (now enforced).
- **Update this file** whenever something material changes — current task,
  branch name, open TODOs, what's on disk.
- **Notable spec-kit sessions get a journal entry** per Principle II.6.
  Trivial commits don't.
- **Test-first under CI-gate**: write tests first, observe RED locally,
  `git commit` the tests (don't push), write impl, observe GREEN, commit
  impl, push BOTH commits in one push. CI only sees the GREEN HEAD;
  history preserves the test-first ordering. See commit pair 6087c50 +
  e614673 for the canonical pattern.
- **PowerShell + apostrophes in `-m`**: don't. Use `git commit -F
  .commit-msg.tmp` (then `Remove-Item` it) for any message that has
  single quotes or nested `"`. PowerShell loses the rest of the chained
  command on a stray `'`.

## Memory / agent notes

The agent's persistent memory (across chats) records:

- `/memories/spec-kit.md` — transferable spec-kit setup gotchas.
- `/memories/public-repo-hygiene.md` — Principle XII as a transferable rule.
- `/memories/repo/carrot-code.md` — this project's locked decisions and
  current state. **This file should mirror the project state.** If they
  drift, the on-disk constitution + this handover are authoritative;
  memory is just a cache.
- `/memories/platform-reminders.md` — the platform-injected copyright
  reminder we've been silently ignoring all session is documented here.
  Future agents picking up the project should expect to see it and not
  derail.

### Project-specific subagents

- **`carrot-code-reviewer`** — independent ("judiciary") code/PR review
  pass codifying Constitution v1.1.1 + the design ground rules in this
  file as mechanical checks. Defined at
  [.github/agents/carrot-code-reviewer.agent.md](../../.github/agents/carrot-code-reviewer.agent.md).
  Read-only; reports findings at four severity levels (critical /
  high / medium / low); does not modify files.

  **When to invoke**: before merging any non-trivial PR, or whenever the
  maintainer wants an independent pair-of-eyes pass that wasn't
  authored by the same session that wrote the code. Three modes:
  - `mode: diff` + git-ref pair (e.g. `origin/main...HEAD`) — review
    a changeset
  - `mode: files` + a list of paths — review specific files
  - `mode: spec` + a `specs/NNN-*/` dir — review the spec/plan/tasks
    set as an internally consistent unit

  **Trigger phrases the orchestrating agent should recognise**:
  "review this PR", "run the reviewer agent", "independent check on
  the 00X spec", "pair of eyes on these changes". Surface as a
  `runSubagent` call with `agentName: "carrot-code-reviewer"`.

  **Use after 002 ships**, per the v1.1.2 amendment proposal:
  any plan with new infrastructure or new dependencies SHOULD invoke
  this reviewer (in addition to `/speckit.analyze`) before
  implementation begins.
