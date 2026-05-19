# Handover — carrot-code

**Last updated:** 2026-05-18 (Phase 2 complete)
**Active branches:** [`001-vertical-slice`](https://github.com/jasaimial/carrot-code/pull/1) (the slice) and `main` (CI-gated, currently lags the slice)
**Current task:** Spec 002 done. **Spec 001 Phase 2 (Foundational) COMPLETE** as of this commit. Next coding session resumes at **T029** (author `src/data/levels/level-01.tmj` in Tiled).
**Live build:** <https://happy-desert-0fe507f1e.7.azurestaticapps.net> (auto-deploys from `001-vertical-slice` via Azure SWA Free; preview URLs spawn for every other branch / PR)
**Local dev:** `npm run dev` → http://localhost:5173 → forest-green page with "BootScene stub" text + dev FPS overlay top-left

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
- **Phase 2 (Foundational) COMPLETE** — every prerequisite that every
  user story depends on is on disk, typed, and tested. 55 unit tests
  across 6 files; all five gates green (typecheck / lint / format /
  test / build); CI green; live build deploys from the branch.
- **Phase 3 (US1, P1 MVP-floor) next** — starts at **T029**: author
  `level-01.tmj` in Tiled (Kenney CC0 tileset; record exact pack name
  in `public/assets/CREDITS.md`).
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
├── game.ts                ← T027 — full Phaser config (WebGL, pixelArt, arcade
│                            with PHYSICS.gravityY, FIT scale, dom.createContainer
│                            disabled, postBoot registers `devMode` on registry)
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
├── services/              ← T020, T022, T023 — I/O seams (Principle XI)
│   ├── save-service.ts    ←   SaveService interface + LocalStorageSaveService
│   │                          StorageLike injection, clock injection,
│   │                          SaveStateInput (T020b), SaveQuotaExceededError
│   ├── level-loader.ts    ←   T022 — pure loadLevel(tiledJson, levelId,
│   │                          levelName, assetBudgetBytes): LevelData;
│   │                          LevelLoadError on invariant violations
│   └── asset-service.ts   ←   T023 — AssetService + AssetDeclaration;
│                              KennyAssetService (assets array empty in v0)
├── systems/               ← T024–T026 + T027 — pure logic + debug overlay
│   ├── coyote-time.ts     ←   CoyoteTimer state machine (8 tests)
│   ├── jump-buffer.ts     ←   JumpBuffer (8 tests)
│   ├── physics-helpers.ts ←   clamp, pointInRect, pointDistanceSq,
│   │                          nextPatrolDirection (18 tests)
│   └── debug-overlay.ts   ←   T027 — attachFpsOverlay(scene) gated on
│                              registry `devMode`. Production no-op.
└── scenes/
    ├── BootScene.ts       ← stub + attachFpsOverlay (real impl: T032)
    ├── MenuScene.ts       ← stub (stays a stub for v0)
    ├── LevelScene.ts      ← stub (real: T034)
    ├── UIScene.ts         ← stub (real: T035 / T043 / T049)
    └── GameOverScene.ts   ← stub (real: T036)

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

(src/entities/, src/data/, public/assets/ — still empty; populated by
 the user-story phases starting at T029.)
```

## What's NOT on disk yet (and why that's fine)

- **No real level** (`src/data/levels/level-01.tmj`) — lands T029. Until
  then BootScene's stub text is what `npm run dev` shows. The
  `LevelLoadError` test fixtures live in `tests/unit/level-loader.test.ts`
  and exercise the loader without any on-disk .tmj.
- **No `LevelRegistry`** (`src/data/levels/index.ts`) — T030.
- **No hero entity** (`src/entities/hero.ts`) — T033. The coyote-time +
  jump-buffer primitives are ready; the hero wires them up.
- **No assets** (`public/assets/`) — Phase 3 (US1, T029+). `KennyAssetService.assets`
  is intentionally an empty array until US1 + US2 fill it in.
- **Config values are placeholders** — the numbers in `src/config/*.ts`
  are reasonable starting points, NOT playtested. T060 (polish) is the
  retune pass; per-task playtest checklists (T037 / T046 / T051) feed it.

## Next 3 actions (Phase 3, US1 — P1 MVP-floor)

Phase 2 is complete: every prerequisite that every user story depends
on is on disk, typed, and tested. The next coding session opens US1:

1. **T029** — Author `src/data/levels/level-01.tmj` in **Tiled** (the
   tool, not code): a small horizontal level with at least one
   elevated platform (FR-009), a `spawn` point object, a rectangular
   `end` trigger, ground tiles, and a CC0 tileset from Kenney.nl.
   Record the **exact pack name + download date** in
   `public/assets/CREDITS.md` per Principle VII (asset license
   provenance). This step is the only one in Phase 3 that benefits
   from being driven by the maintainer (level design judgement).
2. **T030** — `src/data/levels/index.ts` — typed `LevelRegistry`
   exporting `{ "level-01": () => import("./level-01.tmj?url") }`.
   One-liner per new level.
3. **T031 + T032** — Drop a Kenney CC0 hero spritesheet under
   `public/assets/sprites/hero/` + tileset under
   `public/assets/tilemaps/`; register both in
   `KennyAssetService.assets`; update CREDITS.md. Then implement
   `BootScene` (T032): iterate `assetService.assets`, dispatch on
   `.type`, transition to `LevelScene` with `{ levelId: "level-01" }`.

After T032 the game can actually load assets and transition; T033
(hero entity, wired to coyote-time + jump-buffer), T034 (LevelScene
data-driven), T035 (UIScene touch controls + landscape lock), T036
(GameOverScene), T037 (playtest checklist) complete US1.

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
