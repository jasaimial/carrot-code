# Journal — 2026-05-17 — Constitution v1.1.0 + GitHub Public

Returning to the project after 3 days off. Short session, but with two
governance-level changes that deserve their own entry: the repo went
public and the constitution got its first real amendment.

## Context

Last commit on `main` was the constitution-ratification journal from
2026-05-14. Branch `001-vertical-slice` was 5 commits ahead with the
full spec + plan + tasks + analyze fixes ready, but no code yet and no
GitHub remote. Today's plan was to push to GitHub, lock down branch
protection, and start Phase 1 implementation tasks.

## What happened

1. **GitHub push (initially private).** Created
   `jasaimial/carrot-code` via `gh repo create --private`, pushed both
   `main` and `001-vertical-slice`. So far so good.

2. **Branch protection hit a paywall.** Tried to configure baseline
   branch protection on `main` (PR required, linear history, no
   force-push, conversation resolution required). The API returned
   `403 Upgrade to GitHub Pro or make this repository public to enable
   this feature.` Branch protection on private repos is a paid
   feature on GitHub's free tier.

3. **Flipped to public.** Three options presented (go public; stay
   private + defer Principle VIII; pay for GitHub Pro). Public was the
   right call: the constitution already promised public-repo-safe
   content, and the team-share angle of the project requires it
   eventually. Cheapest possible moment to do it was now, before any
   code. `gh repo edit --visibility public` + `--accept-visibility-
   change-consequences` flipped the flag instantly.

4. **Re-ran branch protection — worked.** Applied PR-required (0
   reviewers, since solo), no force-push, no deletion, linear history,
   conversation resolution required. `required_status_checks` left
   `null` for now; will wire it up after task T009 produces the first
   CI run with a status-check name.

5. **Realised the constitution needed an amendment.** Going public
   surfaced two gaps in v1.0.0:
   - No explicit tone rule. Principle I covered IP. Principle III
     covered code mechanics + secrets. Neither said "respectful tone
     in committed artifacts."
   - No explicit PII rule. Same gap — secrets were forbidden, but
     "no real names, no emails, no employer-confidential info" was
     never spelled out.
   - And separately: `docs/starter.txt` was already strained against
     Principle I (it referenced copyrighted IP — "Super Rabbit Run",
     "Press Start") and now also strained against the new tone rule.
     We had kept it as "historical inspiration" in v1.0.0. With the
     repo public, that excuse was no longer good enough.

6. **Drafted Principle XII (Public-Repo Hygiene).** Two-part rule:
   tone (no profanity / slurs / gratuitous edge in committed text,
   "would a hiring manager / teammate / twelve-year-old be comfortable
   reading this") + PII (a specific enumerated list of things never
   to commit). Plus practical defaults (refer to the maintainer by
   GitHub handle; redact before pasting screenshots / terminal output;
   leak-response order = rotate, rewrite, journal).

7. **Generalised Principle II.** Removed the specific reference to
   `docs/starter.txt`. The new wording is: "Any prior brainstorming,
   charter notes, or third-party reference material is *inspiration
   only* — never authority for implementation decisions, and never
   committed to this repo unless it independently passes Principles I
   and XII." That rule now does the right thing for any future
   starter-doc, not just the one we had.

8. **Removed Governance section's residual `docs/starter.txt`
   reference** (a grep audit caught it after the main edit).

9. **Retired `docs/starter.txt`.** Preserved in git history at the
   initial-commit SHA (86d0e21) for anyone curious about the
   project's origin moment.

10. **Updated Sync Impact Report** to cumulative format: a fresh
    v1.1.0 section at the top describing this amendment, with the
    v1.0.0 section preserved verbatim below for audit trail.

11. **MINOR version bump (v1.0.0 → v1.1.0)** per the constitution's
    own versioning policy: a new principle is a MINOR change.

12. **Committed amendment + delete in one commit** (`d982aa8`). The
    file deletion is directly motivated by the amendment, so coupling
    them in one commit makes the rationale visible together.

13. **Memory updates.** Updated repo memory
    (`/memories/repo/carrot-code.md`) with the new constitution
    status, repo public URL, and the explicit "never re-introduce
    starter.txt" rule. Created new user memory
    (`/memories/public-repo-hygiene.md`) with the transferable
    lesson: "before drafting any committed artifact, check repo
    visibility and the project's tone/PII rules; default to
    professional tone + zero PII for public repos."

14. **Grep audit.** Ran a regex check for likely PII patterns
    (`rugeng`, `microsoft.com`, common email domains, real-name
    fragments seen in earlier screenshots) across all committed `.md`
    files. **Zero matches.** That's a good v1.1.0 baseline: nothing
    to clean up retroactively.

## Decisions

