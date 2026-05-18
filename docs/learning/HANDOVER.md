# Handover — carrot-code

**Last updated:** 2026-05-18
**Active branch:** `001-vertical-slice`
**Active PR:** [#1 (draft)](https://github.com/jasaimial/carrot-code/pull/1)
**Current task:** T013–T020 done; next is **T021** (level-loader tests, second test-first module)
**Local dev:** `npm run dev` → http://localhost:5173 → forest-green page with "BootScene stub" text

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
- **Phase 2 (Foundational) in progress** — T012 (scene stubs), T013–T017
  (typed contracts in `src/types/`), T018 (tuning constants in
  `src/config/`), and T019–T020 (first real service: SaveService with
  7 unit tests) all landed. First green tests in `tests/unit/`.
- **Repo is public**, CI is green on PR #1, branch protection on `main`
  requires CI green. Principle VIII is mechanically enforced.

## Quick-start: come back to a working dev loop

From a fresh terminal in the repo root:

```powershell
git status                  # should show clean tree on 001-vertical-slice
npm install                 # idempotent; needed only if node_modules is gone
npm run dev                 # opens dev server at http://localhost:5173

# In another terminal:
npm test                    # vitest (currently 0 tests; pass with passWithNoTests)
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
├── game.ts                ← Phaser game config + scene registration
├── vite-env.d.ts          ← Vite + vite-plugin-pwa type refs
├── types/                 ← T013–T017 — typed contracts (no runtime)
│   ├── runtime-mode.ts    ←   RuntimeMode string-literal union
│   ├── save-state.ts      ←   SaveState + EMPTY_SAVE_STATE frozen const
│   ├── entity-config.ts   ←   EnemyConfig | CarrotConfig | PowerupConfig
│   ├── narrator-beat.ts   ←   NarratorBeat + NarratorTrigger union
│   └── level.ts           ←   LevelData (re-exports narrator types)
├── config/                ← T018 — tuning constants (Principle III)
│   ├── physics.ts         ←   gravity, max fall speed, friction
│   ├── hero.ts            ←   move/jump, coyote+buffer, lives, hit i-frames
│   ├── enemy.ts           ←   default patrol speed, contact knockback
│   ├── powerups.ts        ←   invincibility duration + stack mode + blink
│   └── ui.ts              ←   HUD positions, dialog timings, fonts
├── services/              ← T020 — first real I/O service (Principle XI)
│   └── save-service.ts    ←   SaveService interface + LocalStorageSaveService
│                              StorageLike injection, clock injection,
│                              SaveQuotaExceededError
└── scenes/
    ├── BootScene.ts       ← stub (real: T032)
    ├── MenuScene.ts       ← stub (stays a stub for v0)
    ├── LevelScene.ts      ← stub (real: T034)
    ├── UIScene.ts         ← stub (real: T035 / T043 / T049)
    └── GameOverScene.ts   ← stub (real: T036)

tests/
└── unit/
    └── save-service.test.ts  ← T019 — 7 tests covering the 6 contract
                                  cases + clear(). Storage injection
                                  fake; no jsdom; 100% pass.

(src/systems/, src/entities/, src/data/ — still empty; populated
 through T021–T026 and the user-story phases.)
```

## What's NOT on disk yet (and why that's fine)

- **No level loader** (`src/services/level-loader.ts`) — lands T021/T022
  next (test-first). Same pattern as SaveService: tests RED first, then
  implementation GREEN.
- **No AssetService** (`src/services/asset-service.ts`) — lands T023.
  Shape + empty `assets` array; entries get filled in by user stories.
- **No pure systems** (`src/systems/*`) — lands T024–T026 (coyote-time,
  jump-buffer, physics-helpers), each test-first.
- **No assets** (`public/assets/`) — Phase 3 (US1, T029+).
- **No live deploy URL** — Netlify config exists ([netlify.toml](../../netlify.toml))
  but T058 actually wires the integration. Until then, dev is local only.
- **Config values are placeholders** — the numbers in `src/config/*.ts`
  are reasonable starting points, NOT playtested. T060 (polish) is the
  retune pass; per-task playtest checklists (T037 / T046 / T051) feed it.

## Next 3 actions (Phase 2 services & systems)

With SaveService done, the same test-first pattern applies to the next
three slots:

1. **T021 + T022** — level loader, same TDD shape as T019/T020.
   `tests/unit/level-loader.test.ts` covering the four loader invariants
   from [contracts/level-format.md](../../specs/001-vertical-slice/contracts/level-format.md#loader-contract)
   (RED) → `src/services/level-loader.ts`: pure
   `loadLevel(tiledJson, levelId, levelName, assetBudgetBytes): LevelData`
   + `LevelLoadError` (GREEN). Two commits, pushed together.
2. **T023** — `src/services/asset-service.ts`: `AssetService` interface +
   `AssetDeclaration` type + `KennyAssetService` with an empty `assets`
   array. No tests needed (shape + empty data; user stories fill it in).
3. **T024 (or T025 or T026)** — first pure system, test-first within the
   file pair. Pick coyote-time, jump-buffer, or physics-helpers. All
   three are independent; doing them in this order matches the order
   they're consumed by the hero entity (T033).

After T026, **T027 rewires `game.ts`** to register the scenes properly
with the FPS overlay in dev. Then Phase 2 is done and US1 begins.

Natural stopping points: after T022 (level loader green), after T026
(all pure logic covered), after T027 (Phase 2 checkpoint).

## Open TODOs not blocking anything

These can stay open until they bite:

- **Node 20 in Actions runners** will be deprecated 2026-06-02. Bump to
  Node 22 in `.github/workflows/ci.yml` whenever the runner warning becomes
  an error. Currently informational only.
- **Phaser bundle size warning** in CI build output (1.3 MB). Address
  with code-splitting in the polish phase or when actual gameplay assets
  push us toward a payload budget concern.
- **README live demo line** is a placeholder until T058 (Netlify connect).
  Update after first deploy.
- **CONTRIBUTING.md / CODE_OF_CONDUCT.md / issue templates** — not needed
  until the first stranger opens an issue or PR. See the
  2026-05-17-constitution-v1.1.0 journal entry for the Principle XII
  follow-up.

## How to pick up in a fresh chat

If you're a new agent reading this:

1. Read [.specify/memory/constitution.md](../../.specify/memory/constitution.md) (the rules; v1.1.0).
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
