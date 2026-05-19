# Phase 0: Research

Quick rationale + alternatives considered for each technical decision in [plan.md](./plan.md). One Q&A per decision; "decision," "alternatives considered," and "rejected because" only — no detail beyond what's needed to defend the choice.

## Q1: Region — why `westus2`, and what's the fallback?

**Decision**: Provision the SWA in `westus2`. If `westus2` is unavailable for the Free SKU at provisioning time, fall back to `centralus`. Do NOT use `westus3`.

**Why**: Azure Static Web Apps Free SKU is regionally limited. As of 2026-05, the published supported regions for the Free SKU include `westus2`, `centralus`, `eastus2`, `westeurope`, and `eastasia`. `westus3` is explicitly *not* in the Free-supported list — provisioning a Free SWA there fails. `westus2` is the closest supported region to the maintainer's geography; `centralus` is the next-closest documented fallback.

**Decision tree at provisioning time**:

```text
1. az staticwebapp create --sku Free --location westus2 ...
   → success → use westus2.
   → failure ("location not supported for SKU Free" or similar) →
2. az staticwebapp create --sku Free --location centralus ...
   → success → use centralus, update plan.md and journal with the actual
     region in a one-line edit before committing the workflow.
   → failure → STOP. Re-read the Azure docs for the current Free-region
     list before picking a third option. Do NOT silently switch SKU to
     Standard to "make it work" — that turns a free service into a billed
     one.
```

**Alternatives considered**:

- **`westus3`** — rejected: not in the Free-SKU region list.
- **`eastus2` / `westeurope` / `eastasia`** — supported but geographically farther; latency to the maintainer's location is worse than `westus2`. Acceptable only if both `westus2` and `centralus` are unavailable, in which case the decision is re-opened, not made silently.

**Rejected because**: `westus2` minimizes RTT for the maintainer and family playtesters and is the canonical Free-supported US-west region.

## Q2: SKU — Free vs Standard?

**Decision**: Free SKU.

**Quota envelope** (Free, as of 2026-05; values stated for situational awareness, not as a feature target):

- **Bandwidth**: 100 GB outbound per month per app. Solo-project demo traffic is comfortably under 1 GB/month.
- **App size**: 250 MB total deployed content. The current Vite build is well under 10 MB.
- **Custom domains**: 2 per app. We use 0 (Azure-provided `*.azurestaticapps.net` host name is sufficient; see Q4).
- **Staging environments**: 100 per app. Per-branch previews count toward this; at solo scale we'll never approach the cap, but stale-branch cleanup (FR-007) keeps it tidy anyway.
- **SSL certificates**: managed and free on both the default host and any custom domain.
- **API (Functions integration)**: limited to 0.5 GB-seconds per month and Node 18 only. We do not use this and have no current plan to.

**Alternatives considered**:

- **Standard SKU** ($9/month/app base + bandwidth overage) — necessary for SLA-backed uptime, private endpoint integration, larger app sizes, BYO Functions runtime. None of which we need. Standard would burn maintainer-private-subscription budget for zero current value.

**Rejected because**: Free is genuinely $0 and matches our solo-project scale; saving the Visual Studio Enterprise credit for possible future *backend* work (e.g., Cosmos free tier for multi-profile sync) is a more valuable use of the budget than upgrading SKU on a feature that needs nothing the SKU offers.

## Q3: Production vs preview environments — how does branch mapping work?

