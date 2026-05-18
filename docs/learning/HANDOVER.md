# Handover — carrot-code

**Last updated:** 2026-05-18 (end of session)
**Active branch:** `001-vertical-slice`
**Active PR:** [#1 (draft)](https://github.com/jasaimial/carrot-code/pull/1)
**Current task:** T012 done; next is **T013** (typed contracts begin)
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
- **Phase 2 (Foundational) started** — T012 landed (`index.html` + 5 scene
  stubs + main.ts + game.ts + vite-env.d.ts). `npm run dev` opens a
  working Phaser page in the browser.
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
└── scenes/
    ├── BootScene.ts       ← stub (real: T032)
    ├── MenuScene.ts       ← stub (stays a stub for v0)
    ├── LevelScene.ts      ← stub (real: T034)
    ├── UIScene.ts         ← stub (real: T035 / T043 / T049)
    └── GameOverScene.ts   ← stub (real: T036)

(src/types/, src/config/, src/services/, src/systems/, src/entities/,
 src/data/, tests/ — all empty; populated through T013–T026)
```

## What's NOT on disk yet (and why that's fine)

- **No typed contracts** (`src/types/*.ts`) — lands T013–T017. Without
  these the scenes can't talk to the services yet, but the stubs don't
  need them.
- **No services or systems** (`src/services/*`, `src/systems/*`) — lands
  T019–T026. These are pure logic with tests-first.
- **No assets** (`public/assets/`) — Phase 3 (US1, T029+).
- **No tests yet** — Vitest is wired and CI runs it. Tests land alongside
  the modules they cover, per Constitution Principle VI.
- **No live deploy URL** — Netlify config exists ([netlify.toml](../../netlify.toml))
  but T058 actually wires the integration. Until then, dev is local only.

## Next 3 actions (Phase 2 contracts)

The plan is to land typed contracts first (T013–T018), then the service
implementations with tests (T019–T026), then re-wire `game.ts` to use them
all (T027). Per the tasks.md ordering, here are the next three:

1. **T013** — `src/types/runtime-mode.ts` (RuntimeMode string-literal union).
   Tiny file (~10 lines). Tests not needed (type-only).
2. **T014** — `src/types/save-state.ts` (SaveState interface +
   EMPTY_SAVE_STATE frozen constant). Tiny file (~25 lines).
3. **T015** — `src/types/entity-config.ts` (EnemyConfig, CarrotConfig,
   PowerupConfig, EntityConfig discriminated union). ~40 lines.

All three are `[P]` (parallel-safe — different files, no deps). Reasonable
to batch into one commit, since they're all "drop typed shapes into
`src/types/`" with no behaviour. Alternatively one commit each per the
per-task rule we've been following.

After T013-T018, **T019/T020 (SaveService + tests)** is the first place
real behaviour shows up. That's the natural next stopping point if you
want shorter session chunks.

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
