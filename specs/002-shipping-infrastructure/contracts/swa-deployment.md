# Contract: SWA Deployment Workflow

The auto-generated GitHub Actions workflow at `.github/workflows/azure-static-web-apps-<random>.yml` is the boundary between this repository and the Azure Static Web Apps deploy pipeline. This document is the source of truth for what the workflow expects, what it produces, and what its failure modes look like.

When the workflow's behaviour changes (e.g., a Node version bump, a switch to OIDC, a custom build step), this contract is updated in the same PR.

## What the workflow expects

### Repository layout

| Path | Purpose | Required by | Failure if missing |
|---|---|---|---|
| `package.json` at the repo root | The SWA Action runs `npm ci && npm run build` from this directory. | `app_location: "/"` in the workflow. | Deploy fails: `npm ERR! enoent ENOENT: no such file or directory, open '/github/workspace/package.json'` in the build log. |
| `package-lock.json` at the repo root | `npm ci` requires it (strictly). | Same. | Deploy fails: `npm ERR! The npm ci command can only install with an existing package-lock.json`. |
| `npm run build` exits 0 and emits to `dist/` | The SWA Action looks for `output_location` (set to `dist`). | The auto-generated workflow's `output_location: "dist"`. | Deploy fails: `Could not find a valid output location at /github/workspace/dist`. |
| `staticwebapp.config.json` at the repo root | Optional but expected; without it SWA uses default behaviour and SPA fallback breaks. | FR-018 / FR-019. | Build succeeds but deploy ships without SPA fallback / cache headers — silent UX regression, not a hard failure. **Catch in code review, not at deploy time.** |
| `index.html` at the repo root (Vite consumes it) | Vite's entry HTML; not directly consumed by SWA but required for the build to produce a deployable artifact. | Vite itself. | Build fails before SWA sees the output. |

### GitHub repository secret

