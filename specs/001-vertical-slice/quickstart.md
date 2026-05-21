# Quickstart — vertical slice

How to clone, install, run, test, and build `carrot-code` in under 5 minutes from a fresh machine. Tested on Windows 11 + PowerShell 7; Linux/macOS commands shown where they differ.

> **Note:** at the time of writing this plan, the source tree (`src/`, `tests/`, `package.json`, etc.) does not yet exist — those land in the implementation PRs. This quickstart describes the experience once the implementation tasks (`/speckit.tasks` → `/speckit.implement`) have produced the codebase. Treat it as the contract the implementation must satisfy.

## Prerequisites

- **Node.js ≥ 20** (`node --version`)
- **npm ≥ 10** (ships with Node 20+)
- A modern browser for testing (Chrome, Edge, Firefox, or Safari)
- Optional: [Tiled](https://www.mapeditor.org/) if you plan to edit `level-01.tmj`

## 1. Clone & install

```powershell
git clone https://github.com/<owner>/carrot-code.git
cd carrot-code
npm install
```

## 2. Run the dev server

```powershell
npm run dev
```

Vite prints a localhost URL (typically `http://localhost:5173`). Open it. The game loads with hot-module reload — edits to `src/` reflect immediately.

The dev build shows Phaser's FPS overlay in the corner (Principle X). Production builds hide it.

## 3. Run the tests

```powershell
npm test                # one-shot
npm run test:watch      # watch mode for TDD
npm run test:coverage   # with coverage report
```

Vitest runs in `node` env by default (pure-logic tests) and switches to `jsdom` for any test importing DOM globals. Coverage HTML lands in `coverage/` (gitignored). It's reported, never gated (Principle VI).

## 4. Lint, format, typecheck

```powershell
npm run lint            # ESLint
npm run format          # Prettier
npm run typecheck       # tsc --noEmit
```

These are also run in CI (`.github/workflows/ci.yml`); a PR fails if any of typecheck, lint, test, or build fails.

## 5. Build for production

```powershell
npm run build
npm run preview         # serves the production build locally for sanity-checking
```

`dist/` is the deployable artifact. Netlify auto-deploys it from `main`.

## 6. Test the PWA install

After `npm run build && npm run preview`, in a Chromium-based browser:

1. Open the preview URL.
2. Look for the install icon in the address bar (or use browser menu → "Install carrot-code").
3. Launch the installed app from your OS app launcher.
4. Confirm the window has a custom icon, no address bar, and the game runs.

For iOS testing, deploy to Netlify (or use a tunnel like ngrok for HTTPS over localhost), then on iPhone Safari → Share → Add to Home Screen, and verify per spec FR-034 / Story 4 (standalone mode, custom splash, offline play).

## What's where

| Want to ... | Look at ... |
|---|---|
| ... change a tuning value (jump height, enemy speed, ...) | `src/config/*.ts` |
| ... edit the level layout | `src/data/levels/level-01.tmj` (in Tiled) |
| ... change narrator dialog | `src/data/narrator-beats.ts` |
| ... add a service-level test | `tests/unit/<service-name>.test.ts` |
| ... add an asset | declare it in `src/services/asset-service.ts` (`assets` array), then drop the file under `public/assets/` |
| ... add a new level | drop `level-02.tmj` under `src/data/levels/`, then add one entry to `src/data/levels/index.ts` (no scene-code edits — Principle IV) |
