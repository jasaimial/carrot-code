import { defineConfig } from "vitest/config";

// -----------------------------------------------------------------------------
// carrot-code — Vitest config
//
// Default environment is `node` (fast, no DOM tax) for the pure-logic tests
// the constitution actually requires (level-loader, save-service, coyote-time,
// jump-buffer, physics-helpers, narrator-beats).
//
// Any test that genuinely needs a DOM lives under `tests/unit/dom/` and gets
// the `jsdom` environment via the per-file override below. We don't have any
// such tests in v0 — the seam exists so the rule is enforced from day one
// rather than added in a hurry later.
//
// See:
//   .specify/memory/constitution.md  — Principle VI (Tested Where It Matters)
//   specs/001-vertical-slice/plan.md#technical-context
// -----------------------------------------------------------------------------

export default defineConfig({
  test: {
    environment: "node",
    globals: false, // explicit `import { describe, it, expect } from "vitest"`
    include: ["tests/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist", ".vite", "dev-dist", "coverage"],

    // NOTE: Vitest 4 removed the `environmentMatchGlobs` option that earlier
    // plan drafts used to per-glob-switch to jsdom for DOM-touching tests.
    // Replacement options in v4 (`projects`, or a separate vitest.dom.config)
    // add ceremony we don't need yet — v0 has no DOM tests. When the first
    // one lands under tests/unit/dom/, introduce a second config file and
    // wire both into the `test` and `test:coverage` npm scripts.

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.d.ts",
        "src/main.ts", // Vite entry: trivial; tested via the running app
        "src/game.ts", // Phaser bootstrap: integration, not unit
        "src/scenes/**", // Phaser scenes: hard to unit-test cleanly
      ],
      // Coverage % is reported, never gated (Constitution Principle VI).
      // Thresholds intentionally left unset.
    },
  },
});
