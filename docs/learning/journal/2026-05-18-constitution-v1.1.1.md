# Journal — 2026-05-18 — constitution v1.1.1 + PR review follow-ups

## Context

End of a long session focused on Phase 2 foundational work. Earlier in
the session: T013–T020 landed (typed contracts, config constants,
SaveService test-first pair). Then the maintainer did a PR review walk-
through (j-style numbered items) covering both implementation details
and architectural questions. The review surfaced two recurring "why is
this hardcoded?" questions (colors and strings) that the existing
constitution didn't have a clear answer for.

This entry is the formal close-out of:

- the PR review action items (T020b, T018a, T035a, plus three docs commits)
- the constitution amendment ratifying the two new MUST bars

## What happened

Chronologically:

1. **T019 → T020 (SaveService).** Test-first pair: 7 tests RED → impl GREEN
   → both pushed together so CI only ever sees the green state. First real
   test-first commit pair under the now-enforced branch protection;
   confirmed the "commit-then-push-both" protocol works.
2. **PR review walk-through.** The maintainer asked 11 numbered questions
   covering localStorage practice, version handling, missing Phaser
   on-ramp, hardcoded colors, hardcoded strings, multi-profile future,
   `SaveQuotaExceededError` semantics, and the `lastPlayedAtIso`
   ambiguity. Most answers were "you're right, let's fix it now."
3. **T020b.** Tightened `SaveService.save()` from `state: SaveState` to
   `state: SaveStateInput = Omit<SaveState, "lastPlayedAtIso">`. The
   discard becomes a compile-time fact rather than a runtime surprise.
   Updated data-model.md from "written by SaveService" (ambiguous) to
   "assigned by SaveService.save() at write time. The caller-supplied
   value is ignored."
4. **docs(contracts) versioning protocol.** Two version concepts existed
   in the save-state contract (`version: 1` in-payload + `:v1:` in
   storage key) but their distinct purposes weren't written down. Added
   a "Versioning protocol" section with a 2-column table, a migration
   code sketch, and explicit "when to bump each."
5. **docs(learning) 02-phaser-101.md.** A ~250-line on-ramp memo: what
   Phaser is and isn't, the four-method scene lifecycle, parallel
   scenes (the HUD pattern), arcade physics in 60 seconds, asset loader
   indirection, registry + event emitter, where every concept lands in
   this codebase, ten common footguns.
6. **T018a color palette.** All hex literals in `src/scenes/*.ts` and
   `src/game.ts` now import from a new `src/config/palette.ts` module
   (`PALETTE_HEX` + `PALETTE`). Parse-time-only surfaces
   (`index.html`, `vite.config.ts`) keep the literal but ship with
   `// = PALETTE_HEX.<token>` cross-reference comments.
7. **T035a i18n seam.** `src/i18n/en.ts` flat catalog with typed
   `I18nKey`; `src/i18n/index.ts` exports `t(key)` / `setLocale()` /
   `getActiveCatalog()`. All five scene stubs converted from inline
   English to `t("dev.<scene>Stub")` lookups. 3 new tests; total now
   10/10.
8. **HANDOVER big update.** Added a "Design ground rules" section
   (6 cross-cutting rules) and a "Future roadmap" section (5 explicit
   post-v0 directions with the seam-that-keeps-the-door-open noted for
   each). Added the test-first-under-CI-gate protocol and the
   PowerShell-apostrophes gotcha to "Conventions reminders."
9. **Constitution v1.1.1.** This commit. Formalises the two new
   mechanical bars in Principle III. Sync Impact Report updated;
   version footer bumped 1.1.0 → 1.1.1; ratification date unchanged
   (2026-05-14); last-amended date now 2026-05-18.

## Decisions

| Decision                                                                                  | Rationale                                                                                                                                                                                                                                | Reversible? |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `SaveService.save()` takes `Omit<SaveState, "lastPlayedAtIso">`, not full `SaveState`     | Compile-time clarity over runtime warnings; eliminates the "did the field I sent matter?" ambiguity                                                                                                                                      | Yes         |
| Palette as TS module, not JSON                                                            | Same answer as config: typecheck, tree-shaking, no extra build step. JSON would buy nothing.                                                                                                                                             | Yes         |
| `index.html` / `vite.config.ts` keep hex literals + cross-reference comment               | Full SSOT would need a build-script injection; over-engineering for the current scale. Convention + comment is the honest middle path.                                                                                                   | Yes         |
| i18n seam landed BEFORE first real HUD (T035), not after                                  | Wrapping new strings in `t()` from day one costs nothing; backfilling later is a repo-wide find-and-replace                                                                                                                              | Hard — would require rewriting any scene that already shipped text |
| Constitution amends as v1.1.1 (PATCH), not v1.2.0 (MINOR)                                 | The two new bullets are formalisations of existing seams, not new principles. No principle added, none removed, no rationale shifted. Patch is the right semver for "clarification of an existing principle."                            | Yes — could re-rationalise as MINOR later, harmless |
| "Non-blocking degradation" rule lives in HANDOVER for now, NOT in the constitution        | The rule is real but expressed informally ("don't crash, show a notice, don't retry"). When a second I/O failure case appears (asset load fail? network call?) and we see the same pattern emerge twice, that's the time to constitutionalise. | Yes — easy to promote later |
| Phaser 101 memo as a permanent doc, not a journal entry                                   | Reference material has a different lifecycle from chronology. Journal entries describe a moment; the Phaser memo describes the framework and will need editing as Phaser evolves.                                                        | Yes         |

