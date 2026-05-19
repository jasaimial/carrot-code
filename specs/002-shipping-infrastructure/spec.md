# Feature Specification: Shipping Infrastructure

**Feature Branch**: `002-shipping-infrastructure`

**Created**: 2026-05-18

**Status**: Draft

**Input**: User description: "Continuous deployment of carrot-code to a
public URL via Azure Static Web Apps (Free), with deploy previews per
branch and PWA installability/offline verification."

## User Scenarios & Testing *(mandatory)*

This spec covers the project's shipping pipeline as a deliverable in its
own right, separate from the 001 vertical-slice feature work. Per
Constitution Principle II (Spec-First, Always), the deploy concern is
not a side-effect of feature work and is not a "we'll do it at the end"
task — it is its own user-visible capability that the vertical slice
*depends on* (PWA install acceptance scenarios in 001 cannot be
exercised at all without a live HTTPS URL, since neither iOS Safari
"Add to Home Screen" nor a real service worker can be tested on
localhost).

The two specs progress in parallel. This one ships first or alongside
the slice; it does not block the slice and the slice does not block it.

Each user story below is independently demonstrable on its own.

### User Story 1 — Maintainer can share a working URL (Priority: P1)

The maintainer pushes a commit to the active development branch and,
within minutes, the resulting build is reachable at a stable public
HTTPS URL that can be shared with family or playtesters without anyone
needing to clone the repo, install Node, or run `npm run dev`.

**Why this priority**: This is the minimum value of "shipped" for a
project the maintainer wants to demo. Without P1, there is no link to
send anyone; the entire constitution's "ships from day one" principle
(Principle V) has no surface. Every other story in this spec depends
on the deploy pipeline working at all.

