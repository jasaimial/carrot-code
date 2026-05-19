# Journal — 2026-05-18 — shipping infrastructure

## Context

End of a long session focused on standing up the project's production
deploy pipeline. The 001 vertical slice is still in flight (PR #1
open; Phase 2 done up to T020), but the maintainer raised "when do
we provision production?" mid-session, which turned into a separate
spec `002-shipping-infrastructure`.

The thread that motivated extracting this from the 001 slice's T058:
US4's "PWA install" acceptance scenarios are unverifiable on
localhost — iOS Safari "Add to Home Screen" only surfaces on HTTPS,
and Lighthouse's PWA audit fails on `http://` regardless of how
correct the manifest is. So either US4 ships untested, or we get a
real HTTPS URL up before US4 lands. Latter is obviously right.
Hence 002.

## What happened

Chronologically:

1. **Spec authoring** via `/speckit.specify` subagent. Brief was
   exhaustive (decisions pre-locked from chat — Azure SWA Free,
   westus2, rg-carrot-code, GitHub Actions Secrets as the vault).
   The /speckit.clarify command was deemed not needed; the
   /speckit.plan subagent ran without blockers. Constitution Check
   reported all 12 principles green. Spec / plan / tasks committed
   as separate commits per project convention.
2. **Independent analyzer pass** (the maintainer's "judiciary"
   question — see entry below). `/speckit.analyze` subagent caught
   real things the planner missed: stale Android Chrome references
   in plan.md + quickstart.md after the device-matrix narrowing
   landed in spec.md only; a "no new top-level directories" claim
   in plan.md contradicted by tasks.md introducing `scripts/`;
   Principle V's Android arm under-justified; missing T122 grep
   patterns. All addressed in a batch commit before T101 ran.
3. **Reviewer-agent skill authored** in the same session — a project-
   specific `carrot-code-reviewer` subagent codifying Constitution
   v1.1.1 + the design ground rules as mechanical checks. Documented
   in HANDOVER with trigger phrases. Maintainer's intent: use it
   after 002 ships.
