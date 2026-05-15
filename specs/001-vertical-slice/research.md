# Phase 0: Research

Quick rationale + alternatives considered for each technical decision in [plan.md](./plan.md). One Q&A per decision; "decision," "alternatives considered," and "rejected because" only — no detail beyond what's needed to defend the choice.

## Q1: Game engine — why Phaser 3?

**Decision**: Phaser 3 (≥ 3.80, MIT-licensed).

**Alternatives considered**:

- **PixiJS** — rendering only; we'd build physics, input, scenes, and tilemap loading ourselves. Too much for v0 and not aligned with "ships from day one."
- **KAPLAY** (formerly Kaboom) — fun API but smaller ecosystem; less material to learn from when stuck.
- **Excalibur.js** — TypeScript-first which is appealing, but smaller community and fewer Tiled tilemap examples.
- **Phaser 4** — still pre-release as of 2026-05; locks us out of stable docs and most tutorials.

**Rejected because**: Phaser 3 is the only option that combines (a) MIT license, (b) production maturity, (c) first-class Tiled tilemap support (Principle IV requirement), (d) a community large enough to answer questions, and (e) good TypeScript types out of the box.

## Q2: PWA tooling — vite-plugin-pwa vs hand-rolled?

**Decision**: `vite-plugin-pwa` with Workbox (its default).

**Alternatives considered**:

- **Hand-rolled service worker + manifest** — full control, more learning. The iOS-Safari edge cases (especially `apple-touch-startup-image` per device + cache strategies that don't break offline) are well-tested in vite-plugin-pwa.
- **Workbox CLI standalone** — works, but adds a build step outside Vite.

**Rejected because**: vite-plugin-pwa is the de-facto Vite PWA solution, generates a correct manifest + SW with sensible defaults, and exposes hooks for the iOS meta-tag set we need. Hand-rolling is a good follow-up learning exercise but not the right v0 risk.

## Q3: Save storage — localStorage vs IndexedDB?

**Decision**: `localStorage`, wrapped in `SaveService`.

**Alternatives considered**:

- **IndexedDB** — async API, more capacity (~50 MB+), structured storage. Overkill for v0's save shape (a few hundred bytes).
- **Cookies** — sent on every request, capped at ~4 KB. Wrong tool entirely.
- **OPFS** — too new for the iOS Safari baseline.

**Rejected because**: SaveState is small, structured, and synchronous-friendly. localStorage is universally supported including iOS standalone-mode. The `SaveService` wrapper means we can swap to IndexedDB later without touching scenes (Principle XI's I/O-isolation discipline).

## Q4: Touch controls — plugin vs hand-rolled?

**Decision**: Hand-rolled overlay using Phaser's input system + a `UIScene`-managed pair of zones (left half = movement, right half = jump button).

**Alternatives considered**:

- **phaser-touch-controls community plugin** — small dependency, but adds a maintenance vector for a tiny amount of code we'd benefit from understanding.
- **NippleJS** — joystick UX is overkill for a 2-direction platformer.

**Rejected because**: For a 2-button platformer, the hand-rolled version is ~50 lines, demonstrably correct, easy to test, and aligns with the project's stated learning goals.

## Q5: Tilemap format — Tiled JSON (`.tmj`) vs CSV vs custom?

**Decision**: Tiled JSON (`.tmj`).

**Alternatives considered**:

- **Tiled CSV** — simpler but loses object layers (we need them for spawn point, end trigger, enemy/pickup placements).
- **Custom JSON** — total control, but then we own the editor too.

**Rejected because**: Tiled is free, mature, exports JSON natively, and Phaser 3 has direct loaders for it. Object-layer custom properties carry our spawn-point / end-trigger / entity-placement metadata, which a pure `level-loader` function reads into `LevelData` (testable per Principle VI).

## Q6: Hosting — Netlify vs GitHub Pages?

**Decision**: Netlify (GitHub-integrated; auto-deploy from `main`).

**Alternatives considered**:

- **GitHub Pages** — free, simple, but limited HTTP-header control (we want immutable-asset headers and a basic CSP); cache-busting for Workbox is more manual.
- **Cloudflare Pages** — also good; Netlify chosen for its simpler `netlify.toml` config story and the project author's familiarity.

**Rejected because**: Netlify gives us `netlify.toml` for headers + redirects, atomic deploys, deploy previews on PRs (CI value), and a free tier that easily covers a static SPA. GitHub Pages remains a viable backup if Netlify ever becomes a problem.

## Q7: Audio in v0 — yes or defer?

**Decision**: Defer to a follow-up spec (per spec assumption: "no audio required for v0 to be considered shipped"). When added later, route through Phaser's audio API; respect iOS autoplay policies (require a user gesture before first play); use only CC0 audio per Principle VII.

**Alternatives considered**: Including a small CC0 jump-sound + carrot-pickup-ping to make the game feel alive. Tempting, but adds asset-license, autoplay-handling, and mute-toggle work that isn't in the spec.

**Rejected because**: scope creep against Principle V. Easy follow-up spec (`002-audio`) once the slice ships.

## Q8: CI shape — what runs, what gates merge?

**Decision**: Single `.github/workflows/ci.yml` with one job: `npm ci` → `npm run typecheck` → `npm run lint` → `npm run test` → `npm run build`. All four commands are required-status checks (Principle VIII). Coverage uploaded as a workflow artifact for visibility, not as a gate (Principle VI).

**Alternatives considered**: Multi-job parallel workflow (matrix on Node versions, separate lint/test/build jobs). Faster but more YAML to maintain; for a single-Node-version project the simpler form wins.

**Rejected because**: complexity not yet earned. Splitting jobs becomes worthwhile when CI exceeds ~3 minutes; we expect < 30 s.

## Q9: Package manager — npm vs pnpm vs yarn?

**Decision**: `npm`.

**Alternatives considered**: `pnpm` (faster installs, disk-efficient via content-addressed store), `yarn` (still around, less compelling than pnpm).

**Rejected because**: npm ships with Node, no extra prerequisite for a new contributor or CI runner, and our dependency tree is small enough that install-speed differences are negligible. Easy to swap to pnpm later if it becomes a pain.