**Decision**: Use SWA's default branch-mapping behaviour. The auto-generated GitHub Actions workflow's `on.push.branches` list controls which branch is "production"; all other pushed branches produce per-branch preview environments automatically (per the SWA Action's default behavior when `production_branch` is set in the SWA resource).

**Mechanics**:

- The SWA resource itself has a configured **production branch** (set at creation time and editable later via portal or `az staticwebapp update --branch <name>`). This is the only branch whose builds replace the live production URL.
- The auto-generated workflow's `on.push.branches: [<production-branch>]` and `on.pull_request.branches: [<production-branch>]` triggers determine *when* the workflow runs.
- For a push to a branch *other* than the production branch, the SWA Action publishes the result as a **preview environment** with a URL of the form `<app-name>-<random>.<environment-name>.<region>.azurestaticapps.net` (the `<environment-name>` is the branch name with sanitisation). Each preview is independent and persists until the branch is deleted (FR-007).
- PRs against the production branch get a preview URL posted as a bot comment on the PR by the `Azure/static-web-apps-deploy@v1` action.

**Production-branch transition** (FR-004):

- **Phase A (slice in flight)**: production branch is `001-vertical-slice`. The workflow's triggers reference `001-vertical-slice`. Pushes to other branches (e.g., `002-shipping-infrastructure` itself) get preview URLs.
- **Phase B (slice merged)**: in the same commit/PR that merges 001 to `main`, the workflow's branch triggers are updated from `001-vertical-slice` to `main`, and the SWA resource's production-branch setting is updated to `main` via `az staticwebapp update --branch main` (one-line CLI call). The Azure-provided host name does not change.

**Alternatives considered**:

- **One-resource-per-environment** (separate SWA for staging, separate SWA for production) — heavy. SWA's preview-environment model is designed exactly for this and is free under the Free quota. No reason to fight the platform.
- **Manual deploy-only-on-tag** trigger — defeats the point of continuous deployment (Principle VIII).

**Rejected because**: the platform default exactly matches our intent and the quota cost is zero.

## Q4: Custom domain — yes or no?

**Decision**: No. Use the Azure-provided `<app-name>-<random>.<region>.azurestaticapps.net` host name indefinitely.

**Alternatives considered**:

- **Buy a domain (e.g., `carrot-code.com`) and configure CNAME** — costs money, recurring renewal, DNS configuration, certificate provisioning (automated by SWA but still an extra step). Provides zero technical value for a learning project whose audience is the maintainer's family and a few playtesters.

**Rejected because**: explicit non-goal in the spec. If ever wanted, a custom domain is a separable spec; SWA Free supports up to 2 custom domains so the door stays open at no cost.

## Q5: `staticwebapp.config.json` — what's the minimum config we need?

**Decision**: Two top-level keys at minimum: `navigationFallback` (for SPA deep-link behaviour, mirroring the current `netlify.toml` `[[redirects]]` rule) and `routes` / `globalHeaders` (for immutable-asset cache headers on `/assets/*`, mirroring the current `netlify.toml` `[[headers]]` rule).

**Why this is the smallest correct config**: SWA's default behaviour without `navigationFallback` is to return 404 for unmatched paths — which breaks any SPA route or PWA deep link that doesn't correspond to a real file on disk. SWA's default cache headers do not declare immutability on hashed-asset filenames, which means players' browsers may re-fetch already-cached assets on every navigation. Both behaviours are corrected by file-level configuration; neither requires Functions or Authentication setup.

**Schema reference** (the fields we use; see [data-model.md](./data-model.md) for full annotated example):

- `navigationFallback.rewrite`: serve `/index.html` for any path that doesn't match a file in the build output. Status code remains 200 — critical so service worker registration and PWA install behave correctly.
- `navigationFallback.exclude`: do NOT apply the SPA fallback to `/assets/*` (let 404s on real missing assets surface as 404s), `/icons/*`, `/manifest.webmanifest`, `/sw.js`, and the service-worker scope helpers — same set of exclusions a typical Vite SPA needs.
- `globalHeaders` OR `routes[].headers`: apply `Cache-Control: public, max-age=31536000, immutable` to `/assets/*` (hashed Vite output), short-cache headers to `/sw.js` (per the existing `netlify.toml`'s correctness reasoning — the service worker must never be cached aggressively or users get stuck on old builds), and `Content-Type: application/manifest+json` on `/manifest.webmanifest`.

**What we do NOT use**: `auth` (no login), `forwardingGateway` (no proxy), `platform.apiRuntime` (no Functions), `responseOverrides[404]` for redirects (the SPA fallback handles it).

**Alternatives considered**:

- **Rely on SWA defaults** — rejected: SPA fallback would 404 on deep links; cache headers would be inconsistent with the project's existing performance contract.
- **Replicate every header from `netlify.toml`** (CSP, X-Frame-Options, etc.) into `staticwebapp.config.json` — out of scope. SWA Free provides reasonable defaults for security headers; revisiting CSP is a separate hardening spec if ever wanted.

**Rejected because**: minimum-correct-config is the right size for v0. It mirrors the policies we already proved correct under Netlify; it doesn't ship anything novel.

## Q6: GitHub Actions workflow — what does Azure auto-generate, and what do we adjust?

**Decision**: Accept the Azure-auto-generated workflow at `.github/workflows/azure-static-web-apps-<random>.yml` and review it for **five specific defaults** before relying on its first run:

1. **`node-version`** — Azure's default may be 18 or 20 depending on the day. Confirm it matches the project's local Node version (currently 20, per `package.json` `engines` and `ci.yml`). If Azure picked 18, change to 20.
2. **`app_location`** — defaults to `/`. Correct for this repo (the Vite project is at the root). No change.
3. **`api_location`** — defaults to `""` (empty string) which means "no Functions API." Correct. Do not change.
4. **`output_location`** — defaults to `""` for unconfigured projects; we set it to `dist` to match Vite's output. **This is the one edit most likely to be required.**
5. **`skip_app_build`** — defaults to `false`. Correct: we want the SWA Action to invoke our build. If it were `true`, the action would assume `dist/` is already built and committed (it isn't, and shouldn't be).

**Workflow trigger** (also reviewed):

- `on.push.branches`: must reference the configured production branch (see Q3). Today: `001-vertical-slice`. After slice merge: `main`.
- `on.pull_request.branches`: usually mirrors `on.push.branches`; this is what causes PRs against production to get preview URLs.

**Secret reference**:

- The action expects `azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM> }}`. The secret is created automatically by the Azure portal during the GitHub-connect flow; the maintainer never sees the token value (FR-022). The secret *name* may be referenced in the workflow YAML.

**What we do NOT touch**:

- The action's `repo_token: ${{ secrets.GITHUB_TOKEN }}` reference — this is the standard PR-comment auth and is correct as auto-generated.
- The `Azure/static-web-apps-deploy@v1` action version pin — accepting Azure's default (currently `@v1`) is fine; pinning to a specific SHA is over-engineering for a solo project with low blast radius.

**Alternatives considered**:

- **Hand-write the workflow from scratch** — works, but the auto-generated version already encodes the correct action invocation, the correct secret reference, and the correct event triggers. Re-writing is busywork that introduces drift risk.
- **OIDC federation instead of token-based auth** — more secure (no long-lived token), but adds Azure AD app-registration setup, federated-credential configuration, and workflow `id-token: write` permissions. Out of scope for solo-project simplicity per the spec's pre-locked decisions.

**Rejected because**: the auto-generated workflow with a 4–5-field review is the documented happy path for SWA + GitHub. Custom-rolling or OIDC-ing has zero current payoff against this project's threat model.

## Q7: PWA icons — generation strategy for placeholders

**Decision**: Generate four placeholder PNGs from scratch as solid-color fills at the manifest-declared pixel dimensions:

| Path | Dimensions | Purpose | Color (suggested) |
|---|---|---|---|
| `public/icons/icon-192.png` | 192×192 | Standard PWA icon (Chrome/Android) | `#2d6a3e` (bgForest) |
| `public/icons/icon-512.png` | 512×512 | High-res PWA icon (install dialogs, splash) | `#2d6a3e` (bgForest) |
| `public/icons/icon-maskable-512.png` | 512×512 | Maskable icon (Android adaptive) | `#2d6a3e` (bgForest) with full-bleed (no transparency) |
| `public/icons/apple-touch-icon.png` | 180×180 | iOS home-screen icon (referenced from `index.html`) | `#2d6a3e` (bgForest) |

**Why these exact paths**: each is already declared in either `vite.config.ts`'s manifest block (the first three) or `index.html`'s `<link rel="apple-touch-icon">` (the fourth). Today they 404 in the local build. FR-011 / FR-023 require every manifest-declared path to return 200; FR-008 / FR-009 / FR-010 require installability checks to pass on each target platform; Chrome's Lighthouse PWA audit fails installability on a 404'd icon.

**Generation approach**: any tool that emits PNG at exact pixel dimensions works. The maintainer's machine has Node.js installed; a one-shot Node script using `sharp` or `node-canvas` (devDependency, install-and-uninstall) generates correct files in seconds. Alternatively the Azure CLI / `magick` / a one-off Aseprite export are all acceptable. **The tool used is a tasks.md decision, not a plan decision** — what matters here is that the output is correct pixels and correct format.

**Why solid color, not a logo glyph**:

- Quality threshold: installability checks evaluate dimensions, format, and "the file is a valid image"; visual quality is not checked. Solid color is the minimum sufficient.
- Constitution Principle I: a "carrot" or similar glyph at placeholder fidelity risks looking like a specific copyrighted character at thumbnail size. Solid fill removes that risk entirely.
- Constitution Principle XI: the real art lands in 001's T052 by overwriting these files at the same paths. Solid placeholders make the diff visually obvious in the eventual T052 PR.

**Alternatives considered**:

- **A simple text glyph (e.g., "CC" in a corner)** — small benefit (slightly less anonymous), small risk (font licensing, accidental resemblance). Not worth the cycles to vet.
- **Use Kenney CC0 placeholder icons** — none of his packs include exactly-sized PWA icon sets; would require post-processing anyway.

**Rejected because**: a flat fill is the minimum that clears every installability check, the minimum that complies with Principle I, and the minimum that signals "placeholder" to a reviewer at a glance.

## Q8: Fallback if SWA Free is unavailable in both `westus2` and `centralus`

**Decision documented for completeness** (see Q1 decision tree): re-open the region question against Azure's current Free-region list before silently picking a third option. Do not switch SKU. Do not silently provision in a Geographically-distant region.

If both fail simultaneously (highly unlikely; would indicate a wide regional outage or a SKU policy change), the correct response is to *stop and journal the surprise* rather than route around it. Re-attempt after Azure status returns to green.

**Alternatives considered**: silently provisioning in `eastus2` (next-closest Free region) — rejected because a silent change to a fundamental infrastructure parameter is exactly the kind of thing Principle XII's spec-first discipline exists to prevent. A two-line edit to plan.md and a journal entry costs nothing and keeps the record clean.

**Rejected because**: silent geographic drift in a documented infra spec is worse than a brief pause.
