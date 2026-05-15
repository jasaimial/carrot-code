# Journal — 2026-05-14 — Spec + Plan (Vertical Slice)

Third major session of the day. First time running both `/speckit.specify`
and `/speckit.plan` end-to-end on a substantive feature. Two sessions
combined into one entry per the option-(b) decision: the arc from
"empty branch" to "planning-ready, design-complete" is more useful told
together than as two thin entries.

## Context

Constitution v1.0.0 had just been ratified ([previous entry](./2026-05-14-constitution.md)).
Per its Principle V, the project's MVP is *one polished level shipped
end-to-end* before any breadth work begins — this entry covers the spec
and plan for that exact scope.

Goal at start of session:

1. Run `/speckit.specify` for the vertical slice — produce a real
   feature spec under `specs/001-vertical-slice/`.
2. Run `/speckit.plan` for the same feature — produce a real
   implementation plan plus Phase 0 (research) and Phase 1 (design)
   artifacts.
3. Honor every constitution principle, mechanically (CI gates) and
   structurally (project structure encodes the rules where possible).

## What happened

### The `/speckit.specify` half

1. **Pre-execution hook fired** — `before_specify` ran
   `speckit.git.feature`, which created branch `001-vertical-slice` and
   returned `{"BRANCH_NAME":"001-vertical-slice","FEATURE_NUM":"001",
   "HAS_GIT":true}`. The hook script does NOT create the spec
   directory or `feature.json` itself — those are the agent's job per
   the prompt. Caught this from a follow-up `Test-Path` check.

2. **Wrote `specs/001-vertical-slice/spec.md`** end-to-end in one pass:
   4 user stories (P1-P4), 43 functional requirements grouped by topic
   (hero/input, level, enemy, carrot, power-up, lives, narrator, HUD,
   PWA, deployment, browser support, accessibility), 11 edge cases,
   7 measurable success criteria, 11 assumptions, 4 dependencies.

3. **Deliberately avoided implementation details** in the spec
   (Principle II discipline) — engine, language, build, deploy targets,
   testing framework, asset license baseline are explicitly *not*
   re-litigated since they live in the constitution.

4. **Left exactly one `[NEEDS CLARIFICATION]` marker** at FR-014:
   enemy-defeat model. Refused to default this — it shapes the whole
   gameplay feel and the power-up's purpose, so it deserves a real
   choice. Surfaced as Q1 with three options + custom + clear
   implications per option.

5. **Spec quality checklist** at `specs/001-vertical-slice/checklists/
   requirements.md` — 16 items, 15 passing, 1 (the [NEEDS CLARIFICATION]
   one) honestly marked open. Reported the validation pass-fail
   transparently rather than hiding the open item.

6. **User chose Q1 = B** (avoidance-only enemy; power-up grants
   invincibility / pass-through). Updated FR-014, FR-020, edge cases,
   assumptions, and key entities in one multi-replace pass. Added a new
   Story-2 acceptance scenario covering the powered-pass-through case.
   Updated the checklist to reflect all-pass status.

7. **Committed as `fae3136`** with the message
   `docs(spec/001): vertical slice spec, Q1 resolved (avoidance-only enemy)`.

### The `/speckit.plan` half

1. **Pre-execution hook** (`before_plan` = optional `speckit.git.commit`)
   was a no-op — tree was clean from the spec commit. Skipped.

2. **`setup-plan.ps1`** copied the unfilled `plan-template.md` into
   `specs/001-vertical-slice/plan.md`. First reflex was to `create_file`
   the new content, which failed because the template was already there;
   correct approach was a single full-file `replace_string_in_file`.
   Lesson: spec-kit's setup scripts populate placeholder files; the
   agent's job is to *replace* their content, not create from scratch.

