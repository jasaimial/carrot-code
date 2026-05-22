import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";

// -----------------------------------------------------------------------------
// carrot-code — Vite config
//
// Sets up the dev server, build pipeline, and PWA (manifest + service worker)
// via `vite-plugin-pwa` (Workbox under the hood). See:
//   specs/001-vertical-slice/plan.md#technical-context
//   specs/001-vertical-slice/research.md#q2-pwa-tooling
//
// This is the v0 setup per task T003. Task T054 will finalise:
//   - The full apple-touch / iOS startup-image link set
//   - Workbox `runtimeCaching` rules (cache-first for /assets/*,
//     network-first for the document with offline fallback)
//   - Final icon list once T052 produces the icon set
// -----------------------------------------------------------------------------

/**
 * Read the current git short SHA at build time. Surfaced to the runtime
 * via `__BUILD_SHA__` so the title-screen version badge can prove which
 * commit the user is actually loading (catches stale-SW caching).
 *
 * Falls back to "dev" when git isn't reachable (CI sometimes is, the
 * fallback keeps the build green either way).
 * @returns A 7-character git short SHA, or `"dev"` if git isn't reachable.
 */
function readGitShortSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

const BUILD_SHA = readGitShortSha();
const BUILD_TIMESTAMP = new Date().toISOString().slice(0, 16).replace("T", " ");

export default defineConfig({
  // Vite serves files in /public at the root and resolves `import.meta.env.DEV`
  // for the dev-only FPS overlay called out in Constitution Principle X.
  base: "/",

  // Surface build metadata to the runtime so the title screen can
  // display it. Both values are inlined as JSON-stringified literals
  // at build time (Vite's standard `define` behavior).
  define: {
    __BUILD_SHA__: JSON.stringify(BUILD_SHA),
    __BUILD_TIMESTAMP__: JSON.stringify(BUILD_TIMESTAMP),
  },

  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: true,
  },

  plugins: [
    VitePWA({
      // `autoUpdate` is the right default for a game: users always get the
      // latest build on next launch with no reload prompt. Switch to `prompt`
      // only when we have something a player would want to defer (we don't).
      registerType: "autoUpdate",

      // Files in /public that should be precached even though they aren't
      // imported from JS. T053 will expand this with the iOS splash set.
      includeAssets: ["favicon.svg", "favicon.ico", "robots.txt", "icons/apple-touch-icon.png"],

      // Web App Manifest. Spec FR-032 / FR-033 / FR-034 / FR-035.
      // Theme + background colors are placeholders until art direction
      // settles; revisit in T054 or whenever the splash colour is locked.
      manifest: {
        name: "Carrot Code",
        short_name: "Carrot Code",
        description:
          "A 2D pixel-art platformer built as a learning project for game " +
          "programming + Spec-Driven Development practice.",
        start_url: "/",
        scope: "/",
        display: "standalone",

        // Spec I2 fix in tasks.md T035: phones land in landscape; the
        // `screen.orientation.lock()` call there is the runtime belt to this
        // manifest suspenders. Desktop / tablets honour device orientation.
        orientation: "landscape",

        // Theme + background colors must match the corresponding tokens
        // in src/config/palette.ts (bgForest / textCream). Not imported
        // dynamically because the manifest block is evaluated at config
        // load, before TS module resolution — the discipline is by
        // convention + comment.
        theme_color: "#2d6a3e", // = PALETTE_HEX.bgForest
        background_color: "#fdf6e3", // = PALETTE_HEX.textCream

        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      // Workbox: defaults are fine for v0. T054 adds the `runtimeCaching`
      // rules per the plan's PWA strategy.
      workbox: {
        // Don't precache source maps in production (they're large + private
        // to the source, even though we emit them).
        globIgnores: ["**/*.map"],
      },

      // PWA in dev mode is intentionally OFF.
      //
      // When enabled, vite-plugin-pwa generates a dev-mode service worker
      // that survives across `npm run dev` restarts and Vite version
      // upgrades. After any code change that shifts an asset URL, the
      // stale SW intercepts requests and returns cached responses for
      // paths that no longer exist - manifest goes Syntax-error, main.ts
      // returns 500, etc. Diagnosing this looks like "dev server is
      // broken" but it's the SW lying about asset existence.
      //
      // We have the deployed SWA URL for real PWA install / offline /
      // service-worker testing. Local dev should be plain HTTP only.
      // Re-enable here ONLY for an explicit PWA-in-dev debugging session,
      // and unregister the SW from DevTools afterwards.
      devOptions: {
        enabled: false,
        type: "module",
      },
    }),
  ],

  server: {
    // Bind 0.0.0.0 so a phone on the same Wi-Fi can hit the dev server
    // during touch-control playtesting (per spec FR-006).
    host: true,
    port: 5173,
    // strictPort: true means "fail loudly if 5173 is already taken"
    // rather than silently shifting to 5174/5175. Silent port-shift
    // bit us hard 2026-05-22: a zombie dev server from a previous
    // session was squatting on 5173 with an old PWA service worker
    // registered, while `npm run dev` happily moved to 5174. Browser
    // requests to localhost:5173 hit the zombie + its stale SW; the
    // "current" dev server was running but unreachable.
    //
    // With strictPort:true, "port in use" surfaces as a startup
    // error and the maintainer kills the zombie BEFORE wasting time
    // diagnosing a phantom regression.
    strictPort: true,
  },

  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
});
