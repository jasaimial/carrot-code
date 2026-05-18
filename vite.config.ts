import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

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

export default defineConfig({
  // Vite serves files in /public at the root and resolves `import.meta.env.DEV`
  // for the dev-only FPS overlay called out in Constitution Principle X.
  base: "/",

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

        // Neutral placeholders — Principle IX (readable) + a TODO for T054.
        theme_color: "#2d6a3e", // forest green; placeholder
        background_color: "#fdf6e3", // warm cream; placeholder

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

      // Show the PWA in dev mode so we can sanity-check install prompts
      // without a production build every time.
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],

  server: {
    // Bind 0.0.0.0 so a phone on the same Wi-Fi can hit the dev server
    // during touch-control playtesting (per spec FR-006).
    host: true,
    port: 5173,
    strictPort: false,
  },

  preview: {
    host: true,
    port: 4173,
    strictPort: false,
  },
});
