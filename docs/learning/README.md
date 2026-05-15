# Learning Notes — carrot-code

This folder is the project's **learning journal and process playbook**.

`carrot-code` has two goals: build a 2D platformer, and practice [Spec Kit](https://github.com/github/spec-kit) / Spec-Driven Development on a real project. These docs capture the *process*, not the game itself, so the experience is reusable — by future-me, by another agent picking up the project mid-stream, and eventually by teammates I want to share Spec Kit with.

## Index

| Doc | Purpose | Audience |
|---|---|---|
| [00-setup-from-zero.md](./00-setup-from-zero.md) | Replicable install + first-time scaffold of Spec Kit on a fresh Windows machine | Anyone bootstrapping a new spec-kit project |
| [01-spec-kit-workflow.md](./01-spec-kit-workflow.md) | The canonical command flow, what each step produces, when to use the optional ones | Anyone using spec-kit day-to-day |
| [journal/](./journal/) | Chronological case-study entries — what we tried, what worked, what we'd do differently | Future-me; teammates seeing real usage |
| [templates/session-journal-template.md](./templates/session-journal-template.md) | Copy this when starting a new journal entry | Anyone adding a journal entry |
| [team-share/](./team-share/) | Polished, team-facing material derived from the journal (not yet populated) | Broader team |

## Conventions

- **Journal entries** are dated `YYYY-MM-DD-short-slug.md` and append-only. Don't rewrite history; if a decision changes, write a new entry that supersedes the old one and link back.
- **How-to docs** (the numbered files) are kept current and accurate. If a command in `00-setup-from-zero.md` no longer works, fix the doc and add a journal entry explaining why.
- **No game-design content here.** Game design lives in spec-kit specs under `specs/<feature>/spec.md`. This folder is strictly about the *meta* — how we work.
- **Original IP only.** Same rule as the rest of the repo.

## Why the journal matters

The Spec Kit docs explain *what* the tool does. They can't tell you what it feels like the first time you realize your spec is too vague, or which optional commands actually pay for themselves. That's the gap this journal fills, and it's the part most useful to a teammate deciding whether to adopt SDD.
