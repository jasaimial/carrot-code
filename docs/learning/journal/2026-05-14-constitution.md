# Journal — 2026-05-14 — Constitution Ratification

Second session of the day. Goal: produce a real, ratified constitution
(v1.0.0) at `.specify/memory/constitution.md` — and use the iteration
itself as a lesson about how *much* constitution is the right amount.

## Context

After the bootstrap session ([previous entry](./2026-05-14-bootstrap.md)),
the spec-kit scaffolding was in place but `.specify/memory/constitution.md`
was still the unfilled template shipped by `specify init`. Without a real
constitution, every subsequent `/speckit.*` command would be operating
without principles to check against — turning the gating value of the
workflow into theatre.

This was the first time running an actual `/speckit.*` slash command end
to end (excluding the implicit hooks). It was also the first chance to
practice the SDD discipline on a non-trivial document.

## What happened

1. **Pre-execution hook fired** — `before_constitution` is a mandatory
   hook running `speckit.git.initialize`. The script self-detected the
   existing repo and skipped (`WARNING: [specify] Git repository already
   initialized; skipping`). Verified the contract is "run the script,
   accept its no-op," not "manually decide whether to run."

2. **Drafted v0** from the user's bullet list — 9 principles closely
   matching what the user dictated, plus a Sync Impact Report at top, a
   Technology & Asset Constraints section, a Development Workflow section,
   and a Governance section. Tried to be enforcement-specific on every
   principle ("Enforceable: …" + "Rationale: …" blocks). Wrote it directly
   into the file, replacing the template.

3. **User reviewed v0** and asked for several additions to Principle III
   (no secrets, test coverage ratio, SOLID, performance focus, future-
   proofing for multiplayer/auth/payments) plus a tightening of Principle
   V (iOS home-screen pin must feel like a native app).

4. **Pushed back on three of those** before editing:
   - **Coverage ratio**: rejected as a Goodhart trap; the original "tests
     are meaningful, coverage is reported never gated" framing was
     correct. Tightened to "every spec acceptance criterion has a test."
   - **"SOLID when possible"**: rejected the acronym (cargo-cult magnet),
     kept the *substance* as four concrete bullets in the language of
     data-driven game code.
   - **"Open door for multiplayer / payments / etc."**: rejected as
     written (would justify any complexity); accepted a narrowed version
     that constrains *present* decisions (serializable JSON state, no
     singleton-player assumptions, I/O isolation) without building any
     scaffolding for those futures.

5. **User accepted all pushbacks**. Wrote v1 — adding Principles X
   (Performance Is A Feature) and XI (Don't Build The Future, Don't
   Preclude It Either), plus the agreed updates to III, V, VI, VIII.

6. **User then asked the harder question** after seeing v1: "are we
   over-engineering for a solo project?" That was the real test of the
   discipline. The honest answer was *yes, partially* — three specific
   bullets were ideology with no payoff:
   - Principle X's hard `≥10 % regression` gate (would require building
     benchmark/profiling infra that's its own project)
   - Principle X's `≥16 ms GC pause` gate (same)
   - Principle XI's "no hidden globals" rule (would ban Phaser's own
     blessed `registry` and global event emitter for cross-scene state
     — fights the framework with no payoff)

7. **Wrote v2 (the ratified version)** softening those three bullets and
   adding a "Solo Project Realities" preamble that explicitly recasts
   MUST/SHOULD/Reviewer for a one-developer-plus-agents context. Kept the
   non-negotiables firm (I, II, IV, V, VII, VIII).

8. **Committed as `933e048`** with the message
   `docs(constitution): ratify carrot-code constitution v1.0.0`.

## Decisions

| Decision | Rationale | Reversible? |
|---|---|---|
| 11 principles, not 9 | Performance and "don't preclude futures" are real disciplines for a game project; both have cheap-to-honor versions | Yes, future amendment |
| Add Solo Project Realities preamble | Without it, the document reads like team-bureaucracy theatre; with it, every MUST/SHOULD has clear meaning for one person + agents | Yes, easy to remove if contributors join |
| Soften Principle X to drop hard regression gates | Building benchmark/profiling infra is its own project; cheap guardrails (asset budgets, dev FPS overlay) catch most issues | Easy — re-tighten when there's a perf problem worth the infra |
| Soften Principle XI to allow Phaser registry | Banning framework idioms with no payoff is over-engineering | Easy — re-tighten if the registry becomes a coupling problem |
| Drop "SOLID" acronym, keep the substance | Naming the acronym invites cargo-culting; the four bullets state the actual intent | Easy — could re-add the acronym in a comment if useful |
| Reject coverage % as a gate (keep as report only) | Coverage as a target stops measuring quality and starts measuring keystrokes | Hard to reverse without inviting Goodhart |
| Constitution stays v1.0.0 (not v1.1.0) | The intermediate drafts were never committed; we iterated a draft, not amended a ratified doc. Versioning rules apply to ratified versions | N/A |