**Independent Test**: From a clean clone on a different machine (or a
mobile device's browser), open the production URL and confirm the
current `001-vertical-slice` build of the game renders. Push a trivial
commit (e.g., a comment-only README edit) to the active branch and
observe the deployed URL reflect the change within five minutes of the
push completing.

**Acceptance Scenarios**:

1. **Given** the maintainer has just pushed a commit to the active
   development branch, **When** the deploy pipeline finishes, **Then**
   the public production URL serves a build that includes that commit,
   reachable over HTTPS, with no authentication required.
2. **Given** any person with the URL (no GitHub account, no Azure
   account, no clone of the repo), **When** they open the URL in a
   modern browser, **Then** the current build of the game loads and
   runs without any setup on their end.
3. **Given** a push has just been observed, **When** five minutes
   elapse, **Then** either the new build is live at the URL or the
   pipeline has surfaced a visible failure (red status check on GitHub,
   failed run in the Actions tab) — never an indefinite "in progress"
   state with no signal.
4. **Given** the active development branch is `001-vertical-slice`
   today and will be `main` after the slice merges, **When** the
   default-branch reference changes, **Then** the production URL
   continues to serve whatever the configured production-branch HEAD
   is, with no manual reconfiguration required beyond updating the
   workflow's branch trigger.

---

### User Story 2 — PWA installs from a real URL (Priority: P2)

A player visits the deployed URL on a modern mobile or desktop browser
and uses the platform's standard install affordance to install the
game. The install completes, the resulting icon launches the game in
standalone mode, and the game is fully playable from the installed
launcher with no browser chrome.

**Why this priority**: Per the constitution and per FR-032 through
FR-036 in the 001 slice, installability is part of "shipped." This
capability is impossible to demonstrate on localhost: iOS Safari will
not surface "Add to Home Screen" without HTTPS, desktop Chromium's
installability requires a passing manifest served over HTTPS, and the
service worker registration only takes effect on a secure context. P2
exists in this spec because P1 (a real URL) is its precondition. (For
v0 Android Chrome is out of scope on device-availability grounds — see
Non-Goals.)

**Independent Test**: On each of the three in-scope target platforms
(iOS Safari, desktop Chromium per FR-009, desktop Firefox per FR-010
parity criterion), visit the public URL, trigger the platform-native
install flow (or, for Firefox, the manifest+SW parity check), and
confirm the game opens chromeless and is playable (where the platform
supports a literal install action).

**Acceptance Scenarios**:

1. **Given** a player on iOS Safari visits the public URL, **When**
   they tap Share → "Add to Home Screen", **Then** an icon appears on
   the home screen and tapping it opens the game in standalone mode
   with no Safari address bar or bottom toolbar visible.
2. **Given** a player on desktop Chromium-based browser visits the
   public URL, **When** they click the install icon in the URL bar
   (or use the menu's "Install app"), **Then** the game opens in a
   dedicated standalone window with a custom icon and no browser
   chrome.
3. **Given** a player on desktop Firefox visits the public URL,
   **When** they exercise Firefox's PWA support path (Add to Home
   Screen on the Android Firefox build, or the manifest-aware
   shortcut behaviour on desktop), **Then** the manifest validates
   without warnings in the about:debugging / Network panel, the
   icons resolve with 200 status, and Firefox treats the page as a
   first-class PWA candidate (Firefox's native install affordance is
   weaker than Chromium's; the test target is "manifest valid + icons
   served + offline reload works," not "installs to home screen").
4. **Given** the installed PWA is open on any platform, **When** the
   player exercises the basic game loop, **Then** the game responds
   identically to how it does in the browser tab (no missing assets,
   no broken paths, no console errors that would not also occur in
   the tab).
5. **Given** the manifest declares icons at known paths, **When** the
   page loads and any browser dev-tools "Application → Manifest" or
   "Lighthouse → PWA" check is run, **Then** no missing-icon or
   missing-asset warnings are reported.

---

### User Story 3 — Per-branch deploy previews (Priority: P3)

Every push to a non-default GitHub branch (including PR branches)
produces a unique preview URL distinct from the production URL.
Reviewers can interact with the proposed change in a real browser as
part of code review, rather than reading the diff and inferring
behaviour.

**Why this priority**: For a solo project, code review is primarily
self-review on a draft PR. Even self-review benefits enormously from
clicking a link and playing the change rather than mentally
simulating it. For the rare case where the maintainer asks a family
member or peer to look at a PR, the preview URL removes the entire
"clone the repo, install Node, run the dev server" barrier.

**Independent Test**: Push a commit on any branch other than the
production branch. Observe a preview URL surfaced either in the SWA
"Environments" view in the Azure portal or in the GitHub Actions run
log for the deploy workflow. Open the preview URL and confirm it
serves the branch's HEAD, distinct from the production URL.

**Acceptance Scenarios**:

1. **Given** a push to any non-default branch, **When** the deploy
   workflow runs, **Then** a unique preview URL is generated and
   reachable, distinct from the production URL.
2. **Given** a preview URL has been generated, **When** the
   maintainer (or a reviewer) navigates to it, **Then** they see the
   build of the specific branch HEAD, not the production build.
3. **Given** the preview URL exists, **When** the maintainer needs to
   find it, **Then** it is discoverable from at least one of: the
   GitHub Actions run summary for that push, a comment posted by the
   SWA bot on the corresponding PR (if any), or the SWA
   "Environments" view in the Azure portal.
4. **Given** a branch is deleted (or its PR is merged/closed),
   **When** the SWA preview lifecycle runs, **Then** the preview
   environment is cleaned up automatically (no permanent accumulation
   of stale preview URLs from old branches).

---

### User Story 4 — Service worker works offline (Priority: P4)

A player loads the deployed page once with network connectivity, then
disables network (airplane mode, or DevTools → Network → Offline),
reloads the page (or relaunches the installed PWA), and the game still
renders the boot scene from locally cached assets.

**Why this priority**: Offline play is FR-036 in the 001 slice and is
part of the constitution's definition of shipped. P4 is the smallest
end-to-end proof that the service worker registered, the precache
manifest is populated, and the cache strategy actually serves assets
without network — distinct from "the workbox plugin compiled cleanly."
That distinction matters because the build can succeed and produce a
non-functional service worker without anyone noticing until they try
to use it offline.

**Independent Test**: Load the production URL once with network.
Open DevTools, switch the Network tab to "Offline" (or enable airplane
mode on a device). Reload the page. Observe the BootScene (or whatever
the current build's entry rendering is) appear without network
requests succeeding.

**Acceptance Scenarios**:

1. **Given** the production URL has been loaded at least once with
   network, **When** the network is disabled and the page is
   reloaded, **Then** the BootScene (or current entry rendering)
   renders without any failed-network error.
2. **Given** the installed PWA has been launched at least once with
   network, **When** the device is placed in airplane mode and the
   PWA is launched from the home-screen icon, **Then** the game
   loads to the same point it would load to online.
3. **Given** the service worker is registered, **When** the browser
   dev-tools "Application → Service Workers" view is inspected,
   **Then** a service worker is shown as "activated and is running"
   (or platform equivalent), with a non-empty precache.
4. **Given** a new build is deployed, **When** an existing visitor
   reloads the production URL, **Then** the new build is fetched
   and activated within the project's configured update strategy
   (no permanent staleness; the existing PWA-update behaviour from
   the Vite PWA plugin's defaults is acceptable for v0).

---

### Edge Cases

- **First push to the new SWA resource fails.** The auto-generated
  workflow's Node version, build command, or output directory does
  not match the project's actual `package.json` and `vite.config.ts`.
  Edit the workflow file before its second run; the workflow file is
  itself a committed artifact and is reviewed before merge like any
  other code.
- **Production branch reference changes mid-stream.** The
  vertical-slice work is on `001-vertical-slice` today; after that
  PR merges, the production branch becomes `main`. The workflow's
  branch trigger must be updated in the same commit (or PR) that
  performs the merge, so production never points at a deleted branch.
- **Preview URL leaks an in-progress feature externally.** Preview
  URLs are unauthenticated by SWA Free design. Treat any branch with
  a known-broken or sensitive change as not-shareable; assume preview
  URLs are publicly discoverable. (No authentication / private
  previews in v0 — explicit non-goal.)
- **Auto-generated workflow file is overwritten by a future portal
  action.** Treat the workflow file as the source of truth: never let
  the Azure portal regenerate it without re-reviewing the diff.
- **PWA icon paths in the manifest 404 in the deployed build.**
  Placeholder icons MUST exist at every path the manifest declares,
  even if the visual quality is "placeholder" — a 404 invalidates
  installability checks on Chrome/Lighthouse.
- **`netlify.toml` is left in the repo.** Intentional. The file
  stays for reference with a comment block explaining the project
  now deploys via Azure SWA. Removal is a separable cleanup spec,
  not part of this one.
- **SWA Free quota exceeded.** Unlikely at solo-project scale, but
  if hit, the deploy pipeline surfaces a quota error in the workflow
  run log. The maintainer's response is to upgrade the SKU, not to
  paper over it silently.
- **Branch protection on `main` blocks the deploy workflow's first
  run.** Branch protection already requires CI green. The new deploy
  workflow's runs are additive — they do not replace or rename the
  existing CI check. Both can coexist; both run on push.

## Requirements *(mandatory)*

### Functional Requirements

**Public production URL**

- **FR-001**: The deploy pipeline MUST publish the current production
  branch's build to a public HTTPS URL of the form
  `https://<app-name>.<region-slug>.azurestaticapps.net` (or an
  Azure-provided default equivalent).
- **FR-002**: The production URL MUST be reachable without any
  authentication, account, or VPN.
- **FR-003**: The production URL MUST serve a build that reflects the
  HEAD of the configured production branch within 5 minutes of a push
  completing, under normal pipeline conditions.
- **FR-004**: The production-branch reference MUST be configurable in
  the deploy workflow file so it can move from `001-vertical-slice`
  (during the slice's development) to `main` (after the slice merges)
  with a single committed change.

**Deploy previews**

- **FR-005**: Every push to a non-default GitHub branch MUST trigger
  a preview deployment with a unique URL distinct from the production
  URL.
- **FR-006**: The preview URL MUST be discoverable from at least one
  of: the GitHub Actions run summary for that push, an SWA-bot
  comment on the corresponding PR, or the SWA "Environments" view in
  the Azure portal.
- **FR-007**: When a non-default branch is deleted or its associated
  PR is closed/merged, the SWA preview environment MUST be cleaned
  up automatically (no manual destruction required).

**PWA installability**

- **FR-008**: The deployed site MUST be installable as a PWA on iOS
  Safari via Share → "Add to Home Screen", launching in standalone
  mode with no Safari chrome.
- **FR-009**: The deployed site MUST be installable as a PWA on
  desktop Chromium-based browsers (Chrome, Edge) via the URL-bar
  install icon or the browser menu, launching in a dedicated
  standalone window.
- **FR-010**: The deployed site MUST serve a valid web manifest and
  registered service worker that desktop Firefox can introspect
  without warnings (manifest valid, icons resolve, service worker
  reaches activated state). Firefox does not currently offer a
  first-class install flow on desktop equivalent to Chromium; the
  target here is platform parity at the manifest / SW / asset
  layer, not a literal install action.
- **FR-011**: The deployed site MUST serve every PWA-icon path
  declared by the manifest with a 200 response (no 404s on any
  manifest-declared icon).

**Offline behaviour**

- **FR-012**: Once the deployed site has been loaded at least once
  online, a subsequent offline reload (network disabled, no
  background request succeeds) MUST still render at least the
  BootScene (or current entry rendering).
- **FR-013**: An installed PWA, once launched at least once online,
  MUST launch from the home-screen / app-launcher icon while offline
  and reach the same entry rendering as an online launch.
- **FR-014**: The service worker MUST register and reach the
  "activated" lifecycle state in modern browsers on first online
  load.

**Workflow file as committed artifact**

- **FR-015**: The GitHub Actions workflow file that performs the
  deploy MUST be committed to the repository (default Azure-generated
  path `.github/workflows/azure-static-web-apps-*.yml` is acceptable).
- **FR-016**: The workflow file MUST be reviewed for sensible
  defaults (Node version aligned with the project's local Node
  version, build command aligned with `package.json`, build output
  path aligned with `vite.config.ts`) before its first successful
  run is relied on for production deploy.
- **FR-017**: The workflow file MUST be treated as the source of
  truth for the deploy configuration. If the Azure portal regenerates
  it, the diff MUST be reviewed before being committed (no silent
  overwrite).

**SPA routing and caching**

- **FR-018**: A `public/staticwebapp.config.json` (copied to `dist/staticwebapp.config.json` by Vite's static-asset pass at build time) MUST
  configure the SPA navigation fallback so that every unmatched
  client-side route serves `/index.html` (preserving the deep-link
  behaviour the project's `netlify.toml` currently provides).
- **FR-019**: The same `staticwebapp.config.json` MUST set
  long-lived immutable cache headers (`Cache-Control: public,
  max-age=31536000, immutable` or equivalent) for fingerprinted
  assets under `/assets/*`, matching the netlify.toml policy.
- **FR-020**: The existing `netlify.toml` MUST be retained in the
  repo with a comment block stating that the project deploys via
  Azure SWA and pointing to the workflow file. Removing
  `netlify.toml` is out of scope for this feature.

**Secrets and configuration**

- **FR-021**: The SWA deployment token MUST be stored as a GitHub
  Actions repository secret. The secret name follows the Azure
  convention (`AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM>`).
- **FR-022**: No SWA deployment token, Azure subscription ID, Azure
  tenant ID, resource group ARM ID, real maintainer name, or
  maintainer email address MUST be committed to the repository, in
  any file (workflow, config, README, journal, or otherwise). Per
  Constitution Principle XII. Referencing a secret *name* is
  acceptable; committing a secret *value* is not.

**Placeholder PWA icons**

- **FR-023**: Placeholder PNG icons MUST exist at every path the
  PWA manifest declares (currently `/icons/icon-192.png` and any
  other manifest-declared sizes). The icons MUST be of sufficient
  visual quality to clear browser installability checks (any solid
  colour or simple glyph at the correct pixel dimensions is
  acceptable). Final art lives in `001-vertical-slice` tasks (T052)
  and is outside this spec.

**Discoverability**

- **FR-024**: The repo-root `README.md` MUST display the live
  production URL prominently (e.g., at the top of the file, in a
  shields-style badge or a "Live demo" link).
- **FR-025**: `docs/learning/HANDOVER.md` MUST be updated with the
  live production URL in the TL;DR section, so a fresh agent or
  collaborator picking up the project can find it immediately.

### Key Entities

*(No persistent data introduced by this feature. The deploy pipeline
operates on build artifacts; no user data, no schema, no entities to
document beyond what the 001 slice already covers.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From `git push` on the configured production branch to
  the new build being live at the production URL takes under 5
  minutes under normal pipeline conditions, measured at least twice
  on independent pushes.
- **SC-002**: A person who has never seen the project can open the
  production URL on a modern phone or laptop and reach the game's
  current entry rendering in under 10 seconds on a typical home
  internet connection, with zero setup on their device.
- **SC-003**: PWA installability succeeds on the three in-scope
  target platforms (iOS Safari, desktop Chromium, and desktop
  Firefox per FR-010's parity criterion), with no warnings reported
  by Chrome's "Lighthouse → PWA" audit on the desktop Chromium
  path. Android Chrome is explicitly out of scope for v0 (see
  Non-Goals); when an Android device becomes available, a follow-up
  spec covers the install-flow verification.
- **SC-004**: With network disabled in DevTools (or airplane mode
  on a device) after a single prior online load, a reload of the
  production URL renders the BootScene within 3 seconds and
  produces no failed-network errors visible to the user.
- **SC-005**: At least one non-default branch produces a unique
  preview URL that is reachable, distinct from production, and
  serves that branch's HEAD — observed end-to-end at least once
  before this feature is declared shipped.
- **SC-006**: Zero secret values are present in the repository's
  git history at the time this feature is declared shipped. (The
  secret *name* `AZURE_STATIC_WEB_APPS_API_TOKEN_<RANDOM>` may
  appear in committed files; the *value* must not.)
- **SC-007**: The production URL is findable within 10 seconds by
  a fresh reader who opens the repo's `README.md` for the first
  time (and again, by opening `docs/learning/HANDOVER.md`).

## Assumptions

These are the defaults applied where the brief did not enumerate
every detail. Each is reasonable for a solo project at v0 scale.

- **Hosting platform**: Azure Static Web Apps, Free SKU. The
  maintainer has Azure credit on a Visual Studio Enterprise
  subscription but SWA Free is genuinely $0 and the credit is
  reserved for possible future backend work (e.g., Cosmos DB free
  tier for multi-profile sync). Netlify was considered and rejected
  on alignment grounds (the project already lives in the Azure
  ecosystem); the netlify.toml file stays for reference.
- **Azure resource group**: `rg-carrot-code` (lowercase,
  hyphen-separated, conventional Azure naming).
- **Azure region**: `westus2`. SWA Free is not available in
  `westus3`. Fall back to `centralus` only if `westus2` is
  unavailable.
- **Azure subscription**: the maintainer's Visual Studio Enterprise
  subscription, currently active on `az account show`. Do not
  switch subscriptions for this feature.
- **Default URL is sufficient**: the Azure-provided
  `*.azurestaticapps.net` host name is the production URL
  indefinitely. Custom domains (e.g., `carrot-code.com`) are an
  explicit non-goal; if ever wanted, that becomes a separate spec.
- **Deploy mechanism**: the Azure-portal-generated GitHub Actions
  workflow plus token-based authentication, as the platform's
  default offers it. Custom OIDC federation, deployment slots, or
  enterprise-style multi-environment patterns are out of scope; the
  token default is correct for solo-project scale.
- **Workflow ownership**: the `.github/workflows/azure-static-web-apps-*.yml`
  file is committed alongside `staticwebapp.config.json` and
  reviewed in the same PR that first proves the pipeline green.
- **PWA icon quality**: placeholder PNGs of any solid colour are
  acceptable for clearing installability checks. Real art is part
  of `001-vertical-slice` task T052, not this feature.
- **Browser support matrix for v0**: iOS Safari (install + run),
  desktop Chromium / Chrome / Edge (install + run + Lighthouse PWA
  audit), desktop Firefox (manifest + SW + offline reload parity;
  no install assertion per FR-010 rationale). Android Chrome is
  expected to work but is not verified in v0 (see Non-Goals). A
  follow-up spec covers Android when a device becomes available.
- **No private previews**: preview URLs from SWA Free are
  unauthenticated and treated as publicly discoverable. The
  maintainer's responsibility is to not push known-broken or
  sensitive work to branches whose preview URLs would embarrass
  the project.
- **Branch protection coexistence**: the existing branch protection
  on `main` already requires CI green. The new deploy workflow runs
  in addition to CI, not in place of it. No changes to branch
  protection rules are part of this feature.

## Non-Goals (explicit exclusions)

These are deliberately *not* part of this spec. Each is a separable
piece of work that does not need to ship for this feature to be
declared done.

- **Custom domain.** No `carrot-code.com` or equivalent.
  `*.azurestaticapps.net` is sufficient indefinitely.
- **Analytics, error tracking, observability.** Explicit non-goal
  per Constitution Principle XI. No GA, no Sentry, no Application
  Insights, no anything that calls home from the deployed build.
- **Staging vs. production environments.** The SWA per-branch
  preview model is the staging model. No separate "staging slot."
- **Authentication / login on the deployed site.** No accounts in
  v0.
- **Backend functions, Cosmos DB, or any data plane.** SaveService
  writes to localStorage. The host serves static files only.
- **Multi-region or geographic distribution** beyond what the
  default SWA edge network provides.
- **Removing `netlify.toml`.** The file stays with a reference
  comment. Removal is a separable cleanup spec.
- **Android Chrome PWA install verification.** Out of scope for v0
  on device-availability grounds (the maintainer does not currently
  have an Android device on hand for the playtest). Re-opens as a
  follow-up spec when the device becomes available. The deployed
  build is expected to install correctly on Android Chrome because
  the manifest + service worker work the same across Chromium
  builds, but the spec does not assert it without verification.
- **Azure Key Vault for the deployment token.** GitHub Actions
  Secrets is the chosen vault for this feature; see
  [research.md Q9](./research.md#q9-secrets-management--why-github-actions-secrets-not-azure-key-vault)
  for the decision rationale.

## Dependencies

- The maintainer is logged into Azure via `az login` (already done)
  on a subscription where they have owner or contributor rights
  (verified — it is their personal Visual Studio Enterprise
  subscription).
- The repository is already on GitHub at
  `https://github.com/jasaimial/carrot-code` (verified — public, as
  of 2026-05-17).
- The existing CI workflow (`typecheck / lint / test / build`)
  exists and is the configured required status check on `main`.
  This feature adds to it; it does not replace it.
- The project's `package.json` exposes `build`, `typecheck`, `lint`,
  `test`, and `format` scripts. The SWA workflow's `build_command`
  must call the same `build` script the local dev loop uses.
- The Vite PWA plugin (`vite-plugin-pwa`) is already configured in
  `vite.config.ts` and emits a service worker plus a manifest in
  the production build. This feature does not change the PWA
  configuration; it verifies it on a live URL for the first time.
- The PWA manifest currently declares icon paths that 404 in the
  local build. This feature provides placeholder PNGs that resolve
  those 404s. Real art is part of 001's T052 and is independent of
  this work.

## Relationship to other specs

- **`001-vertical-slice`** is the active feature work and stays
  open as PR #1 until the slice ships per Constitution Principle V.
  This spec (`002-shipping-infrastructure`) is separate and ships
  independently — typically before 001, so that 001's PWA-install
  acceptance scenarios (FR-032 through FR-036, US4) can be
  exercised on a real URL.
- Once this spec ships, the previously bundled task in 001's
  `tasks.md` (T058 — "push to GitHub remote, configure branch
  protection, connect Netlify") reduces to "promote the existing
  preview to production" or simply "no-op; the deploy pipeline
  already runs on the production branch."
- This spec does not block 001, and 001 does not block this spec.
  The two progress in parallel.
# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`

**Created**: [DATE]

**Status**: Draft

**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- [Assumption about target users, e.g., "Users have stable internet connectivity"]
- [Assumption about scope boundaries, e.g., "Mobile support is out of scope for v1"]
- [Assumption about data/environment, e.g., "Existing authentication system will be reused"]
- [Dependency on existing system/service, e.g., "Requires access to the existing user profile API"]
