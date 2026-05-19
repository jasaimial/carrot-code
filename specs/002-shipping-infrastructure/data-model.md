# Phase 1: Data Model

This feature introduces no gameplay data, no entities, and no persisted state — the project's existing `SaveState` shape (`specs/001-vertical-slice/data-model.md`) is unaffected.

The only structured-data artifact this feature commits is `staticwebapp.config.json` at the repo root. SWA reads it once per deploy and uses it to configure SPA fallback behaviour and HTTP response headers. This file IS the "data model" of this feature.

This document is the field-by-field rationale for that file. It is the source of truth for FR-018 (SPA fallback) and FR-019 (immutable-asset cache headers).

## `staticwebapp.config.json` — annotated reference

The committed file should be a strict subset of the SWA configuration schema documented at <https://learn.microsoft.com/azure/static-web-apps/configuration>. Below is the expected shape with field-by-field rationale; the implementing PR should match this structure (formatting normalised by Prettier, so trailing-comma / quoting style is mechanical, not a decision).

```jsonc
{
  // SPA navigation fallback — make every unmatched client-side path serve
  // /index.html so deep links and the PWA's offline navigation work. Mirrors
  // the netlify.toml [[redirects]] from "/*" to "/index.html" with status 200.
  //
  // FR-018. Without this, SWA's default 404 page renders for any path other
  // than the file paths emitted by `vite build`, which breaks PWA install
  // refresh behaviour and any future client-side routing.
  "navigationFallback": {
    "rewrite": "/index.html",

    // EXCLUDE the SPA fallback from real-asset paths so genuine 404s on
    // assets (e.g., a missing icon, a missing /assets/<hash>.js) surface as
    // 404s instead of being silently rewritten to index.html (which would
    // mask broken builds). This list matches the file shapes Vite emits +
    // the PWA-related artifacts vite-plugin-pwa generates.
    "exclude": [
      "/assets/*",
      "/icons/*",
      "/favicon.svg",
      "/favicon.ico",
      "/manifest.webmanifest",
      "/sw.js",
      "/workbox-*.js",
      "/registerSW.js",
      "/robots.txt"
    ]
  },

  // Per-route headers. SWA supports a top-level `globalHeaders` block OR
  // per-route headers in `routes[]`. We use `routes[]` so the immutable
  // cache header applies ONLY to /assets/* (the hashed-filename Vite output)
  // and short-cache headers apply specifically to the service worker and
  // manifest. Mirrors the per-route headers stanza in netlify.toml.
  //
  // FR-019.
  "routes": [
    {
      // Hashed Vite asset filenames are content-addressed — safe to cache
      // for a year, immutable.
      "route": "/assets/*",
      "headers": {
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    },
    {
      // The service worker MUST NOT be cached aggressively or users get
      // stuck on old builds. Reasoning identical to the netlify.toml
      // /sw.js stanza.
      "route": "/sw.js",
      "headers": {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Service-Worker-Allowed": "/"
      }
    },
    {
      // Manifest changes occasionally (icon updates, name changes). Short
      // cache + explicit content-type for browsers that don't infer it.
      "route": "/manifest.webmanifest",
      "headers": {
        "Cache-Control": "public, max-age=600",
        "Content-Type": "application/manifest+json"
      }
    }
  ],

  // MIME types for any extensions SWA's defaults miss. Today, vite-plugin-pwa
  // sometimes emits files SWA's MIME table handles correctly; if a future
  // build introduces an extension SWA doesn't know (e.g., .tmj from Tiled
  // exports moved to public/), add it here. Empty object is fine for v0.
  "mimeTypes": {}
}
```

## Field-by-field rationale (summary table)

| Field | Required by | Mirrors what existing config? | Notes |
|---|---|---|---|
| `navigationFallback.rewrite` | FR-018 | `netlify.toml` `[[redirects]]` `from = "/*"` `to = "/index.html"` `status = 200` | Status code is implicit 200 in SWA; no override needed. |
| `navigationFallback.exclude` | FR-018 (correctness) | Same exclusion intent (Netlify does this implicitly for assets the SPA fallback shouldn't catch) | Listed explicitly under SWA to prevent silently rewriting missing assets to index.html. |
| `routes[]/assets/*.headers.Cache-Control` | FR-019 | `netlify.toml` `[[headers]] for = "/assets/*"` | Identical value: `public, max-age=31536000, immutable`. |
| `routes[]/sw.js.headers.Cache-Control` | Correctness (PWA update reliability) | `netlify.toml` `[[headers]] for = "/sw.js"` | Identical value: `public, max-age=0, must-revalidate`. |
| `routes[]/sw.js.headers.Service-Worker-Allowed` | Correctness (root scope) | Same | Allows service worker to control the entire origin. |
| `routes[]/manifest.webmanifest.headers.Cache-Control` | Correctness | Same | 10-minute cache; manifest is small. |
| `routes[]/manifest.webmanifest.headers.Content-Type` | Defensive | Same | Some platforms infer wrong without this. |
| `mimeTypes` | Forward-compat | N/A | Empty placeholder; populated only if a new asset type needs explicit MIME registration. |

## What is intentionally NOT in `staticwebapp.config.json`

- **`auth` / `roles`** — no authentication in v0 (Principle XI; spec non-goal).
- **`platform.apiRuntime`** — no Functions backend in v0 (spec non-goal).
- **`globalHeaders` with CSP, X-Frame-Options, etc.** — out of scope for this feature. SWA's default security headers are reasonable; revisiting CSP under SWA is a separate hardening spec if ever wanted. The existing `netlify.toml` CSP is documentation of *what we landed on under Netlify*, not a contract this feature is required to port.
- **`forwardingGateway`** — no proxy needs.
- **`responseOverrides[404]`** — handled by `navigationFallback`.

## Validation

`staticwebapp.config.json` is validated by SWA at deploy time. A malformed file fails the deploy with a parseable error in the workflow run log (see [contracts/swa-deployment.md](./contracts/swa-deployment.md) failure-mode taxonomy). There is no local validator we'd ship; the schema is small enough that a JSON-with-comments human review at PR time is sufficient. If the schema ever grows past the size we can eyeball, adding an `ajv`-based check is a future hardening item — not required now.

## Relationship to the existing data model

The 001 vertical slice's `data-model.md` defines `RuntimeMode`, `EntityConfig`, `NarratorBeat`, `LevelData`, and `SaveState`. None of those are touched by this feature. The infrastructure layer is below the application layer in the stack; the application's data model is unaware of the host.