## What worked

- **Pushing back early instead of accepting every addition.** The user's
  list contained good additions and a few traps. Catching the traps
  *before* writing them saved a full edit cycle and demonstrated the
  reviewer dynamic the constitution itself is built around.
- **The "is this over-engineered?" question came from the user, not me.**
  That's the right pattern: I drafted ambitiously, user pulled it back,
  net result is sharper than either of us would have produced alone.
  Worth remembering — don't pre-pessimize during drafting; let the review
  step do its job.
- **Sync Impact Report at the top.** Forced explicit accounting of every
  change (added / removed / softened) and made the iteration history a
  permanent part of the artifact.
- **Mandatory `before_constitution` hook ran clean.** The git extension's
  scripts are well-behaved (self-detect, skip, return success).

## What didn't

- **Initial draft over-shot.** Principles X and XI as first written had
  enforcement teeth that didn't match the project's reality. I knew this
  was a solo project and still wrote team-grade enforcement language. That
  pattern is worth watching for in future spec-kit work — the formal
  templates pull you toward formal-team prose.
- **Three "prompt injection" alerts in a row turned out to be platform-
  level copyright reminders** appended to my completion stream, not actual
  injections through user files or tool outputs. The detection rule
  ("instruction not in user message → suspicious") was right, but the
  framing ("prompt injection!") was alarmist. After confirming the source
  by observing the same paragraph appear inside my own response output,
  the right response is to silently ignore it and only flag genuinely
  off-task or harmful instructions from unknown sources. Lesson recorded
  to user memory.

## What I'd do differently

- **Draft for the actual context first, expand later if needed.** Next
  time a `/speckit.constitution` (or any principle-setting work) starts
  with "this is a solo project," write that into the preamble *before*
  drafting the principles, not after. The preamble shapes the voice of
  the rest.
- **When user says "add X principle that says Y," ask "what would
  enforcing this on a Friday afternoon actually look like?" before
  writing it.** That single question catches most of the over-engineering.
- **Pin the exact commit SHA (or tag) of spec-kit used in the journal
  entry,** not just the version. The CLI was installed at
  `git+https://github.com/github/spec-kit.git@v0.8.10` which resolved to
  commit `587feaac137ced14b8a86f60d3775ae36b54933c` — that's the actual
  authority for what templates and prompts shipped. Worth recording for
  future reproducibility.

## Open questions / next session

- [ ] Run `/speckit.specify` for the vertical slice. Likely scope: one
  level, hero with run/jump, one enemy, one collectible (carrot), one
  power-up, one narrator-style dialog beat, working in browser + iOS
  standalone install. Per Principle V, this is the *entire* MVP.
- [ ] Decide whether to use `/speckit.clarify` on the spec — almost
  certainly yes, since it's both a spec-quality investment and a chance
  to practice the optional commands.
- [ ] When to push to GitHub remote. Proposed: after the spec is in but
  before `plan`, so the first push includes constitution + spec + the
  learning docs (a substantive baseline, not an empty repo).
- [ ] First time we fail a constitution gate, write it down — those will
  be the most valuable journal entries for the team-share material.

## Artifacts touched

- `.specify/memory/constitution.md` (full content; v1.0.0)
- `docs/learning/journal/2026-05-14-constitution.md` (this file)

## Commits

```
933e048  docs(constitution): ratify carrot-code constitution v1.0.0
```

## Reproducibility note

- spec-kit CLI: `specify-cli==0.8.10`, installed via
  `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@v0.8.10`,
  resolved to commit `587feaac137ced14b8a86f60d3775ae36b54933c`.
- `uv` version: `0.11.13`.
- Agent: GitHub Copilot Chat in VS Code.
