# Tasks: Shipping Infrastructure

**Input**: Design documents from `/specs/002-shipping-infrastructure/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/swa-deployment.md](./contracts/swa-deployment.md), [quickstart.md](./quickstart.md)

**Tests**: **Manual playtest-style verification only.** This feature introduces no new pure TypeScript logic, so there is nothing for Vitest to assert. Per Constitution Principle VI ("mechanical tests for mechanical code; human tests for human-observable outcomes") the per–user-story verification below is a checklist of real-browser / real-device observations against the deployed URL. No new unit tests, no new integration tests, no extension of the coverage budget.

**Organization**: Tasks are grouped by phase first (provisioning → workflow → repo config), then by user story (the manual playtests in Phase 4 map 1:1 to spec US1–US4). Numbering starts at **T101** to keep IDs globally unique against the 001 slice's T001–T065.

## Format: `[ID] [P?] [Tag] Description`

- **[P]**: Can run in parallel (different files, no in-flight dependency on another task)
- **[Tag]**: One of `[PROV]` (provisioning), `[WORKFLOW]` (auto-generated workflow file), `[REPO]` (committed repo artifacts), `[US1]`/`[US2]`/`[US3]`/`[US4]` (per-story playtest), `[DOCS]` (documentation), `[FOLLOWUP]` (cross-spec downstream edit)
- **Execution mode** (called out in each task body):
  - `Mode: agent` — executable autonomously by the agent using `az` / `gh` / `git` / file edits already-authorized by the maintainer
  - `Mode: portal` — requires the maintainer at the Azure portal UI (this feature has exactly **one** such task: T103)
  - `Mode: device` — requires real-device or specific-browser interaction the agent cannot perform
- File paths shown are exact and match [plan.md](./plan.md#project-structure)

---

## Phase 1: Provisioning (Azure resource creation)

**Purpose**: Stand up the SWA resource and the GitHub deployment-token secret. After this phase the production URL exists; no other phase can reference a live URL until this phase completes.

- [ ] **T101 [PROV]** Confirm Azure CLI session targets the intended subscription. Run `az account show --query "{name:name, id:id, tenantId:tenantId, user:user.name}" -o table` and confirm the active subscription is the maintainer's Visual Studio Enterprise subscription. Do NOT print or commit the IDs anywhere (Constitution Principle XII / FR-022). 
  - **Why**: every subsequent `az` call in Phase 1 inherits this context; getting it wrong silently provisions into the wrong subscription.
  - **Mode**: agent

- [ ] **T102 [PROV]** Ensure resource group `rg-carrot-code` exists in `westus2`. Run `az group create --name rg-carrot-code --location westus2` (idempotent — succeeds if the group already exists).
  - **Why**: the SWA resource must live in a known RG; convention from [spec.md](./spec.md#assumptions). RG creation via CLI is fully agent-executable.
  - **Mode**: agent

- [ ] **T103 [PROV] [PORTAL-REQUIRED]** Create the SWA resource via the **Azure portal's GitHub-connect flow** following [quickstart.md §0](./quickstart.md#0-the-one-bit-that-requires-the-azure-portal): Static Web Apps → Create → subscription = (active), RG = `rg-carrot-code`, name = `carrot-code` (fall back to `carrot-code-swa` if globally taken), Plan = Free, Region = `westus2` (fall back to `centralus` per [research.md Q1](./research.md#q1-region--why-westus2-and-whats-the-fallback) decision tree — **do NOT use `westus3`, do NOT switch SKU to Standard**), Deployment source = GitHub, Org = `jasaimial`, Repo = `carrot-code`, Branch = `001-vertical-slice`, Build Preset = Custom, App location = `/`, Api location = (empty), Output location = `dist`.
  - **Why**: this is the ONLY step in the entire feature that cannot be done from CLI. The portal flow triggers a GitHub OAuth handshake that (a) auto-installs a deploy workflow file at `.github/workflows/azure-static-web-apps-<random>.yml` on the configured branch and (b) auto-creates a GitHub repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM>` with the deployment token as its value. The token value never reaches the maintainer's screen and never enters the repo (FR-022). The CLI command `az staticwebapp create --source <repo>` does NOT install the deploy workflow nor wire up the secret — confirmed in [research.md Q6](./research.md#q6-github-actions-workflow--what-does-azure-auto-generate-and-what-do-we-adjust).
  - **Mode**: portal

