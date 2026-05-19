# Implementation Plan: Shipping Infrastructure

**Branch**: `002-shipping-infrastructure` | **Date**: 2026-05-18 | **Spec**: [spec.md](./spec.md)

## Summary

Ship the project's continuous-deployment pipeline as defined in [spec.md](./spec.md): a public HTTPS URL serving the current production branch's build via Azure Static Web Apps (Free SKU) in `westus2`, per-branch preview URLs for every non-default branch, end-to-end PWA installability verification on iOS Safari + Android Chrome + desktop Chromium, and an end-to-end offline service-worker verification on a real URL — all of which are preconditions for the 001 vertical slice's PWA/offline acceptance scenarios.

**Approach**: provision a single SWA resource in `rg-carrot-code` via the Azure portal's GitHub-connect flow (one-time UI step), commit the auto-generated GitHub Actions workflow as the source of truth for deploys, commit a `staticwebapp.config.json` that mirrors the SPA-fallback + immutable-asset-cache policy currently in `netlify.toml`, drop in placeholder PWA icons sufficient to clear the manifest 404s, and update `README.md` + `HANDOVER.md` with the live URL. The existing `netlify.toml` is retained with a reference comment; the existing CI workflow (`typecheck / lint / test / build`) is unchanged and continues to be the configured required status check on `main` — the new deploy workflow runs additively.

No TypeScript source changes. No new npm dependencies. No new `package.json` scripts. The SWA Action invokes the existing `npm ci && npm run build` path.

## Technical Context

**Language/Version**: No new code languages introduced. Existing TypeScript 5.x (build target) is unchanged. New committed artifacts are JSON (`staticwebapp.config.json`) and YAML (the SWA workflow) plus binary PNG icons.

**Primary Dependencies**: None new. The deploy pipeline uses:

- `Azure/static-web-apps-deploy@v1` (GitHub-marketplace action, referenced by the auto-generated workflow file; not an npm dependency)
- Azure Static Web Apps (Free SKU) as the hosted runtime
- The existing `vite-plugin-pwa` configuration in `vite.config.ts` is the source of the manifest + service worker; this feature does not change it.

**Storage**: N/A. SWA Free serves static files only. No backend, no database, no Functions, no Cosmos DB. The project's existing `localStorage`-based `SaveService` is unaffected.

**Testing**: Predominantly **manual playtest-style** verification on real devices and URLs. The unit-test suite (Vitest) gains nothing testable from this feature because there is no new pure TypeScript logic. Per-user-story manual checklists in `tasks.md` (next subagent call) will cover:

- US1: production URL serves the committed HEAD within 5 minutes of push (verified at least twice on independent pushes).
- US2: PWA install completes on each of iOS Safari, Android Chrome, desktop Chromium, and the installed launcher opens chromeless.
- US3: a non-default branch push produces a unique preview URL distinct from production.
- US4: with network disabled in DevTools (or airplane mode on device), reload of the production URL renders the BootScene.

Coverage tooling is not extended for this feature — there is no new pure-logic code.

**Target Platform**:

- **Build/deploy runtime**: GitHub Actions hosted runner (`ubuntu-latest`); Node 20 (matches existing `ci.yml`).
- **Host runtime**: Azure Static Web Apps (Free SKU), region `westus2` (with `centralus` as the documented fallback if Free is unavailable in `westus2` at provisioning time).
- **Client runtime (for verification)**: iOS Safari (maintainer's device or a family member's), Android Chrome, desktop Chromium-based browser (Chrome / Edge). PWA install on each must produce a standalone-mode launcher per Constitution Principle V.

**Project Type**: Single-project SPA (browser game). This feature adds infrastructure / deploy plumbing only — the source-code tree shape from 001's plan is unchanged.

**Performance Goals**: SWA's global edge network serves the static `dist/` artifact. SC-002 requires the production URL to reach entry rendering in under 10 seconds on a typical home connection; SC-004 requires offline reload to render the BootScene within 3 seconds. Both are satisfied by Vite's output sizes (the existing `vite-plugin-pwa` precaches the build) without any new tuning. No new performance budget is introduced — the per-level asset-payload budget from 001 (≤ 2 MB) is the binding constraint.

**Constraints**:

