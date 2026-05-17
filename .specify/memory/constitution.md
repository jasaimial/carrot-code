<!--
SYNC IMPACT REPORT (cumulative)
================================

## v1.1.0 (2026-05-17) — Amendment

Version change: 1.0.0 → 1.1.0 (MINOR — one new principle added)
Trigger: repository went public on GitHub earlier the same day; existing
rules did not adequately cover tone or PII in public-facing artifacts.

Modified principles:
  - II  Spec-First, Always: generalised the "prior charter is inspiration,
        not spec" rule; removed the specific reference to docs/starter.txt
        since that file is retired in this same amendment.

Added principles:
  - XII Public-Repo Hygiene

Removed artifacts:
  - docs/starter.txt — copyrighted-IP references ("Super Rabbit Run",
    "Press Start") and raw drafting tone are incompatible with the new
    Principle XII and were already strained against Principle I. The file
    is preserved in git history at commit 86d0e21 for anyone curious about
    the project's origin moment.

Templates re-checked for v1.1.0:
  ✅ All templates and prompts listed in the v1.0.0 report below — no new
     per-principle conflicts introduced.
  ✅ docs/learning/* — no PII or tone issues found in grep audit.

Follow-up TODOs:
  (none deferred)

---

## v1.0.0 (2026-05-14) — Initial Ratification
Version change: TEMPLATE → 1.0.0 (initial ratification)
Bump rationale: First real constitution. The previous file was the unfilled
template shipped by `specify init`; this is a MAJOR baseline establishment.

Modified principles:
  (none — first ratification)

Added principles:
  I.    Original IP Only
  II.   Spec-First, Always
  III.  Production-Quality Code From v0
  IV.   Data-Driven & Extensible
  V.    Vertical Slice Before Breadth
  VI.   Tested Where It Matters
  VII.  Free / Open Assets Only
  VIII. Ships From Day One
  IX.   Readable Over Clever
  X.    Performance Is A Feature
  XI.   Don't Build The Future, Don't Preclude It Either

Added sections:
  - Technology & Asset Constraints  (Section 2)
  - Development Workflow & Quality Gates  (Section 3)
  - Governance  (Section 4)

Removed sections:
  (none)

Draft iteration notes (pre-commit):
  - Added "Solo Project Realities" preamble framing the doc as a working
    contract for one human + agents, not a team-bureaucracy artifact.
  - III: no-secrets rule kept as MUST; four design-discipline bullets
    softened from review-blockers to SHOULD-style guidance (the substance
    of "SOLID" without the acronym, without the courtroom).
  - V gained: explicit iOS "Add to Home Screen" standalone-mode definition
    of "shipped" (must be indistinguishable from a native-installed app).
  - VI tightened: tests MUST cover every spec acceptance criterion;
    coverage % is reported, never gated (rejected a numeric coverage floor
    as a Goodhart trap for a learning project).
  - VIII clarified: branch protection is configured on first push to
    GitHub; until then the rule is enforced by self-discipline.
  - X added then softened: 60 FPS target on named baseline hardware kept;
    asset-payload budgets per level kept (cheap, high-value); dev FPS
    overlay kept; the hard "≥10 % regression PR-block" and "16ms GC pause
    PR-block" downgraded to "investigate and either fix or document" —
    building benchmark/profiling infra is its own project we don't need
    until something feels wrong.
  - XI added then softened: serializable JSON state, no singleton-player
    assumptions, runtime-mode-as-flag, I/O in `services/` all kept. The
    "no hidden globals" bullet was DROPPED — banning Phaser's `registry`
    and global event emitter fights the framework with no payoff for a
    solo project. Use them where they make sense; isolate I/O where
    that makes sense.
  - Constitution still v1.0.0: this file was never committed, so we are
    iterating the draft, not amending a ratified document.

Templates checked:
  ✅ .specify/templates/plan-template.md     — Constitution Check section is
       gate-driven from this file at runtime; no per-principle edits required.
  ✅ .specify/templates/spec-template.md     — Generic user-story format aligns
       with Principles II, V, VI; no edits required.
  ✅ .specify/templates/tasks-template.md    — Phase ordering supports
       Principles II, III, V, VIII; no edits required.
  ✅ .specify/templates/checklist-template.md — Generic; usable as-is.
  ✅ .github/prompts/speckit.*.prompt.md     — Tool prompts are agent-neutral;
       no edits required.
  ✅ .github/copilot-instructions.md         — No principle conflict.
  ✅ docs/learning/01-spec-kit-workflow.md   — Workflow doc already aligned.

Follow-up TODOs:
  (none deferred)
-->

# carrot-code Constitution

`carrot-code` is a 2D pixel-art platformer built as a learning project. Its
two goals — shipping a real game and practicing Spec-Driven Development — are
equal in weight. This constitution exists to keep both honest.

## Solo Project Realities

This is a one-developer project working with AI agents. There is no team to
reject your PR, no on-call rotation, no compliance officer. That changes
how this document should be read:

- **"MUST"** means a rule that's either automated (CI fails the build) or
  important enough that breaking it costs more than the discipline of
  following it. These are the lines that don't bend.
- **"SHOULD"** means a default to follow until you have a concrete reason
  not to. Bend deliberately and write the reason in the journal entry for
  that session; bend lazily and you've broken the constitution.
- **"Reviewer" / "Review"** means *you, looking at your own PR with at
  least a few hours' distance, or an agent doing a structured review pass.*
  When contributors join, the same rules apply unchanged — the words just
  start meaning what they normally mean.
- **Perfect is the enemy of shipped.** If a rule is blocking real progress
  and you can't articulate why it matters *for this project right now*,
  amend it instead of tiptoeing around it. The amendment process exists
  for exactly this.

This document errs on the side of fewer, sharper rules over comprehensive
coverage. Anything that isn't here is left to good taste.

## Core Principles

### I. Original IP Only

All character names, settings, story beats, music, and visual assets MUST be
original or licensed for unrestricted public use (CC0, public domain, or a
permissive license that survives commercial redistribution). The aesthetic
inspiration (8-bit fictional-handheld styling and a meta-narrator framing) is
permitted; specific copyrighted properties — including but not limited to the
*Press Start!* book series and any of its characters — are not.

**Enforceable:** any new asset, identifier, or narrative element is rejected
in review if a reasonable observer could confuse it with copyrighted IP.
**Rationale:** the repository is public and the PWA will be deployed publicly;
ambiguous IP exposes the project (and its author) to takedown and worse.

### II. Spec-First, Always

No production code is written without a corresponding spec → plan → tasks
artifact set under `specs/<NNN-feature>/`. Any prior brainstorming, charter
notes, or third-party reference material is *inspiration only* — never
authority for implementation decisions, and never committed to this repo
unless it independently passes Principles I and XII.

**Enforceable:** PRs that introduce gameplay or infrastructure code without a
linked `specs/<NNN>/` directory are rejected. Throwaway spikes are allowed
only on branches prefixed `spike/` and MUST NOT be merged to `main`.
**Rationale:** practising SDD discipline is a stated learning goal; bypassing
it defeats half the project's purpose.

### III. Production-Quality Code From v0

Every commit on `main` MUST satisfy these mechanical bars:

- TypeScript `strict: true` with no `any` outside narrowly scoped, commented
  boundary code.
- ESLint clean (zero warnings under the project's chosen ruleset).
- Prettier formatted (CI verifies).
- No magic numbers in gameplay logic — physics, timing, animation, and tuning
  constants live in typed config modules under `src/config/` and are
  imported, not inlined.
- **No secrets, credentials, API keys, tokens, or personally identifying
  data** in the repository, in build outputs, or in commit history.
  Environment files (`.env`, `.env.*`) are gitignored; example files
  (`.env.example`) contain only placeholder values and are reviewed for
  accidental leakage. A leaked secret is a stop-the-line incident: rotate
  first, then rewrite history.

And these design-discipline defaults SHOULD hold (the substance of
"SOLID," stated in the language that actually applies to data-driven game
code):

- Each module SHOULD have a single clear purpose statable in one sentence.
  When the purpose needs a paragraph, consider splitting the module.
- Modules SHOULD depend on typed interfaces and data shapes, not on
  concrete implementations. Inject dependencies at composition boundaries
  rather than reaching for them inside scenes or factories.
- Prefer composition over inheritance. Class hierarchies deeper than one
  level deserve a comment explaining why.
- Modules SHOULD respect architectural layers: scenes go through services
  for save/load, asset fetching, and analytics; services don't reach into
  DOM or Phaser scene internals.

**Enforceable:** CI fails the PR on the mechanical bars. The design-
discipline defaults are enforced by self-review and agent-assisted review,
not by automation — bend any of them deliberately and note the reason in
the session journal.
**Rationale:** the user explicitly rejected throwaway learning code.
Quality habits formed early cost nothing; quality habits retrofitted later
cost a lot. The acronym "SOLID" is deliberately avoided to discourage
cargo-culting interfaces and abstractions that don't earn their keep.

### IV. Data-Driven & Extensible

The game engine code MUST treat content as data:

- Levels are authored in [Tiled](https://www.mapeditor.org/) and exported as
  JSON. A single generic `LevelScene` consumes them. Adding a new level is a
  one-file JSON drop plus a one-line entry in the level registry — zero
  scene-code changes.
- Entities (hero, enemies, pickups, hazards) are defined as typed
  configuration objects (e.g., `EnemyConfig`, `PickupConfig`) consumed by
  generic factories. Bespoke per-entity classes are forbidden unless an
  entity has genuinely unique behaviour that cannot be expressed as data.
- Audio cues, dialog text, and tuning values follow the same rule: data
  files in `src/data/`, loaded at runtime, never hard-coded in scene code.

**Enforceable:** a code review question on every PR is "could this be data
instead of code?" If yes, it must be.
**Rationale:** extensibility is the user's explicit success criterion;
data-driven design is the only structural way to deliver it.

### V. Vertical Slice Before Breadth

Exactly one level is shipped end-to-end — gameplay, audio, UI polish, save
state, PWA install prompt, offline asset cache, deployment — before any work
begins on a second level or unrelated feature. Desktop and mobile are
first-class equals; neither is a "phase 2" of the other.

"Shipped" specifically requires:

- Deployed to a public HTTPS URL, free of known correctness bugs.
- **Desktop (Chromium / Edge / Firefox):** native PWA install prompt
  produces a standalone app window with a custom icon.
- **Android Chrome:** the same, with a home-screen icon and offline play.
- **iOS Safari:** "Add to Home Screen" produces a launcher that opens in
  **standalone mode (no browser chrome)**, with a custom icon and splash
  screen, retains state across launches, and remains fully playable
  offline. To a casual user, it MUST be indistinguishable from a
  native-installed app — no Safari address bar leaking through, no
  unexpected white bars, no "reload to play" on revisit.

If the iOS standalone experience breaks on the target hardware (see
Principle X), it is a release-blocker, not a known issue.

**Enforceable:** specs proposing scope beyond the current slice are rejected
or split. The `specs/` directory MUST contain at most one in-progress
non-slice feature at any time. The slice's playtest checklist MUST include
iOS standalone-launch verification.
**Rationale:** breadth-first projects don't ship; depth-first ones teach the
full pipeline. Both project goals require shipping. We are not building a
native app any time soon, so the bookmark-on-iOS path *is* the iOS app — it
has to feel like one.

### VI. Tested Where It Matters

Vitest unit tests are MANDATORY for pure logic: level loaders, save-state
serialization, math helpers, configuration parsers, registry lookups. Pure-
logic modules MUST have tests covering **every acceptance criterion named
in the relevant spec** — no acceptance criterion ships untested.

Coverage percentage is reported in CI for visibility but is **not** a gate.
A numeric floor is deliberately rejected: the moment coverage becomes a
target it stops being a measure, and devs write `expect(x).toBeDefined()`
to hit it.

Gameplay-feel changes (jump arc, enemy timings, camera behaviour) MUST be
accompanied by an updated manual playtest checklist in the relevant spec,
executed and signed off before merge.

**Enforceable:** PR template requires test additions for any new pure-logic
module, asserts every spec acceptance criterion has a corresponding test,
and requires a playtest-checklist update for any tuning change.
**Rationale:** mechanical tests for mechanical code; human tests for human
feel. Cargo-culting either is waste. Coverage as a target is the textbook
Goodhart's-law trap for a learning project.

### VII. Free / Open Assets Only

All assets committed to the repository MUST be CC0, public domain, or under
a license compatible with both private and commercial reuse without
attribution requirements that would burden the codebase. The v0 baseline is
[Kenney.nl](https://kenney.nl) CC0 placeholders. Custom or AI-assisted art
is a parallel track that swaps placeholders by **changing data references
only** — never code.

**Enforceable:** every asset under `assets/` ships with a `LICENSE.md` (or
entry in `assets/CREDITS.md`) naming source and license. Unsourced assets
fail review.
**Rationale:** licensing problems found late are expensive; design now for a
clean asset pipeline and the project stays publishable forever.

### VIII. Ships From Day One

GitHub Actions CI MUST run on every PR and on every push to `main`,
executing — at minimum — typecheck, lint, unit tests, and production build.
The `main` branch MUST be deployable as an installable PWA at all times;
deployment to the chosen host (Netlify or GitHub Pages) is automated from
`main`.

**Enforceable:**
- Branch protection on `main` MUST be configured on the first push to
  GitHub to require CI green and at least one PR review (self-review
  acceptable for solo work, but the PR flow itself is non-negotiable).
  Until that first push, the workflow is enforced by self-discipline and
  this principle is the receipt.
- A failing deploy or a broken `main` is a stop-the-line incident: the
  next commit must fix it before any other work proceeds.

**Rationale:** continuous deployability turns "shipping" from a milestone
into a baseline. It also catches integration breakage in hours, not weeks.
Being honest about what's enforced *now* vs. *on first push* keeps the
document trustworthy.

### IX. Readable Over Clever

Code on `main` SHOULD be obvious to a developer reading it for the first
time. When obvious and clever conflict, choose obvious and add a brief
comment naming the chosen tradeoff. Comments explain *why*, not *what*.
Public functions, exported types, and non-trivial config keys carry a
one-line JSDoc explaining intent.

**Enforceable:** review comments may request rewrites for clarity even when
the code is correct. "It works" is not a sufficient defence.
**Rationale:** the project's primary reader is a learner. Code that teaches
is worth more than code that impresses.

### X. Performance Is A Feature

Interactive games live and die on frame pacing. The game targets sustained
**60 FPS during normal gameplay** on the baseline hardware:

- **Desktop:** latest stable Chromium on a 2020-era mid-range laptop
  (integrated graphics, 8 GB RAM, no discrete GPU assumed).
- **Android:** latest stable Chrome on a 2022-era mid-range Android phone.
- **iOS:** Safari on a current-generation iPhone (last two model years).

**Enforceable:**
- Each level spec MUST declare an asset-payload budget (total bytes for
  sprites, audio, JSON). Exceeding the budget blocks merge unless the
  spec is amended with explicit justification. (Cheap to honor, surfaces
  scope creep early.)
- The dev build MUST expose an FPS / frame-time overlay toggleable at
  runtime so regressions are visible during normal development.
- Visible frame-rate regressions, stuttering, or GC pauses on the baseline
  hardware MUST be either fixed before merge or explicitly accepted in the
  PR description ("known issue, tracked in spec X, deferred because Y").
  Investing in benchmark scenes and automated frame-time comparison is
  deferred until the project actually has performance problems worth that
  infrastructure.

**Rationale:** every other principle is moot if the game stutters. Cheap
guardrails (asset budgets, dev overlay) catch most problems early; heavy
performance infra (synthetic benchmarks, regression-percentage gates) is
over-engineering for a solo 2D pixel-art project until proven necessary.

### XI. Don't Build The Future, Don't Preclude It Either

No infrastructure for multiplayer, user accounts, user tiers, payments,
back-end services, or analytics is built until a spec demands it. **YAGNI
wins.** Building speculative scaffolding for futures that may never arrive
is a Principle II and Principle V violation in disguise.

**However**, decisions on the critical path MUST NOT actively preclude
those futures with cheap discipline applied today:

- **Game state is serializable JSON.** No opaque object references, no
  class instances or closures in save data, no `Map`/`Set` instances
  outside transient runtime caches. If it can't `JSON.stringify` and round-
  trip cleanly, it doesn't belong in state.
- **No singleton-player assumptions in core types.** `Player` is an
  instance, not a global; the world owns a *collection* of players even
  when the collection has length 1.
- **Runtime mode is a flag, not a baked-in truth.** `mode: "single-player-
  local"` is the only value today; the type allows other values without
  rewrites.
- **I/O lives in `services/`, not in scenes.** Save/load, asset fetching,
  and (eventually) network/auth/storage code live behind typed service
  interfaces. Scenes call services; services do the I/O. Phaser's own
  cross-scene mechanisms (the `registry` and global event emitter) are
  fine for in-engine state coordination — this rule is about *external*
  I/O, not about banning the framework's idioms.

**Enforceable:** PRs that hard-code "there is exactly one player," that
put non-serializable values in save state, or that call `fetch` / storage
APIs directly from scenes are rejected. PRs that introduce scaffolding,
plugin systems, or interfaces for hypothetical futures **with no current
spec** are also rejected — this principle constrains present decisions; it
is not a permission slip for premature abstraction.
**Rationale:** the cheap discipline (serializable state, isolated external
I/O) costs nothing today and avoids ground-up rewrites later. The
expensive discipline (build a payment plugin system "just in case," wrap
every Phaser idiom in dependency injection) costs everything today and
saves nothing. Notice what is *not* in the accommodation list: payments,
plugin frameworks, microservices, dependency-injection containers. Those
are far enough away that the basic disciplines above will handle them
when they arrive — naming them now would be exactly the trap this
principle exists to prevent.

### XII. Public-Repo Hygiene

This repository is public on GitHub. Every committed artifact — source
code, code comments, markdown content, commit messages, PR descriptions,
journal entries, spec text — must hold up to a stranger reading it cold.

**Tone**: respectful, professional, plain English. No profanity, slurs,
or gratuitous edge in committed text. Casual language in conversation
with agents is welcome; what gets committed is different. The test:
"would I be comfortable if a hiring manager, a teammate, or a twelve-
year-old read this?"

**Personal info / PII / sensitive data**: never in committed files.
This includes, but is not limited to:

- Real names beyond the public maintainer's GitHub handle.
- Email addresses, phone numbers, physical addresses.
- Internal corporate identifiers, project codenames, or employer-
  confidential information of any kind.
- Credentials of any kind — even "redacted," even expired, even fake-
  looking-but-real.
- Screenshots that leak browser tabs, usernames, system paths, or
  identity beyond what's needed to make the documented point.
- Verbatim chat transcripts that contain any of the above (paraphrase
  or redact instead).

**Practical defaults**:

- Refer to the maintainer as "the user," "the maintainer," or by the
  public GitHub handle (`jasaimial`) — never by real name.
- When pasting terminal output or screenshots into a markdown file,
  scan for usernames, hostnames, and email addresses first; redact
  if present.
- If a leak slips through to a commit: rotate any exposed credential
  *first*, rewrite the offending history (`git filter-repo` or
  equivalent) *second*, and journal the incident *third*.

**Enforceable**: Self-review and agent-review per the Solo Project
Realities preamble. When an agent drafts artifacts for this repo, it
MUST honour this principle for every file it produces. Anything that
fails review on tone or PII grounds is a stop-the-line incident — fix
before merge.

**Rationale**: A public repo is a permanent broadcast. A learning
project is also a portfolio piece. Both audiences demand the same
hygiene. Most accidental leaks to public repos happen because nobody
had a rule forbidding the thing; now we have one.

## Technology & Asset Constraints

The following choices are locked for the duration of v1.x of this
constitution. Changing them is an amendment under Governance.

- **Engine:** Phaser 3 (≥ 3.80, MIT licensed). Phaser 4 may be considered
  once stable.
- **Language:** TypeScript with `strict: true`. No JavaScript source files.
- **Build:** Vite. PWA via the official Vite PWA plugin or equivalent.
- **Testing:** Vitest for unit tests. No additional framework added without
  a documented reason.
- **Level authoring:** Tiled, exporting JSON only.
- **CI:** GitHub Actions.
- **Hosting:** Netlify or GitHub Pages, with a public deployable URL.
- **Browser baseline:** evergreen Chromium, Firefox, and Safari (latest two
  major versions each). PWA install supported on at least one mobile
  browser.
- **Assets license baseline:** CC0 / public domain, sourced from Kenney.nl
  for the v0 placeholder set.

Spec-kit tooling itself is pinned per the active version recorded in
[`docs/learning/00-setup-from-zero.md`](../../docs/learning/00-setup-from-zero.md).

## Development Workflow & Quality Gates

1. **Branching.** `main` is always deployable. Each spec gets a feature
   branch named `<NNN>-<slug>` (auto-created by `/speckit.specify`). Spikes
   live on `spike/<slug>` branches and are never merged to `main`.

2. **Spec-Kit flow.** The canonical order — `/speckit.constitution` →
   `/speckit.specify` → optional `/speckit.clarify` → `/speckit.plan` →
   optional `/speckit.checklist` → `/speckit.tasks` → optional
   `/speckit.analyze` → `/speckit.implement` — MUST be followed for every
   feature. Skipping a step requires explicit justification in the PR
   description.

3. **Pull requests.** Every change reaches `main` via PR. The PR description
   MUST link to the relevant `specs/<NNN>/` directory (Principle II). The
   PR template enforces a checklist covering Principles III, VI, VII, and
   VIII.

4. **CI gates.** A PR may be merged only when typecheck, ESLint, Vitest, and
   `vite build` all pass. Coverage is reported but not gated.

5. **Manual playtest gate.** PRs touching gameplay-feel code MUST attach the
   completed playtest checklist from the relevant spec.

6. **Learning journal.** Notable spec-kit sessions (any session that
   completes a `/speckit.*` command or produces a substantive lesson) MUST
   be logged under
   [`docs/learning/journal/`](../../docs/learning/journal/) using the
   provided template, in the same PR as the work it describes.

## Governance

This constitution supersedes any prior project documents wherever they
conflict.

- **Authority.** The constitution is the project's highest internal
  authority on process and quality. Other documents (specs, plans, tasks,
  README) MUST NOT contradict it; if they do, the constitution wins until
  amended.

- **Amendment procedure.** Amendments are made via PR that:
  1. Updates this file.
  2. Updates the Sync Impact Report comment at the top.
  3. Updates dependent templates and docs flagged by the Sync Impact
     Report.
  4. Adds a journal entry under `docs/learning/journal/` describing the
     change and its motivation.

- **Versioning policy.** Semantic versioning of the constitution itself:
  - **MAJOR**: a principle is removed or its meaning materially redefined,
    or a governance rule changes in a backward-incompatible way.
  - **MINOR**: a new principle or section is added, or existing guidance
    is materially expanded.
  - **PATCH**: clarifications, wording fixes, or non-semantic edits.

- **Compliance review.** Every PR review MUST verify alignment with the
  constitution. A reviewer may block a PR solely on constitutional grounds
  and SHOULD cite the specific principle.

- **Runtime guidance.** Day-to-day process knowledge — setup, workflow
  details, troubleshooting — lives in
  [`docs/learning/`](../../docs/learning/). When that guidance and this
  constitution disagree, the constitution wins and the guidance is updated
  in the same PR.

**Version**: 1.1.0 | **Ratified**: 2026-05-14 | **Last Amended**: 2026-05-17