| Decision | Rationale | Reversible? |
|---|---|---|
| Go public instead of paying for Pro / deferring | Constitution already required public-repo-safe content; team-share goal needs public eventually; cheapest moment to do it was before any code | Easy in principle (`gh repo edit --visibility private`), socially awkward in practice |
| Add Principle XII as a new principle rather than expanding III | Tone + PII are conceptually distinct from code-mechanical bars; cleaner to reference ("Principle XII forbids X") than as a sub-bullet of III | Easy to merge later if XII proves redundant |
| Generalise Principle II rather than just delete the starter.txt sentence | "No raw historical inputs in the repo" is a real rule, just not one we had named. Now it's named | Easy |
| Retire starter.txt rather than redact it | The whole point of the file was the fan-game framing; redaction would leave a stub. Git history preserves the original for the curious | Easy (`git show 86d0e21:docs/starter.txt`) |
| Couple amendment + file delete in one commit | Single rationale unit; reviewer reads them together | N/A |
| MINOR not PATCH bump | "Added principle" is MINOR per our own versioning policy | N/A |
| `required_status_checks: null` for now | CI workflow doesn't exist until T009; can't require a check that has no name | Trivial — wire up after T009's first run |
| Self-reviewer / 0 approving reviews on branch protection | Solo Project Realities preamble explicitly contemplates self-review; the PR flow itself is what's non-negotiable, not the headcount | Easy |

## What worked

- **Choosing public was a clarifying moment.** Three days of "private
  for now" lasted until the first real friction (paywall). Removing
  the hedge made the constitution and the rules cleaner.
- **The amendment was triggered by a specific event** (paywall + going
  public), not by abstract principle drift. That's the right kind of
  trigger for a real constitution.
- **Grep-audit-before-amend** caught one leftover reference in the
  Governance section that the main edit had missed. Cheap insurance.
- **The Sync Impact Report's cumulative format** keeps the audit trail
  honest. Future amendments slot in at the top; the v1.0.0 history is
  preserved verbatim.
- **Three memory tiers used well** today: user memory for the
  transferable public-repo-hygiene lesson; repo memory for the
  carrot-code-specific constitution status and "never reintroduce
  starter.txt" rule; session memory unused (this session is short and
  about to end at T002 hand-off).

## What didn't

- **Tried to pipe a bash heredoc into `gh api`** for the branch-
  protection JSON. PowerShell doesn't have heredocs; the command
  errored mid-stream. Recovered by writing a temp JSON file and
  passing `--input <file>`. Lesson: when constructing JSON payloads
  for `gh api` on Windows, always use the temp-file pattern.
- **The platform copyright-reminder noise continued to escalate.**
  Today's instances landed in three new positions: as my own response
  output (replacing my actual text), as standalone user-frame turns,
  and twice as the entire body of a "user message" with no real
  content from the user. Per the deep analysis in the previous
  conversation, this is a Copilot Chat client-side safety injection
  triggered by certain keywords (constitution, ratify, public, IP).
  It is independent of spec-kit, independent of this repo's contents,
  and aligned with how I behave by default. Documented and silently
  ignored per agreement with the user. Worth a separate journal entry
  if the noise ever causes a real workflow failure (it hasn't yet).

## What I'd do differently

- **Go public from day one on a learning project.** "Private for now"
  costs more than it saves: it hides decisions that benefit from
  external pressure (tone, IP) and it tends to drift indefinitely.
  Next learning project: public from `git init`, with the constitution
  drafted with that assumption baked in.
- **Draft the constitution's tone/PII section in v1.0.0**, not v1.1.0,
  when starting any project intended for a public repo. v1.1.0 had to
  be triggered by an external event (paywall); v1.0.0 should have
  anticipated.
- **`gh api` PowerShell pattern**: stash a 2-line helper in user
  memory or a snippet so the heredoc reflex doesn't bite next time.

## Open questions / next session

- [ ] Proceed to T002 immediately after this entry is committed —
  user is "go" already, the journal is the last governance gate.
- [ ] After T009 (CI workflow), come back and add
  `required_status_checks` to the branch protection so CI is a real
  merge gate. Don't forget. (Possible future automation: a
  `verify-branch-protection` task in the polish phase that uses
  `gh api` to confirm CI is in the required list.)
- [ ] If a stranger ever opens an issue or PR on the now-public repo,
  add `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` + an issue template.
  Not needed yet — single-maintainer repo with no traffic — but the
  Principle XII tone bar will need to extend to those documents when
  they exist.

## Artifacts touched

- `.specify/memory/constitution.md` (Sync Impact Report cumulative
  format; Principle II generalised; Principle XII added; Governance
  starter.txt reference removed; version line v1.0.0 → v1.1.0)
- `docs/starter.txt` (retired)
- `/memories/repo/carrot-code.md` (constitution status updated; repo
  state section added; never-reintroduce-starter.txt rule)
- `/memories/public-repo-hygiene.md` (new — transferable lesson)
- `docs/learning/journal/2026-05-17-constitution-v1.1.0.md` (this
  file)

## Commits

```
d982aa8  docs(constitution): v1.1.0 amend — add Principle XII; retire starter.txt
```

## Reproducibility note

- Constitution version at end of session: **v1.1.0**
- Repository visibility at end of session: **public**
- Branch protection on `main`: configured (PR required, linear
  history, no force-push, no deletion, conversation resolution
  required; status checks pending CI in T009)
- Active branch: `001-vertical-slice` (7 commits ahead of `main`)
- spec-kit CLI: `specify-cli==0.8.10` (unchanged)
- Agent: GitHub Copilot Chat in VS Code