- **SWA Free SKU quotas** (documented in research.md): 100 GB outbound bandwidth/month, 250 MB per app, 2 custom domains (we use 0), 100 staging environments. None are at risk at solo-project scale.
- **SWA Free regional availability**: `westus3` is not supported; `westus2` is the chosen region with `centralus` fallback (research.md Q1).
- **No secret values in committed files** (Constitution Principle XII / FR-022). The SWA deployment token lives only as a GitHub repo secret; the secret *name* (`AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM>`) is referenced in the workflow YAML but the *value* never enters the repo.
- **Workflow file is the source of truth** (FR-017). Any Azure-portal regeneration must be reviewed as a diff before being committed.
- **Production branch reference is configurable** (FR-004). Today the workflow's production trigger is `001-vertical-slice`; after the slice merges to `main`, the trigger is updated in the same commit/PR that performs the rename.
- **No npm dependency additions** and **no new `package.json` scripts**. The SWA Action calls `npm ci && npm run build` directly using the existing `build` script.

**Scale/Scope**: One Azure resource (the SWA), one resource group, one GitHub secret, four new files at the repo root (`staticwebapp.config.json`, the SWA workflow, and two `public/icons/*.png` placeholders — the third icon path and `apple-touch-icon.png` are already declared in `vite.config.ts` / `index.html`), three edited files (`README.md`, `docs/learning/HANDOVER.md`, `netlify.toml`). Estimated wall-clock from "click Create" to "live URL serves the slice" measured in minutes, not hours.

## Constitution Check

*Gate: must pass before Phase 0 research. Re-checked after Phase 1 design — all 12 principles still pass; no design decision in this plan changes any verdict.*

| # | Principle | Verdict | Notes |
|---|---|---|---|
| I | Original IP Only | ✅ | The only "asset" content this feature ships is placeholder PWA icons — flat solid-color PNG fills at the manifest-declared dimensions. Not derivative of any IP. Final art is `001-vertical-slice` T052, separately governed. |
| II | Spec-First, Always | ✅ | [spec.md](./spec.md) exists, was reviewed via [checklists/requirements.md](./checklists/requirements.md), and is committed (6d79d35). This plan is downstream of it. |
| III | Production-Quality Code From v0 | ✅ | New committed files are configuration (`staticwebapp.config.json`, the SWA YAML workflow) and binary icons. JSON formatting is covered by Prettier (already configured); YAML and PNG are out of Prettier's scope. No new TypeScript code lands; no `any`, no magic numbers, no hardcoded strings or colors introduced. The no-secrets bullet is honored — see XII. |
| IV | Data-Driven & Extensible | N/A | No gameplay data or entity content introduced. The only structured-data artifact is `staticwebapp.config.json`, which is host configuration, not game data. |
| V | Vertical Slice Before Breadth | ✅ | This feature is itself a single vertical slice: one user-visible capability (the project ships) delivered end-to-end (provision → deploy → install → offline verify), not breadth across hypothetical future infrastructure. The spec's four user stories are P1–P4 priorities of the same slice. |
| VI | Tested Where It Matters | ✅ | No pure-logic code added → no Vitest tests added. Per-US manual playtest checklists land in `tasks.md`. This matches Principle VI's "mechanical tests for mechanical code; human tests for human feel" — here, "human tests for human-observable infrastructure outcomes." |
| VII | Free / Open Assets Only | ✅ | Placeholder icons are generated from scratch (solid-color PNG fills) and ship as CC0 by default per the project's `public/assets/CREDITS.md` policy. No third-party icon set, no AI-generated content, no derivative of any IP. |
| VIII | Ships From Day One | ✅ | This feature literally implements this principle for the project. The new deploy workflow is *additive* to the existing CI workflow that is already the required status check on `main`; no existing gate is weakened. |
| IX | Readable Over Clever | ✅ | Standard SWA + GitHub-connect setup. No custom OIDC federation, no deployment slots, no enterprise multi-environment patterns, no Bicep / ARM templates committed. The committed workflow is the one Azure auto-generates, reviewed for sensible defaults (Node version, build command, output path) per FR-016. |
| X | Performance Is A Feature | ✅ | SWA's global edge network is the perf story. No new asset payload is added beyond placeholder icons (each well under 50 KB; the per-level ≤ 2 MB budget from 001 is unaffected). SC-002 and SC-004 latency targets are within typical SWA + Vite-PWA performance envelopes. |
| XI | Don't Build The Future, Don't Preclude It Either | ✅ | Explicit non-goals (in spec): no auth, no analytics, no backend, no custom domain, no staging slots. *Doors open*: future Functions / Cosmos / auth can be added to the same SWA resource through the same workflow without re-provisioning, because SWA's hybrid model is the standard upgrade path. We build none of that now. |
| XII | Public-Repo Hygiene | ✅ | No PII, no real names, no maintainer email or phone, no Azure subscription ID / tenant ID / resource ARM ID in committed files. The SWA deployment token is referenced by *name* (`AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM>`) only; the *value* lives in GitHub Actions secrets and never enters the repo. Tone of all new docs (this plan, research, contracts, quickstart) is plain English, professional, no edge. |