3. **Drafted plan + 7 design artifacts in parallel** — Vite created all
   the new files concurrently except the in-place `plan.md` replacement.
   Total ~660 lines of new design content:

   - `plan.md` (168 lines) — Summary, Technical Context, Constitution
     Check (all 11 principles ✅, table format), Project Structure,
     Complexity Tracking explicitly empty.
   - `research.md` (96 lines) — 9 tech-decision Q&As (engine, PWA
     tooling, storage, touch controls, tilemap format, hosting, audio
     defer, CI shape, package manager) with alternatives + rejected-
     because.
   - `data-model.md` (132 lines) — typed shapes for `RuntimeMode`,
     `EntityConfig` (discriminated union), `NarratorBeat`, `LevelData`,
     `SaveState`. Principle XI's serializability enforced at the type
     level via `readonly` everywhere and the `JSON.stringify`-able
     constraint stated explicitly.
   - `contracts/README.md` — explains what "contracts" means in a
     no-backend project.
   - `contracts/level-format.md` — Tiled JSON + our custom-property
     schema + loader contract + invariants tested in Vitest.
   - `contracts/save-state.md` — storage key, payload, SaveService
     behaviour, all six unit-test cases enumerated.
   - `contracts/services.md` — `SaveService` + `AssetService` TS
     interfaces; explicit "what scenes can / can't do" rules.
   - `quickstart.md` — clone-install-run-test-build-deploy in under
     5 minutes; clearly framed as "describes the target experience the
     implementation tasks must satisfy" since the source tree doesn't
     exist yet.

4. **Constitution Check**: all 11 principles passed. Three principles
   are now *structurally* enforced (the project structure encodes
   the rule), not just policed at review:

   - Principle IV via the generic `LevelScene` + `LevelRegistry` +
     discriminated-union `EntityConfig` design — adding level 2 is
     literally one JSON file + one registry entry.
   - Principle XI via typed `SaveState` (frozen empty default,
     `readonly` everywhere) + `services/` directory holding all I/O.
   - Principle X via the per-level `assetBudgetBytes` field on
     `LevelData` + a build-time verifier task that fails the build if
     declared bytes are exceeded.

5. **No Complexity Tracking entries** — meaningful: it means I didn't
   need to justify any deviation from the constitution. If we ever do,
   the section is there.

6. **Committed as `c43fefa`** with a multi-line message summarising
   each artifact.

## Decisions

| Decision | Rationale | Reversible? |
|---|---|---|
| Vertical-slice = exactly the spec's 4 stories | Principle V is the whole reason this branch exists | N/A |
| Phaser 3 (not Pixi / KAPLAY / Excalibur / Phaser 4) | MIT, mature, first-class Tiled support, large community, good TS types | Hard mid-project, easy at v0 |
| `vite-plugin-pwa` (not hand-rolled SW) | iOS Safari edge cases are well-handled; v0 is not the time to learn SW gotchas | Easy — can hand-roll later as a learning track |
| `localStorage` save (not IndexedDB) | Save shape is small + sync; matches the rest of the game loop | Easy — `SaveService` interface lets us swap storage |
| Hand-rolled touch overlay (not a plugin) | ~50 lines, demonstrably correct, aligns with learning goals | Easy |
| Tiled JSON `.tmj` (not CSV / custom) | Need object layers for entity placement; Phaser has direct loaders | Easy |
| Netlify (not GH Pages / Cloudflare Pages) | Better header / redirect story via `netlify.toml`; deploy previews on PRs | Easy |
| Defer audio to a follow-up spec | Principle V (no scope creep beyond the slice) | N/A |
| Single CI job (typecheck → lint → test → build) | Simpler than matrix; complexity not yet earned | Easy |
| `npm` (not pnpm / yarn) | Ships with Node, no extra prerequisite | Easy |
| Per-level `assetBudgetBytes` enforced at build | Cheap teeth on Principle X without building a benchmark suite | Easy |
| Contracts are markdown, not JSON-Schema or OpenAPI | We have no over-the-wire contracts; markdown + TS interfaces are the actual artifacts | Hard — would mean adding a schema toolchain |
| One combined journal entry for spec+plan | Richer narrative than two thin entries; matches the option (b) you chose | N/A |

## What worked

- **Asking Q1 instead of defaulting it.** Resisting the urge to pick
  "stomp Mario-style because it's familiar" was the right call — your
  answer (B, avoidance-only) materially changed FR-020 and added an
  acceptance scenario that wouldn't have existed otherwise.
- **Surfacing the spec-quality checklist honestly.** 15-of-16 with one
  open item, named, was more useful than fudging to 16-of-16 by
  papering over the missing answer.
- **Constitution Check as a literal table in `plan.md`.** Forced one
  explicit pass-or-fail decision per principle. The exercise of writing
  "✅ — here's exactly how this principle is honored in the plan" caught
  two soft spots before they became bugs (the asset-budget verifier as
  a task, and the explicit `localStorage`-not-in-scenes rule in
  `services.md`).
