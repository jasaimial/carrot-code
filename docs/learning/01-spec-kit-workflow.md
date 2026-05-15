# 01 — The Spec Kit Workflow

The end-to-end command flow, what each step produces on disk, and when the optional commands actually earn their keep.

## The canonical flow

```
/speckit.constitution
        ↓
/speckit.specify  ──→  (optional) /speckit.clarify
        ↓
/speckit.plan     ──→  (optional) /speckit.checklist
        ↓
/speckit.tasks    ──→  (optional) /speckit.analyze
        ↓
/speckit.implement
```

Each command is a slash-prompt registered in `.github/prompts/speckit.*.prompt.md`. You invoke them from VS Code Copilot Chat by typing `/` and picking from the autocomplete.

## What each command does

### `/speckit.constitution` — once per project

**Input:** your principles, in plain prose.
**Output:** `.specify/memory/constitution.md`. Read by every subsequent command.

This is *not* a tech-stack decision. It's the rules: code-quality bars, what's in/out of scope, IP constraints, testing posture, what "done" means. Write it once, refer to it forever.

> **Lesson:** be specific and opinionated. "Quality matters" is useless. "TypeScript strict mode, no magic numbers in gameplay code, every level loaded from JSON" is enforceable.

### `/speckit.specify` — once per feature

**Input:** a description of *what* you want to build, focused on user value (not code).
**Output:** a new git branch like `001-vertical-slice` and `specs/001-vertical-slice/spec.md`.

The agent will create the branch automatically (via the bundled `git` extension) and write the spec. The spec is in user-story / acceptance-criteria form.

> **Lesson:** the spec is about *what* and *why*. Resist the urge to mention frameworks here — that comes in `plan`.

### `/speckit.clarify` — optional, before `plan`

Asks you up to 5 targeted questions to remove ambiguity from the spec. **Use it whenever your spec contains words like "should," "ideally," or "etc."** Cheap insurance against a plan built on assumptions.

### `/speckit.plan` — once per feature

**Input:** the spec (auto-loaded) + your tech-stack choices.
**Output:** `specs/<feature>/plan.md` plus design artifacts (data model, contracts, etc.) in the same folder.

This is where you commit to languages, frameworks, libraries, and architecture patterns. Constitution principles are enforced here.

### `/speckit.checklist` — optional, after `plan`

Generates a quality checklist tailored to your spec — things like "are all error paths defined," "is the data model complete." Useful for teaching yourself what a good spec looks like.

### `/speckit.tasks` — once per feature

**Input:** spec + plan.
**Output:** `specs/<feature>/tasks.md` — an ordered, dependency-aware list of concrete implementation tasks.

This is the artifact `/speckit.implement` will execute against.

### `/speckit.analyze` — optional, before `implement`

Cross-checks spec, plan, and tasks for inconsistencies and gaps. **Worth running before any non-trivial implementation** — much cheaper to fix a contradiction here than mid-coding.

### `/speckit.implement` — incremental

Executes tasks. You can let it run all the way, or cherry-pick specific task IDs. Either way, **review every diff** — this is collaboration, not delegation.

## File layout after a few features

```
.specify/
  memory/
    constitution.md          ← your project rules
  templates/                 ← templates for spec/plan/tasks
  scripts/                   ← helpers spec-kit invokes
  extensions/git/            ← bundled git extension (creates feature branches)
specs/
  001-vertical-slice/
    spec.md
    plan.md
    tasks.md
    data-model.md            (if generated)
    contracts/               (if generated)
  002-second-feature/
    ...
```

## Branching model

- `main` — always-deployable.
- `001-vertical-slice`, `002-…` — one branch per spec, auto-created by `/speckit.specify`.
- Merge back to `main` when the slice is shipped (PR, review, CI green). Then start the next spec from `main`.

## When NOT to use spec-kit

- **Throwaway spikes** — if you're going to delete the code in an hour, just write it.
- **Pure refactors with no behavior change** — sometimes a code change is just a code change.
- **Bug fixes obvious enough to fit in one commit message** — a 3-line null check doesn't need a constitution.

For everything else, the per-feature overhead (~30 minutes of writing a spec) saves multiples of that in re-work.

## See also

- Official docs: https://github.github.io/spec-kit/
- Methodology essay: [`spec-driven.md`](https://github.com/github/spec-kit/blob/main/spec-driven.md)
- This project's setup how-to: [00-setup-from-zero.md](./00-setup-from-zero.md)