- [ ] **T104 [PROV]** After T103 returns, capture the public host name and verify the GitHub secret landed. Run `az staticwebapp show --name <swa-name> --resource-group rg-carrot-code --query "{defaultHostname:defaultHostname, repositoryUrl:repositoryUrl, branch:branch}" -o table` and `gh secret list --repo jasaimial/carrot-code | Select-String AZURE_STATIC_WEB_APPS_API_TOKEN`. Record the `defaultHostname` value (the production URL) in the session journal — DO NOT commit any subscription/tenant/resource IDs.
  - **Why**: T119/T120 will paste this URL into `README.md` and `HANDOVER.md`; the secret-list confirms FR-021 is satisfied (secret exists in GitHub with the Azure-convention name).
  - **Mode**: agent

**Checkpoint**: The SWA resource exists in `rg-carrot-code/westus2` (or `centralus`); the production URL is known; the GitHub secret `AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM>` exists; Azure has committed the auto-generated workflow file to `001-vertical-slice` and started a first run (which may or may not be green — addressed in Phase 2).

---

## Phase 2: Workflow integration (review and lock down the auto-generated workflow)

**Purpose**: Treat the Azure-auto-generated workflow file as the source of truth (FR-017). Review it for the five defaults that matter (FR-016), commit any adjustments, and confirm the deploy succeeds.

> **Branch note**: Azure committed the workflow to `001-vertical-slice` (per T103 configuration). The agent fetches and edits on `001-vertical-slice` directly. The 002-shipping-infrastructure branch does NOT carry the workflow file edits — it inherits them when 002 eventually merges into 001-vertical-slice (or whichever branch is current at merge time).

- [ ] **T105 [WORKFLOW]** Fetch the auto-generated workflow file from `001-vertical-slice`. `git fetch origin && git checkout 001-vertical-slice && git pull`. Open `.github/workflows/azure-static-web-apps-*.yml` (whatever random suffix Azure assigned). Record the assigned filename in the session journal so subsequent tasks reference it consistently.
  - **Why**: the file is committed by Azure directly to the configured production branch; the agent must work on that branch (not 002) to review and edit it.
  - **Mode**: agent