- **Designing the structure to *enforce* the constitution where
  possible** (`services/` for Principle XI, `data/levels/index.ts` for
  Principle IV, `assetBudgetBytes` on `LevelData` for Principle X).
  Structural enforcement is worth more than review-time enforcement.
- **Parallel `create_file` calls.** Most of the design artifacts are
  independent — creating them in one tool batch saved real round-trip
  time.

## What didn't

- **Forgetting `plan.md` was already populated by `setup-plan.ps1`.**
  Tried `create_file` first; got "already exists" error. Switched to
  `replace_string_in_file` with the full template content as the old
  string. Lesson: spec-kit's `setup-*.ps1` scripts populate placeholder
  files. Always check.
- **Said I'd write the journal "now" and didn't.** Closed out the plan
  commit thinking I'd written it, then sent a status message instead.
  User had to ask. This entry exists because of that prompt — and the
  acknowledgement is itself the lesson: don't claim to do something
  in the same turn that didn't actually do it.
- **The repeating platform-level copyright reminder kept appearing**
  inside tool outputs and even as standalone-looking message frames.
  Documented in user memory after the first session; correct response
  is silent ignore. Took until mid-plan to fully internalize that and
  stop calling them out individually.

## What I'd do differently

- **Always probe what `setup-*.ps1` scripts have already written**
  before drafting. One `Get-Content -Raw` is cheaper than a failed
  `create_file`.
- **Write the journal before the next slash-command, not "I'll do it
  next."** The honest pattern is: complete artifact → commit it →
  journal entry → commit journal → only THEN move to the next phase.
  Mixing the journal commit into the next phase loses the "ratified
  state" property of the previous phase.
- **Treat the Constitution Check table as a forcing function during
  drafting, not a verification at the end.** Three of the structural
  enforcement decisions came from the table-writing exercise itself.
  Better to write the table early and let it shape the structure.

## Open questions / next session

- [ ] Run `/speckit.tasks` to generate `specs/001-vertical-slice/tasks.md`
  from spec + plan + data-model + contracts. Expected output: ~25-35
  ordered tasks grouped by user-story (per the tasks template), with
  `[P]` parallel-safe markers and explicit file paths.
- [ ] Decide whether to run `/speckit.analyze` between `/speckit.tasks`
  and `/speckit.implement`. For this project's spec-kit-practice
  goal, almost certainly yes — even if it finds nothing, the
  experience of running it is part of the practice.
- [ ] Push to GitHub remote. Proposed timing: after `/speckit.tasks`,
  before `/speckit.implement`. The first push will then include
  constitution + spec + plan + tasks + the learning docs — a
  substantive baseline rather than an empty repo. Configure branch
  protection on `main` immediately after the push (Principle VIII).
- [ ] First time the implementation hits a constitution gate (an
  ESLint error blocking a PR, an asset budget exceeded, an iOS
  install regression), write that down. Those will be the highest-
  value journal entries for the team-share material.

## Artifacts touched

- `.specify/feature.json`
- `specs/001-vertical-slice/spec.md`
- `specs/001-vertical-slice/checklists/requirements.md`
- `specs/001-vertical-slice/plan.md`
- `specs/001-vertical-slice/research.md`
- `specs/001-vertical-slice/data-model.md`
- `specs/001-vertical-slice/quickstart.md`
- `specs/001-vertical-slice/contracts/README.md`
- `specs/001-vertical-slice/contracts/level-format.md`
- `specs/001-vertical-slice/contracts/save-state.md`
- `specs/001-vertical-slice/contracts/services.md`
- `docs/learning/journal/2026-05-14-spec-and-plan.md` (this file)

## Commits

```
c43fefa  docs(plan/001): vertical slice plan + Phase 0/1 design artifacts
fae3136  docs(spec/001): vertical slice spec, Q1 resolved (avoidance-only enemy)
```

## Reproducibility note

- spec-kit CLI: `specify-cli==0.8.10` (commit `587feaac137ced14b8a86f60d3775ae36b54933c`).
- `uv` 0.11.13.
- Agent: GitHub Copilot Chat in VS Code.
- Branch at end of session: `001-vertical-slice` (two commits ahead of `main`).