**Result**: All 12 principles pass. **Complexity Tracking section omitted** (no violations to justify).

## Project Structure

### Documentation (this feature)

```text
specs/002-shipping-infrastructure/
├── spec.md                       # Feature spec (committed 6d79d35)
├── plan.md                       # This file
├── research.md                   # Phase 0: SKU/region/quotas/workflow shape
├── data-model.md                 # Phase 1: staticwebapp.config.json schema (the only structured-data shape)
├── quickstart.md                 # Phase 1: how a fresh contributor (or future-self) verifies the deploy from a clone
├── contracts/
│   └── swa-deployment.md         # Phase 1: workflow inputs/outputs + failure-mode taxonomy
├── checklists/
│   └── requirements.md           # Spec quality checklist (committed)
└── tasks.md                      # Phase 2 output (/speckit.tasks command — NOT created by this plan)
```

### Source code & repository artifacts

This feature does not change `src/` or `tests/`. It adds and edits files at the repository root and under `public/icons/` and `.github/workflows/`.

```text
# NEW files (committed by this feature)
staticwebapp.config.json                          # SPA fallback + cache headers (mirror of netlify.toml policy)
.github/workflows/azure-static-web-apps-<random>.yml
                                                  # Auto-generated by the Azure portal during GitHub-connect.
                                                  # The <random> suffix is fixed once Azure assigns it; the
                                                  # filename then never changes. We review and minimally edit
                                                  # it (Node version, build_location, output_location).
public/icons/icon-192.png                         # Placeholder 192×192 PWA icon (referenced by manifest)
public/icons/icon-512.png                         # Placeholder 512×512 PWA icon (referenced by manifest)
public/icons/icon-maskable-512.png                # Placeholder 512×512 maskable PWA icon (referenced by manifest)
public/icons/apple-touch-icon.png                 # Placeholder 180×180 iOS home-screen icon (referenced by index.html)

# EDITED files
README.md                                         # Add live URL prominently (FR-024)
docs/learning/HANDOVER.md                         # Add live URL to TL;DR (FR-025)
netlify.toml                                      # Add top-of-file comment block: "Kept for reference; this
                                                  #   project deploys via Azure SWA. See
                                                  #   .github/workflows/azure-static-web-apps-*.yml" (FR-020)

# UNCHANGED — explicitly noted to prevent accidental edits
.github/workflows/ci.yml                          # Existing CI workflow stays exactly as-is; it remains the
                                                  #   required status check on main per branch protection.
vite.config.ts                                    # Existing PWA + manifest config is correct; this feature
                                                  #   only provides the placeholder icons it already declares.
package.json                                      # No new dependencies, no new scripts. The SWA Action calls
                                                  #   the existing `build` script directly.
src/**                                            # No TypeScript changes.
tests/**                                          # No unit-test additions (no new pure-logic code to test).
```

**Placeholder icon quality**: deliberately low. A solid-color flat fill at the correct pixel dimensions clears Chrome / Lighthouse installability checks and resolves the current manifest 404 (verified in research.md / quickstart.md). Real art is 001's T052 and lands through a separate PR; swapping the file paths is a one-line `git add` once the art exists. The placeholders MUST NOT depict any specific character, mark, or motif that could be confused with copyrighted IP (Principle I — flat fill only, no glyphs that look like trademarked symbols).

**Workflow filename**: Azure picks the `<random>` suffix and commits the file directly to the repo on its first run. We do not pick it; we accept whatever Azure produces and treat that filename as stable from that point on (Azure does not re-randomize it on subsequent edits unless the SWA resource is deleted and re-created).

**Structure Decision**: Single-project SPA layout is unchanged from 001's plan. This feature's structural footprint is two repo-root files (`staticwebapp.config.json` and a docs edit), one `.github/workflows/` addition, and a small `public/icons/` directory. No new top-level directories are introduced.

## Complexity Tracking

*No constitution violations. Section intentionally empty.*
# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]

**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]

**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]

**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]

**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]

**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