## What worked

- **PR-review-driven fast-tracking.** Several items the maintainer raised
  (i18n, palette) were on my "could be done later" list. Surfacing them
  through review prompted "do it now while it's cheap" — much better
  outcome than discovering the need three tasks later.
- **Test-first under CI-gate protocol.** Worked exactly as planned for
  T019/T020: 7 RED tests committed locally (never pushed alone), then
  GREEN impl committed, both pushed together. CI only ever sees green;
  git history preserves test-first discipline.
- **`StorageLike` injection seam.** Validated by the i18n work — when
  I needed test-controllable mutability for `setLocale` + tests, the
  same dependency-injection pattern as SaveService was the obvious shape.
  Repeating the pattern means the next service author won't have to
  re-derive it.
- **Per-task commits with explicit "why" in the body.** Six commits today
  each tell their own story. A `git log` walk one year from now will
  reconstruct the reasoning without needing the chat history.

## What didn't

- **PowerShell + apostrophes in `git commit -m`.** Bit me twice in the
  same session despite the existing user-memory note. The fix
  (`git commit -F .commit-msg.tmp`) is cheap but the trap is invisible
  until the shell mis-parses the next chained command. Worth keeping
  as a HANDOVER convention reminder, which is where it now lives.
- **CRLF on freshly created files.** Same root cause as the last
  session; same fix (`npx prettier --write <path>` immediately after
  `create_file`). Now codified in repo memory.
- **vitest 4 mock typing.** `vi.fn()` returns a type TS doesn't
  consider callable. Typed form `vi.fn<(msg: string) => void>()` is
  required. Worth tracking — will recur in every new test file using
  mocks.
- **Defensive code coverage gaps.** SaveService coverage is 77.77%
  because the "no global localStorage available" throw and the
  "storage read throws unexpectedly" branches are unreachable from the
  injected `MemoryStorage` fake. Both are real safety nets; both are
  testable with a different storage fake; neither is worth a follow-up
  task in v0 (Principle X: investigate or document, not gate).

## What I'd do differently

- **Constitution amendment first, code second.** The order today was:
  T018a → T035a → amendment. Reasonable since the code was the
  prerequisite for the rule, but a stricter reading of "spec-first"
  would amend the constitution first to license the new rule, then
  bring code into compliance. For a patch-level clarification this is
  fine; for a MINOR amendment I'd flip the order next time.
- **Schedule the Phaser memo earlier in the project.** The memo would
  have helped the maintainer review even the first scene-stub PR.
  General rule: domain-onboarding docs are highest-value when they
  land *before* the first non-trivial domain code, not after. Worth
  generalising into Principle II somehow — "the spec-first rule
  implicitly covers the WHAT; consider whether a HOW memo is needed
  for the framework before code lands."

## Open questions / next session

- **Next coding session:** T021 + T022 (level loader, test-first pair).
  Same TDD shape as T019/T020. Estimated ~4–6 commits, naturally
  pushable as a unit.
- **Fast-tracking discussion** with maintainer: are there obvious
  batch opportunities in T023 → T030? T023–T026 are all `[P]` (parallel
  files); T027 is the Phase 2 integration point.
- **Constitution v1.2.0 candidates** (deferred):
  - Promote "non-blocking degradation" once a second I/O failure case
    appears.
  - Possibly: "domain-onboarding memo MUST land before first non-trivial
    code uses the framework" — formalisation of the lesson above.

## Refs

- PR #1 (https://github.com/jasaimial/carrot-code/pull/1)
- Commits this session: `850a844`, `848d181`, `2b9a458`, `ff15ea2`,
  `6087c50`, `e614673`, `ab1a0aa`, `c8c6182`, `71b13fd`, `0efc564`,
  `47217f1`, `9f6b709`, plus this commit (constitution + journal)
