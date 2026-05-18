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

    // Per-file environment override: any test file under tests/unit/dom/
    // runs in jsdom. Everything else stays node.
    environmentMatchGlobs: [["tests/unit/dom/**", "jsdom"]],

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