| Secret name | Set by | Value type | Used in workflow as |
|---|---|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM>` | Azure portal during the GitHub-connect flow (one-time UI step). The `<RANDOM>` suffix matches the SWA resource's identifier. | Opaque deployment token issued by SWA. Maintainer never sees the value. | `azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM> }}` |

The token value MUST NOT appear in any committed file. The secret *name* may appear in the workflow YAML (this is how every SWA workflow on the internet looks — referencing a GitHub secret by name is the standard pattern and does not leak the value).

If the token is ever rotated (manually via Azure portal → SWA → "Manage deployment token" → "Reset"), the GitHub secret must be updated to the new value in the same session. The workflow file does not change.

### Branch triggers

The workflow's `on.push.branches` and `on.pull_request.branches` lists drive which branches trigger which environments.

| Branch matches `on.push.branches` (production list) | → | Behaviour |
|---|---|---|
| Yes (today: `001-vertical-slice`; after slice merge: `main`) | → | Build runs; output replaces the production URL. |
| No (any other branch) | → | Build runs; output is published as a **preview environment** with a unique URL; SWA Action posts the preview URL as a bot comment on any open PR for that branch. |
| Push to deleted branch (branch was deleted between commit and CI dispatch) | → | Workflow does not run (GitHub aborts the dispatch). No deploy. |

When the production branch transitions from `001-vertical-slice` to `main` (after the slice merges), the workflow's branch trigger lists are updated in the same commit/PR. The SWA resource's `production-branch` setting is updated via `az staticwebapp update --branch main` in the same change.

## What the workflow produces

### On a successful production-branch push

| Output | Where to observe |
|---|---|
| A passing workflow run, green check on the commit. | GitHub → Actions tab, and the commit's status section. |
| The production URL (`https://<app-name>-<random>.<region>.azurestaticapps.net`) now serves the committed HEAD. | Browser; `curl -I` of the URL shows current `Last-Modified` or content matching the deployed commit. |
| (No effect on the existing `ci.yml` workflow's status check; both run independently per push.) | GitHub Actions tab shows both workflow runs. |

**SC-001**: time from push completion to production URL serving the new build is under 5 minutes under normal conditions.

### On a successful non-default-branch push

| Output | Where to observe |
|---|---|
| A passing workflow run, green check on the commit. | GitHub → Actions tab. |
| A unique preview URL distinct from production. | (a) The workflow run summary in the Actions tab; (b) a bot comment on any open PR for the branch; (c) the SWA resource's "Environments" view in the Azure portal. |
| The preview URL serves the branch's HEAD, independent of production. | Browser; preview URL is in the form `<app-name>-<random>.<env-name>.<region>.azurestaticapps.net` where `<env-name>` is the sanitised branch name. |

**FR-005 / FR-006 / SC-005**: per-branch preview verified end-to-end at least once.

### On a non-default-branch deletion or PR close

| Output | Where to observe |
|---|---|
| Within minutes, the preview environment is destroyed. | SWA portal → Environments shows the entry has disappeared; preview URL begins returning a SWA "environment not found" response. |

**FR-007**: no manual cleanup of stale previews required.

## Failure modes (taxonomy)

Failures group into three categories. Each presents distinctly in the workflow run log; correct response varies.

### Category A: build failure (problem is in our code)

**Symptoms**: the `Build And Deploy` step's log shows a non-zero exit from `npm run build` (Vite error, TypeScript error, ESLint error if the build script gates on it). The workflow run is red. No deploy attempted.

**Examples**:

- A new TypeScript file with `strict: true` violations.
- A missing import path.
- An asset reference that resolves locally but not in CI (e.g., case-sensitivity on Linux that Windows tolerated).

**Correct response**: fix the code on a branch, push, re-run. Same protocol as a `ci.yml` failure. The deploy workflow is a *consumer* of the build; if the build is broken, the deploy is correctly red.

**Will it self-recover?** No. Requires a new commit.

### Category B: deploy failure (build succeeded; SWA rejected the artifact)

**Symptoms**: the `Build And Deploy` step's log shows the build succeeded (`vite build` printed its asset summary), then the SWA Action emitted an error. Common variants:

- `Could not find a valid output location at /github/workspace/<path>`: `output_location` in the workflow doesn't match the actual build output directory. **Fix**: edit the workflow's `output_location` to `dist`.
- `App size exceeds maximum allowed size of 256 MB for the Free SKU`: the build output exceeded the Free-SKU 250 MB ceiling. **Fix**: investigate what bloated the bundle (likely a stray import of a large asset). Quota is not a real concern at solo-project scale, but if hit, do not silently upgrade SKU — investigate first.
- `staticwebapp.config.json: parse error at line N`: the SPA-config file is malformed. **Fix**: validate JSON, push the fix.

**Will it self-recover?** No. Requires either a workflow edit, a config edit, or a code edit.

### Category C: auth / token failure (workflow couldn't talk to Azure)

**Symptoms**: the `Build And Deploy` step's log shows the build succeeded, then the SWA Action emitted an auth error before deploying:

- `Unauthorized: The provided deployment token is invalid or has expired.`
- `Failed to fetch deployment token: <secret name> is not set or is empty.`

**Examples**:

- The GitHub secret was renamed, deleted, or never created.
- The token was rotated in Azure but the GitHub secret wasn't updated.
- The SWA resource was deleted and a new one was created without re-running the GitHub-connect flow (which would have regenerated the secret).

**Correct response**: regenerate the deployment token in the Azure portal (SWA → Overview → "Manage deployment token" → "Reset"), then update the GitHub secret value. No workflow edit needed unless the secret was renamed.

**Will it self-recover?** No. Requires manual secret rotation.

## Non-failure but worth noting

- **An intentional in-progress feature on a branch produces a preview URL**: this is correct behaviour, but preview URLs from SWA Free are **unauthenticated and publicly discoverable**. The maintainer is responsible for not pushing known-broken or sensitive work to a branch whose preview URL would embarrass the project. Per the spec's Edge Cases: assume preview URLs are public.

- **A workflow run timing out at SWA's side** (rare, but possible during Azure regional incidents): re-run the workflow from the Actions tab once Azure status shows green. No code change required.

- **Branch protection on `main` already requires the `ci` check** (per the existing `ci.yml`). The new SWA workflow's status check is *additive* and is NOT added to branch protection's required-status-checks list by this feature. Adding the SWA workflow to required-checks would mean a transient Azure-side outage could block merges on the application code — too tight a coupling for solo-project scale. Keep them independent.

## Manual edits we expect to make to the auto-generated workflow

Per research.md Q6, the auto-generated file is reviewed for five fields before its first relied-on run:

1. `node-version` — set to `20` if Azure picked anything else.
2. `app_location` — confirm `/` (default; correct for this repo).
3. `api_location` — confirm `""` (default; correct; no Functions).
4. `output_location` — set to `dist` (the one edit most likely needed).
5. `skip_app_build` — confirm `false` (default; we want the action to invoke our build).

These edits land in the same PR that introduces the workflow file (FR-016: workflow reviewed before its first run is relied on).

If Azure ever regenerates the workflow (e.g., portal reconnection), the diff is reviewed line-by-line before commit (FR-017: workflow is source of truth; no silent overwrite).