4. **The "portal-only" misread** (full story in research.md Q10):
   tasks.md T103 originally asserted that creating an SWA + wiring
   up GitHub Actions required the Azure portal. The maintainer
   challenged it — "you've done this autonomously with az on other
   projects." They were right. `az staticwebapp create --source
   <repo-url> --token (gh auth token)` does the same OAuth handshake
   the portal triggers: commits the deploy workflow file to the
   branch, writes the deployment token to GitHub Secrets, all on the
   caller's behalf. Authored `infra/provision-swa.ps1` to wrap it
   with the sensitive-identifier discipline (subscription verified
   by name not ID; token read fresh from `gh auth token`; never
   persisted). Spec docs updated to reflect reality; new research
   Q10 documents the discovery so future readers don't repeat the
   misread.
5. **Provisioning** ran in ~90 seconds: subscription verify, RG
   create (idempotent), SWA create with --source --token --sku
   Free --branch 001-vertical-slice --app-location / --output-location
   dist. Azure committed `.github/workflows/azure-static-web-apps-
   happy-desert-0fe507f1e.yml` to 001-vertical-slice, wrote the
   `AZURE_STATIC_WEB_APPS_API_TOKEN_HAPPY_DESERT_0FE507F1E` secret,
   minted the public host name `happy-desert-0fe507f1e.7.azurestaticapps.net`.
6. **Workflow review (T106/T107)**: the five-field checklist
   surfaced exactly one edit needed — Azure's default `node-version`
   omits a pin and the action defaults to Node 18; pinned to Node
   20 to match `ci.yml` + `package.json` engines. Other four fields
   were already correct (app_location: "/", api_location: "",
   output_location: "dist", skip_app_build: absent). Sensitive-ID
   scan on the workflow YAML: zero UUID matches, zero
   /subscriptions/ paths, zero email addresses. Only the GH secret
   NAME appears (a name-not-value reference; FR-022-compliant).
7. **Opened draft PR #2** (002 → 001) so subsequent pushes to the
   002 branch would trigger SWA preview deploys via the
   `pull_request` event. Without an open PR, the workflow's
   `on.push.branches: [001-vertical-slice]` wouldn't fire on the
   002 branch.
8. **Phase 3 (T108–T114)**: `public/staticwebapp.config.json` (NOT
   repo-root — see the mid-flight correction below), the four
   placeholder PNGs via `scripts/generate-placeholder-icons.mjs`,
   the netlify.toml top-of-file "deploy via Azure SWA" comment.
   ESLint config gained a `scripts/**/*.mjs` override block (Node
   globals + relaxed JSDoc rules for non-TS helpers). Push + first
   preview deploy.
9. **T114 verification** surfaced the second mid-flight correction:
   SWA was serving `/manifest.webmanifest` as `Content-Type:
   application/octet-stream`. SWA's response pipeline picks
   Content-Type from the `mimeTypes` block BEFORE per-route headers
   override it, so the route-headers attempt to set
   `application/manifest+json` was silently ignored. Moved the MIME
   declaration to the right block; re-deployed; verified all four
   targets (root, SPA fallback, /assets/* cache, /sw.js cache,
   /manifest.webmanifest content-type) on the preview URL.
10. **Phase 4 playtests**: T115 (shareable URL, latencies), T116
    (PWA install on iOS Safari + desktop Chromium + desktop Firefox),
    T117 (per-branch preview generation + cleanup — see results
    below), T118 (service worker offline). All four green per the
    maintainer's report. No failures, no surprises.
11. **Phase 5 (this entry + the docs commit)**: README live URL,
    HANDOVER TL;DR refresh, 001-T058 reduction, and this journal.

## Decisions

| Decision | Rationale | Reversible? |
| --- | --- | --- |
| Azure SWA Free, not Netlify | Maintainer already in Azure ecosystem; auto-generated workflow becomes a committed reviewable artifact (Netlify's deploy is opaque); future backend (Cosmos free tier for multi-profile sync per HANDOVER roadmap) sits in the same ecosystem | Yes — netlify.toml retained for reference, can swap with one spec |
| westus2, fall back to centralus | Closest Free-supported region to maintainer; westus3 explicitly NOT Free-supported (decision tree in research.md Q1) | Yes |
| GitHub Actions Secrets, NOT Azure Key Vault | Single-secret, single-consumer (the workflow). GH Secrets IS structurally a vault for this scale; Key Vault adds OIDC federation + Azure AD trust hops without adding protection. Q9 documents the four conditions that would flip this | Yes — graduate to Key Vault when multi-repo / compliance / runtime-read appears |
| `infra/provision-swa.ps1`, not portal-required | Spec originally said portal-only; the CLI does it; the script wraps it with sensitive-identifier discipline. Q10 documents the discovery | Yes |
| `public/staticwebapp.config.json`, not repo-root | Vite copies `public/` -> `dist/` automatically; SWA reads from output root. Repo-root file would be silently ignored | Yes |
| `mimeTypes` block, not route headers, for Content-Type | Empirically verified at T114 that SWA's response pipeline ignores route-header Content-Type | Yes |
| Throwaway-branch test (PR #3) for FR-007 cleanup verification | Cheapest end-to-end exercise of the SWA preview lifecycle that doesn't require waiting for a real branch to be deleted | Yes — PR #3 is closed; only a few-line audit-trail entry in the repo's PR history |
| Android Chrome explicitly out of scope for v0 | Device unavailable; spec Non-Goals codifies. Same Chromium codebase as desktop, so install behavior is expected to work — but expected ≠ verified, and the spec doesn't assert what wasn't tested | Yes — re-opens as a follow-up spec when device available |

## What worked

- **`/speckit.analyze` as the "judiciary."** The maintainer's
  insight that the planning subagent self-attesting Constitution
  green isn't really an independent check. Adding the analyze pass
  caught five real issues (stale Android refs, no-new-top-level
  contradiction, Principle V under-justification, missing grep
  patterns, plus the offered observation that the reviewer-agent's
  mode:spec overlaps /speckit.analyze). Worth proceduralizing.
- **`infra/` vs `scripts/` directory split.** Makes blast radius
  obvious — typo in `scripts/` breaks your local FS; typo in
  `infra/` can spin up a billed cloud resource. Worth carrying
  forward to any future cloud work.
- **The committed PowerShell provisioning script.** Idempotent,
  inputs as parameters, sensitive-IDs filtered at every `az` call.
  Future re-provisioning (test sandbox, post-disaster, contributor
  bootstrap) is one command.
- **Per-branch preview URLs via SWA's pull_request event.** Zero
  friction: open a draft PR, get a preview URL ~1 minute later.
  Worth keeping as the canonical "share a work-in-progress" pattern
  rather than ever building anything bespoke.
- **The grep checklist in T122.** Not yet automated as a pre-commit
  hook, but the discipline held for this commit: patterns 1–4 ran
  clean (see results below), pattern 5 (maintainer's tenant display
  name) is the interactive step. Worth automating as a follow-up.

## What didn't

- **The "portal-only" misread**. Planning + tasks subagents both
  asserted T103 needed a portal click. Documented in research Q10.
  The lesson — when a spec asks for manual steps that "feel like"
  something a CLI could do, verify CLI capability with
  `<command> --help` before accepting the claim — is exactly the
  kind of thing a future iteration of the reviewer-agent or a
  v1.1.2 constitution amendment could codify.
- **Sensitive-identifier near-miss during T117**. The narrow `az
  staticwebapp environment list --query "..." -o table` invocation
  failed to render twice in PowerShell (unclear cause — Select-Object
  -Skip chain interacted weirdly with the cryptography UserWarning
  the az CLI emits on Windows). I fell back to the unfiltered call,
  which printed the subscription ID in the JSON response into chat
  scope. Discipline held: the UUID went nowhere committed. But the
  near-miss is real and the ops lesson is: when a `--query`-narrowed
  call fails, fall back to a DIFFERENT narrow query (e.g., `-o tsv`
  with explicit field projection), NEVER to unfiltered output.
  Updating user-memory with this rule.
- **The `.webmanifest` Content-Type silent override**. The SWA
  schema documentation is technically correct (mimeTypes for
  extension-based MIME, routes for path-based headers), but the
  precedence isn't documented in a way that would have prevented
  the misread. Caught only because T114 was thorough enough to
  check Content-Type, not just status codes. Confirms the value
  of post-deploy verification beyond "did the request return 200."

## What I'd do differently

- **Author `infra/` from the start.** The spec originally went
  straight from "Azure provisions things" to "the maintainer clicks
  in the portal." A reviewer (the maintainer in this case) caught
  that's a workflow regression for an agentic project. Next time:
  start any deploy spec by asking "what's the CLI equivalent?" and
  draft the script first.
- **Run /speckit.analyze immediately after /speckit.plan, not after
  tasks.md.** The analyze pass would have caught the Android
  Chrome staleness BEFORE the maintainer had to ask about device
  availability separately. Folding analyze into the standard flow
  (spec -> plan -> analyze -> tasks -> implement) costs one subagent
  call per feature and pays for itself the first time it finds
  anything.
- **Add a constitution amendment proposal for "any infra/deploy
  spec MUST invoke /speckit.analyze before implementation."** Drafted
  in chat but not yet committed; lands after 002 fully closes so
  this feature's data informs the amendment's text.

## Phase-4 playtest results (per maintainer's report)

| Task | Target URL | Result |
| --- | --- | --- |
| T115 — shareable URL (P1) | production | ✓ all four checklist items |
| T116 — PWA install (P2) | PR #2 preview | ✓ iOS Safari + desktop Chromium + desktop Firefox parity |
| T117 — per-branch previews (P3) | dynamic | ✓ all four sub-tests (see detail below) |
| T118 — service worker offline (P4) | preview / production | ✓ |

### T117 detail (the agent-run one)

| Sub-test | Expected | Actual |
| --- | --- | --- |
| (a) PR #2 has unique preview URL | Distinct from production | `happy-desert-0fe507f1e-2.westus2...` ≠ `happy-desert-0fe507f1e.7....` ✓ |
| (b) Preview serves branch HEAD, not production | 002 has staticwebapp.config.json + icons; production doesn't | Verified during T114 (SPA fallback works on preview, icons return 200) ✓ |
| (c) Throwaway branch produces NEW preview | New env, distinct URL | `preview-test-throwaway` branched from origin/002, PR #3 opened, env `3` spawned at `happy-desert-0fe507f1e-3.westus2...`, smoke-test returned 200 / 3266 bytes ✓ |
| (d) Cleanup on PR close + branch delete | env disappears within ~5 min | env `3` gone within ~60 sec (exceeds expectation) ✓ |

## Grep checklist results (T122 pre-commit)

Per spec 002 task T122 + research Q9 sensitive-identifier discipline:

| Pattern                                                                                                          | Matches in this file | Status                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UUID `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`                                              | 0                    | ✓                                                                                                                                                                                                                                                                                                                                                                                                       |
| `/subscriptions/` ARM paths                                                                                      | 2                    | ✓ — both matches are **meta-references** (one in the "Workflow review" narrative describing what the scan looked for; one in this table describing the pattern itself). No actual ARM path leak. This is a known false-positive class the manual grep can't auto-distinguish from a real leak; a future pre-commit hook would need a way to whitelist "this document IS the documentation of the rule." |
| Email `[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}` (excluding @users.noreply.github.com per the T122 carve-out) | 0                    | ✓                                                                                                                                                                                                                                                                                                                                                                                                       |
| Token-shape `(eyJ[a-zA-Z0-9_-]{20,}\|sk-[a-zA-Z0-9]{20,}\|ghp_[a-zA-Z0-9]{20,}\|AKIA[A-Z0-9]{16,})`              | 0                    | ✓                                                                                                                                                                                                                                                                                                                                                                                                       |
| Maintainer's tenant display name (run interactively by maintainer at commit time)                                | —                    | maintainer to verify before final review approval                                                                                                                                                                                                                                                                                                                                                       |

**Lesson for future pre-commit-hook design**: the patterns above need
a "this file IS the rule itself, not an instance of the rule"
carve-out mechanism. Options: a magic comment at the file top
(`<!-- t122-grep-self-reference: ok -->`), a path-based exemption
(`docs/learning/journal/*` whitelist for pattern 2 only), or
context-sensitive matching (e.g., only flag `/subscriptions/<uuid>`
combos, not bare `/subscriptions/` strings). Worth noting for the
pre-commit-hook follow-up spec.

## Open questions / next session

- Spec 001 resumes at **T021 + T022** (level-loader test-first
  pair, same TDD shape as T019/T020 SaveService).
- **Pre-commit hook automation** for the grep checklist — bridges
  the gap between "manual discipline" and "mechanically enforced."
  Husky is one option; a Powershell pre-commit hook is another.
  Not yet specced.
- **Constitution v1.1.2 amendment** candidates (drafted, not yet
  ratified):
  - "Any plan with new infrastructure or new dependencies SHOULD
    invoke /speckit.analyze before implementation begins."
  - "When a spec asks for manual steps that feel CLI-automatable,
    the agent MUST verify CLI capability with `<command> --help`
    before accepting the spec's claim."
  - Principle V Android-arm softening (acknowledge device-
    availability deferral as a legitimate Non-Goal pattern, not a
    constitutional violation).

## Refs

- PR #1 (001 slice) — open at draft, will merge to main last per
  Constitution V
- PR #2 (this feature, 002) — open at draft, merges to 001 first
- PR #3 (T117 throwaway) — closed; visible in repo history with
  self-documenting title
- Spec: [specs/002-shipping-infrastructure/spec.md](../../specs/002-shipping-infrastructure/spec.md)
- Plan: [specs/002-shipping-infrastructure/plan.md](../../specs/002-shipping-infrastructure/plan.md)
- Research: [specs/002-shipping-infrastructure/research.md](../../specs/002-shipping-infrastructure/research.md)
  (Q9 = secrets; Q10 = the CLI-vs-portal discovery)
- Tasks: [specs/002-shipping-infrastructure/tasks.md](../../specs/002-shipping-infrastructure/tasks.md)
- Provisioning script: [infra/provision-swa.ps1](../../infra/provision-swa.ps1)
- Reviewer agent: [.github/agents/carrot-code-reviewer.agent.md](../../.github/agents/carrot-code-reviewer.agent.md)
- Live URL: <https://happy-desert-0fe507f1e.7.azurestaticapps.net>