- [ ] **T106 [WORKFLOW]** Review and adjust the five fields per [research.md Q6](./research.md#q6-github-actions-workflow--what-does-azure-auto-generate-and-what-do-we-adjust) and [contracts/swa-deployment.md "Manual edits we expect to make"](./contracts/swa-deployment.md#manual-edits-we-expect-to-make-to-the-auto-generated-workflow): (1) `node-version: 20` (edit if Azure chose otherwise — matches existing `ci.yml`), (2) `app_location: "/"` (confirm default), (3) `api_location: ""` (confirm default), (4) `output_location: "dist"` (edit if missing/wrong — most likely required), (5) `skip_app_build` absent or `false` (confirm default). Also confirm `on.push.branches` and `on.pull_request.branches` reference `001-vertical-slice`. File: `.github/workflows/azure-static-web-apps-<random>.yml` on branch `001-vertical-slice`.
  - **Why**: FR-016 — workflow is reviewed for sensible defaults before its first relied-on run.
  - **Mode**: agent

- [ ] **T107 [WORKFLOW]** Commit the workflow edits (if any) on `001-vertical-slice` with a message naming the field(s) adjusted (e.g., `ci(swa): pin node-version to 20, set output_location to dist`). Push. Watch the workflow re-run in the GitHub Actions tab; confirm it ends green and the production URL (T104) now serves a Vite build (not the SWA placeholder page).
  - **Why**: FR-001, FR-003, SC-001 — proves the production pipeline actually works end-to-end before any docs reference it.
  - **Mode**: agent (commit/push); device (browse to URL to confirm — any modern desktop browser will do)

**Checkpoint**: The production URL serves the current `001-vertical-slice` build. The deploy workflow is green and committed. Phase 4 playtests can now be exercised.

---

## Phase 3: Repo config (staticwebapp.config.json + placeholder icons + netlify.toml note)

**Purpose**: Author the SWA-side configuration that mirrors the existing Netlify policy (SPA fallback + immutable cache headers) and resolve the manifest's 404'd icon paths. All edits land on the `002-shipping-infrastructure` branch; they appear first on the **per-branch preview URL** generated for this branch (US3 verification), and reach production when this branch merges into the production branch.

- [ ] **T108 [P] [REPO]** Author `staticwebapp.config.json` at the repo root, matching the annotated reference in [data-model.md](./data-model.md#staticwebappconfigjson--annotated-reference): `navigationFallback.rewrite = "/index.html"`, the exact `exclude` list (`/assets/*`, `/icons/*`, `/favicon.svg`, `/favicon.ico`, `/manifest.webmanifest`, `/sw.js`, `/workbox-*.js`, `/registerSW.js`, `/robots.txt`), and `routes[]` entries for `/assets/*` (immutable 1-year cache), `/sw.js` (no-cache + `Service-Worker-Allowed: /`), and `/manifest.webmanifest` (10-minute cache + explicit content-type). Empty `mimeTypes: {}`. File: `staticwebapp.config.json`.
  - **Why**: FR-018 / FR-019 — SPA deep links don't 404; hashed Vite assets cache for a year; service worker is never aggressively cached.
  - **Mode**: agent

- [ ] **T109 [P] [REPO]** Author `scripts/generate-placeholder-icons.mjs` — a self-contained Node script using ONLY built-in modules (`zlib`, `fs`, `path`, `node:buffer`) that emits a valid PNG of arbitrary solid color at arbitrary pixel dimensions. The script accepts no arguments; it writes four files at the paths declared by [vite.config.ts](../../vite.config.ts) and [index.html](../../index.html): `public/icons/icon-192.png` (192×192), `public/icons/icon-512.png` (512×512), `public/icons/icon-maskable-512.png` (512×512, full-bleed — same data as `icon-512.png` is acceptable because solid color is full-bleed by definition), `public/icons/apple-touch-icon.png` (180×180). All four use color `#2d6a3e` (matches `PALETTE_HEX.bgForest`). Header comment in the script: "One-off generator. Run with `node scripts/generate-placeholder-icons.mjs`. NOT wired into package.json. Re-run only when you intentionally want to overwrite the placeholders." File: `scripts/generate-placeholder-icons.mjs`.
  - **Why**: [research.md Q7](./research.md#q7-pwa-icons--generation-strategy-for-placeholders) decision is "solid-color flat fill at exact pixel dimensions." Constraint from the user-supplied context for this feature: **no new npm dependencies, no new package.json scripts.** A hand-rolled PNG-encoder using `zlib` is ~50 lines and ships zero transitive dependencies. The committed PNG outputs (T110) are the artifact; the script is documentation of how they were produced and a regen path if the colour ever changes.
  - **Mode**: agent

- [ ] **T110 [REPO]** Run the generator and commit the produced PNGs. `node scripts/generate-placeholder-icons.mjs`. Verify the four files exist at the correct paths with correct dimensions (`file public/icons/*.png` or open one in an image viewer). `git add public/icons/icon-192.png public/icons/icon-512.png public/icons/icon-maskable-512.png public/icons/apple-touch-icon.png scripts/generate-placeholder-icons.mjs`. (Depends on T109.) Files: `public/icons/*.png`.
  - **Why**: FR-011 / FR-023 — every manifest-declared icon path must return 200 on the deployed build, else Chrome/Lighthouse installability fails.
  - **Mode**: agent

- [ ] **T111 [REPO]** Local build verification: `npm ci && npm run build && npm run preview`. Open <http://localhost:4173> in a desktop Chromium browser. DevTools → Application → Manifest: confirm the four icon paths resolve (no red 404 indicators, no missing-asset warnings). DevTools → Lighthouse → PWA audit: confirm no "icon not provided" warnings. (Depends on T108 + T110.)
  - **Why**: catches a malformed `staticwebapp.config.json` (Vite preview doesn't honour it but the manifest/icon checks DO run against the built `dist/`) and a bad PNG header BEFORE pushing — turning a slow CI cycle into a fast local one.
  - **Mode**: agent (build) + device (browser, but localhost on the maintainer's own machine counts — no external device required)

- [ ] **T112 [P] [REPO]** Add a top-of-file comment block to `netlify.toml` per FR-020: `# NOTE (2026-05): This project deploys via Azure Static Web Apps.` + `# See .github/workflows/azure-static-web-apps-*.yml and ./staticwebapp.config.json.` + `# This file is retained for reference only; Netlify is not invoked by any current pipeline.` File: `netlify.toml`.
  - **Why**: FR-020 — `netlify.toml` is retained (removal is out of scope) but must not mislead a future reader into thinking Netlify is the active deploy target.
  - **Mode**: agent

- [ ] **T113 [REPO]** Commit + push the Phase-3 artifacts on `002-shipping-infrastructure`. Suggested commit message: `feat(swa): add staticwebapp.config.json, placeholder PWA icons, and netlify.toml reference comment`. Watch the per-branch preview workflow run from the GitHub Actions tab; confirm it ends green and emits a preview URL distinct from production.
  - **Why**: this push is itself the trigger that exercises FR-005 (per-branch preview) for the first time, which is the US3 acceptance criterion.
  - **Mode**: agent (commit/push) + device (browser to read the Actions log / open the preview URL — maintainer's own desktop is sufficient)

- [ ] **T114 [REPO]** Open the preview URL from T113 in a desktop Chromium browser. DevTools → Application → Manifest: confirm no 404s on the four icon paths. DevTools → Network: confirm `/assets/<hash>.js` responses include `Cache-Control: public, max-age=31536000, immutable` and `/sw.js` includes `Cache-Control: public, max-age=0, must-revalidate`. Navigate to a deep path (e.g., `/some-spa-route-that-doesnt-exist`) and confirm SWA serves `/index.html` content (status 200, page renders the app shell) rather than the default SWA 404 page.
  - **Why**: FR-018 + FR-019 + FR-011 are all verified end-to-end on a real CDN-served URL; localhost preview doesn't exercise SWA's response pipeline.
  - **Mode**: device (desktop Chromium with DevTools — maintainer's own machine)

**Checkpoint**: The per-branch preview URL serves the 002-shipping-infrastructure build with correct SPA fallback, correct cache headers, and no manifest 404s. Production URL still serves the 001-vertical-slice build (without the Phase-3 artifacts) — those reach production only when 002 merges into the production branch. That merge is a separate event, not a task here.

---

## Phase 4: Manual playtest verification (per user story)

**Purpose**: Per Constitution Principle VI, exercise each spec user story end-to-end against a real URL. These are NOT automated tests; each is a human-driven checklist that the maintainer signs off in the session journal or in this file (check the box) once observed.

> **Targeting**: US1 + US3 + US4 are exercised against whichever URL has the Phase-3 artifacts in scope at the time of testing (preview URL during 002-branch life; production URL after merge). US2 (PWA install) is most meaningful against the production URL because that's the URL real playtesters will be sent. Note in the journal which URL each playtest used.

- [ ] **T115 [US1]** Playtest: **maintainer can share a working URL** (spec US1 / FR-001 / FR-002 / FR-003 / SC-001). Checklist: (a) open the URL in a fresh browser profile or incognito window with no logged-in identity, confirm the game's current entry rendering loads with no setup; (b) push a trivial commit to the configured production branch (e.g., a comment-only edit to `README.md`); (c) measure wall-clock from push completion to URL reflecting the change — must be ≤ 5 minutes; (d) repeat (b)+(c) on a second independent push to satisfy SC-001's "measured at least twice" clause; (e) ask a non-technical person (or simulate by texting yourself the URL on a different device) and confirm they reach the entry rendering with no instructions other than the URL.
  - **Why**: SC-001 (push-to-live ≤ 5 min, twice) and SC-002 (10-second-to-render for a first-time visitor) are the headline measurable outcomes for this feature.
  - **Mode**: device (any modern browser; second device or incognito profile required for the "fresh visitor" simulation)

- [ ] **T116 [US2]** Playtest: **PWA installs from a real URL** (spec US2 / FR-008 / FR-009 / FR-010 / FR-011 / SC-003). Three independent runs, one per target platform:
  - **iOS Safari**: visit the URL → Share → "Add to Home Screen" → tap the new home-screen icon → confirm the game opens with no Safari address bar and no bottom toolbar (standalone mode), placeholder-color icon visible on home screen.
  - **Android Chrome**: visit the URL → trigger install via the organic install banner OR menu → "Install app" → tap the new icon → confirm standalone window, placeholder-color icon in the app drawer.
  - **Desktop Chromium (Chrome or Edge)**: visit the URL → click the URL-bar install icon OR menu → "Install Carrot Code" → confirm the game opens in a dedicated standalone window with custom icon. Then run Lighthouse → PWA audit against the URL: confirm zero installability warnings and zero missing-icon warnings (FR-011 verification).
  - **Why**: SC-003 cannot be satisfied without all three; localhost cannot exercise iOS "Add to Home Screen" or Lighthouse's HTTPS-only PWA checks. This is the playtest the entire feature exists to enable.
  - **Mode**: device (three physical/virtual devices: an iPhone or iPad running modern Safari, an Android device with Chrome, and a desktop with Chrome or Edge)

- [ ] **T117 [US3]** Playtest: **per-branch deploy previews** (spec US3 / FR-005 / FR-006 / FR-007 / SC-005). Checklist: (a) confirm the most recent push to `002-shipping-infrastructure` (T113) produced a unique preview URL distinct from production — observable in the GitHub Actions run summary for that push and/or in the SWA portal → Environments view; (b) open the preview URL, confirm it serves the 002-branch HEAD (the build with `staticwebapp.config.json` and placeholder icons), distinct from production (which at this point still serves the 001 HEAD); (c) on a throwaway branch (`git checkout -b preview-test-throwaway && git commit --allow-empty -m "preview test" && git push -u origin preview-test-throwaway`), confirm a NEW preview URL is generated, distinct from both production and the 002 preview; (d) `git push origin --delete preview-test-throwaway` and confirm the SWA portal → Environments view shows the entry disappear within ~5 minutes (FR-007 cleanup verification).
  - **Why**: SC-005 requires at least one non-default branch end-to-end; the throwaway-branch step in (c)+(d) also exercises FR-007's preview cleanup.
  - **Mode**: agent (push/delete branches via `git`) + device (browser to open preview URLs and inspect the SWA Environments view)

- [ ] **T118 [US4]** Playtest: **service worker works offline** (spec US4 / FR-012 / FR-013 / FR-014 / SC-004). Checklist on desktop Chromium: (a) open the URL with network enabled, wait for BootScene to render, then open DevTools → Application → Service Workers → confirm a service worker is shown as "activated and is running" with a non-empty precache; (b) DevTools → Network → throttle dropdown → "Offline" → reload (Ctrl+R) → confirm the BootScene re-renders within 3 seconds (SC-004) and no user-visible failed-network errors appear; (c) optional but valuable: on a real device after completing T116, put the device in airplane mode and re-launch the installed PWA from its home-screen / app-drawer icon → confirm it reaches the same entry rendering as an online launch (FR-013).
  - **Why**: SC-004's 3-second offline-reload target and FR-013's airplane-mode-launch behaviour are both unobservable on localhost; they require the SWA-served URL to verify the service worker is registering against the actual origin.
  - **Mode**: device (desktop Chromium DevTools; optionally a real iOS or Android device for the airplane-mode launch)

**Checkpoint**: All four spec user stories have been exercised on a real URL. SC-001 through SC-005 measurements have been recorded. The feature meets the spec's definition of "shipped" once T119 + T120 + T122 land in addition (the docs + journal close out FR-024 / FR-025 / Constitution II.6).

---

## Phase 5: Docs, follow-ups, and journal

**Purpose**: Make the live URL discoverable per FR-024 / FR-025, record the downstream change required in the 001 slice's tasks.md, and journal the rollout per Constitution II.6.

> **Dependency**: T119 + T120 reference the live production URL. They **MUST NOT** be authored until Phase 1 is complete (the URL doesn't exist before T103/T104) and SHOULD wait until at least T115 has confirmed the URL serves correctly (no point committing a URL into `README.md` that turns out to 404). Authoring is fine on `002-shipping-infrastructure` before that branch merges; what matters is that the URL value is known and verified.

- [ ] **T119 [DOCS]** Update `README.md` to display the live production URL prominently. Add a "Live demo" section at the top of the file (above any existing content beyond the project title): a single line of the form `[Play the latest build](https://<the-actual-default-hostname>)` (no badge service required — a plain link is fine; if a Shields.io-style "deployed" badge is desired in future, that's a separate edit). File: `README.md`.
  - **Why**: FR-024 / SC-007 — a fresh reader opening `README.md` for the first time finds the live URL within 10 seconds.
  - **Mode**: agent
  - **Depends on**: T104 (URL known) + T115 (URL verified to serve correctly)

- [ ] **T120 [DOCS]** Update `docs/learning/HANDOVER.md`'s TL;DR section to include the live production URL. Recommended placement: as the first bullet under "Current state" or equivalent, of the form `- **Live build**: <https://...>` so a returning agent or collaborator picking up the project sees it immediately. File: `docs/learning/HANDOVER.md`.
  - **Why**: FR-025 / SC-007 — the same discoverability requirement as T119, but for the agent/collaborator handover path.
  - **Mode**: agent
  - **Depends on**: T104 + T115

- [ ] **T121 [FOLLOWUP]** Author a downstream-coupling edit to `specs/001-vertical-slice/tasks.md` task **T058**. Current T058 reads: *"Push branch to GitHub remote, configure branch protection on `main` (require CI green, require PR review with self-review acceptable for solo work) per Constitution Principle VIII. Connect Netlify to the repo, configure auto-deploy from `main`, record the public URL in repo `README.md`."* Reduce it to a no-op-style follow-up that reflects the post-002 reality: *"Push branch (done — see [docs/learning/journal/](../../docs/learning/journal/)). Branch protection on `main` (done — required check `typecheck / lint / test / build`). Public URL recorded in `README.md` by `002-shipping-infrastructure`. When this slice merges to `main`, in the same PR: (a) update `.github/workflows/azure-static-web-apps-*.yml` to change every `001-vertical-slice` reference under `on.push.branches` / `on.pull_request.branches` to `main`; (b) run `az staticwebapp update --name <swa-name> --resource-group rg-carrot-code --branch main` to update the SWA production-branch setting; (c) confirm the next push to `main` triggers a production deploy."* File: `specs/001-vertical-slice/tasks.md`.
  - **Why**: The user-supplied context for this feature explicitly flags this coupling. The edit lands on `002-shipping-infrastructure` so it travels with the merge that actually changes what T058 means; once that merge happens, the 001 task list is consistent again. (If the maintainer prefers to land this T058 edit on the 001 branch directly via cherry-pick, that's also fine — the wording is the same either way.)
  - **Mode**: agent

- [ ] **T122 [DOCS]** Author a journal entry under `docs/learning/journal/` (filename: `YYYY-MM-DD-shipping-infrastructure.md` per existing convention) covering: (a) what shipped in this feature (one paragraph); (b) the one portal-required step (T103) and why no CLI equivalent exists; (c) any surprises during T106 workflow review (which of the five fields actually needed editing); (d) the per-US playtest results from Phase 4 with the URL each playtest used; (e) the downstream T058 coupling and the merge sequence required to flip production from `001-vertical-slice` to `main`. Apply public-repo hygiene per Constitution Principle XII: no real names, no email, no subscription/tenant IDs, no token values. File: `docs/learning/journal/YYYY-MM-DD-shipping-infrastructure.md` (substitute the actual date on commit day).
  - **Why**: Constitution II.6 / journal-entry discipline. Future-self and any collaborator pick up the project from this entry plus HANDOVER.md.
  - **Mode**: agent

**Checkpoint**: The live URL is discoverable from both `README.md` and `HANDOVER.md`. The 001 slice's T058 is updated to reflect post-shipping-infrastructure reality. The session is journaled. **Spec is shipped.**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Provisioning)** has no prior dependencies and must complete first. T101 → T102 → T103 → T104 strictly sequential (each depends on the previous).
- **Phase 2 (Workflow integration)** depends on T103/T104 (the workflow file exists only after the portal connect). T105 → T106 → T107 strictly sequential.
- **Phase 3 (Repo config)** depends on Phase 1 (so the SWA exists to deploy to and produce previews) but is otherwise independent of Phase 2 — staticwebapp.config.json and icons can be authored before the workflow is reviewed. In practice, do Phase 2 first so the first deploy is clean.
- **Phase 4 (Playtests)** depends on Phase 1 + Phase 2 (so a green production deploy exists) and Phase 3 (so the artifacts being verified are actually on the URL being tested — for the preview-URL path that's the 002-branch preview, for the production-URL path that's after 002 merges into the production branch).
- **Phase 5 (Docs + follow-up + journal)** depends on Phase 1 (T104 — URL known) and Phase 4 (T115 minimum — URL verified). T121 and T122 are independent of T119/T120 and can be authored in parallel with them.

### Hard sequencing rule

**Do not push docs edits that reference the live URL until after the first successful production deploy.** The URL does not exist before T103. The URL is not proven to serve correctly until T115. Authoring `README.md` and `HANDOVER.md` with a not-yet-working URL would (a) embarrass the project per Principle XII and (b) require a fix-up commit if T115 surfaces a problem.

### Within each task

- All edits are single-file or a tightly scoped multi-file change; no test-first discipline required (Phase 4 IS the testing, and it's manual).
- Each commit's message should name the artifact(s) edited, in the same form as 001's commit history.

### Parallel Opportunities

- **Within Phase 3**: T108 (staticwebapp.config.json), T109 (icon-generator script), and T112 (netlify.toml comment) touch independent files and can be authored in parallel. T110 depends on T109 (must run the script to produce its outputs); T111 depends on T108 + T110; T113 depends on T108 + T110 + T112 (single commit, single push); T114 depends on T113.
- **Within Phase 4**: T115, T116, T117, T118 each exercise different acceptance criteria and could in principle be scheduled in parallel by a small testing pool. For solo work they're sequential, but the device requirements vary — T115 needs one browser, T116 needs three platforms, T117 needs a desktop browser + branch-push capability, T118 needs desktop DevTools.
- **Within Phase 5**: T119, T120, T121, T122 all touch independent files (README.md, HANDOVER.md, specs/001-vertical-slice/tasks.md, docs/learning/journal/YYYY-MM-DD-shipping-infrastructure.md) and are fully parallel.
- **Across phases**: T112 (netlify.toml comment) is genuinely independent of everything in Phase 1 and Phase 2 — it could be authored and committed at any point, though batching it with T108/T110 into a single Phase-3 commit is cleaner.

Parallel-eligible task count: **6** (T108, T109, T112, T119, T120, T121, T122 — though T119/T120 jointly depend on T104+T115).

### Execution-mode breakdown

| Mode | Task count | Tasks |
|---|---|---|
| agent (no human-at-portal, no device beyond maintainer's own machine) | 16 | T101, T102, T104, T105, T106, T107 (commit half), T108, T109, T110, T111 (build half), T112, T113 (commit half), T119, T120, T121, T122 |
| portal (Azure portal UI required) | 1 | **T103** |
| device (real device or specific browser required for verification) | 5 | T107 (verify half), T111 (browser half), T113 (browser half), T114, T115, T116, T117, T118 |

(Several tasks have both an agent and a device component — counted in both rows above where applicable; total tasks is **22**.)

---

## Implementation Strategy

### Recommended order

1. **Provisioning** (T101 → T102 → T103 → T104). T103 is the one moment that requires the maintainer at the Azure portal; the agent can't fill it in. Block the work session on getting through T103 first.
2. **Workflow integration** (T105 → T106 → T107). Quick review and at most one or two field edits; one commit, one push, one workflow re-run. Until T107 is green, no other phase can be verified against production.
3. **Repo files** (T108 + T109 in parallel → T110 → T111 → T112 → T113 → T114). All on the `002-shipping-infrastructure` branch. T114 is the moment SWA's actual response headers are verified — don't skip it just because local preview was clean.
4. **First deploy verification** (already covered by T107 + T114 individually).
5. **Manual playtests** (T115 → T116 → T117 → T118, in priority order P1 → P2 → P3 → P4). T116 in particular needs three devices; schedule it when those are available.
6. **Docs + follow-up + journal** (T119 + T120 + T121 + T122, fully parallel). Last because everything they reference must be true.

### Recommended "first session implementation chunk"

A single working session can comfortably cover **T101 → T114** (provisioning + workflow review + all Phase-3 artifacts authored, committed, pushed, and verified on the per-branch preview URL). This is the natural stopping point because:

- Phase 4 playtests are best done in a dedicated playtest session with the three target devices in hand (especially the iOS + Android arms of T116).
- Phase 5 docs depend on Phase 4 results, so committing them before playtests would be premature.
- Stopping at T114 leaves the maintainer with a verified preview URL and a clean `002-shipping-infrastructure` branch ready for the playtest session.

After that session, T115–T118 happen in a playtest session (possibly across two days if the iOS/Android devices aren't both available the same day), and T119–T122 close out the feature in a final docs-and-journal session.

### Solo + agent strategy

- The agent drives T101, T102, T104–T114, T119–T122 autonomously using `az`, `gh`, `git`, and file edits.
- The maintainer drives T103 at the Azure portal (one task, one session).
- The maintainer drives T115–T118 on the relevant devices (the agent can prepare the test scripts in plain English in the journal but cannot click "Add to Home Screen" on an iPhone).

---

## Notes

- `[P]` = different files, no in-flight dependencies.
- `[Tag]` distinguishes provisioning / workflow / repo / per-US-playtest / docs / cross-spec follow-up; this differs from 001's `[SETUP]`/`[FND]`/`[POLISH]` set because the phase shape of an infrastructure feature is different from a code feature.
- No new npm dependencies. No new `package.json` scripts. The icon-generator script in T109 is invoked manually and lives under `scripts/` exactly to keep this promise.
- No automated tests are added by this feature. The Phase-4 playtests are the test layer, per Constitution Principle VI for human-observable infrastructure outcomes.
- Constitution Principle XII applies to every committed artifact in this feature: no subscription/tenant/resource IDs, no token values, no real names beyond the maintainer's GitHub handle, no internal corporate identifiers. The session journal (T122) follows the same rules.
- The downstream T058 edit (T121) is the only cross-spec change; everything else is contained within `002-shipping-infrastructure`.
