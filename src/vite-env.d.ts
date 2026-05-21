/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Build-time inlined commit SHA. Set in vite.config.ts via `define`.
 * Used by the title-screen version badge to let the user verify which
 * build the SW is actually serving (catches stale caches).
 */
declare const __BUILD_SHA__: string;

/**
 * Build-time inlined timestamp (UTC, "YYYY-MM-DD HH:MM"). Set in
 * vite.config.ts via `define`. Surfaces next to the SHA on the title
 * screen so a user can spot a multi-day-stale cache at a glance.
 */
declare const __BUILD_TIMESTAMP__: string;
