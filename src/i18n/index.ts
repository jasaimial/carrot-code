// -----------------------------------------------------------------------------
// carrot-code — i18n module entry point
//
// Tiny translation seam (T035a). Today only English is registered;
// `t("key")` returns the English string. To add a locale:
//
//   import { KO } from "./ko.js";
//   setLocale(KO);
//
// The I18nCatalog type forces any new locale to declare the exact same
// key set as EN — typecheck is the safety net, not runtime.
//
// Why we did this on day one rather than "when needed":
//   - Player-visible strings cost zero to wrap in t() during initial
//     authoring; cost a global find-and-replace later.
//   - The cheap seam now opens the door to multi-language without any
//     architectural change.
//
// See:
//   src/i18n/en.ts                  — the EN catalog + I18nKey type
//   .specify/memory/constitution.md — Principle III (v1.1.1 amendment)
// -----------------------------------------------------------------------------

import { EN, type I18nCatalog, type I18nKey } from "./en.js";

let activeCatalog: I18nCatalog = EN;

/**
 * Look up a player-visible string by key. Always returns a string —
 * if a key is somehow missing (shouldn't be possible under typecheck,
 * but defensive for runtime locale swaps), returns the key itself so
 * the missing string is visibly broken on screen rather than rendering
 * as `undefined`.
 *
 * @param key - A typed I18nKey from EN (e.g. `"hud.carrots"`).
 * @returns The localized string for the active locale.
 */
export function t(key: I18nKey): string {
  return activeCatalog[key];
}

/**
 * Switch the active locale. Pass any catalog satisfying I18nCatalog
 * (i.e., declaring every I18nKey).
 *
 * @param catalog - The new locale catalog. TypeScript guarantees it
 *   covers every key declared in EN.
 */
export function setLocale(catalog: I18nCatalog): void {
  activeCatalog = catalog;
}

/**
 * Test / introspection helper: which catalog is currently active.
 *
 * @returns The catalog object reference.
 */
export function getActiveCatalog(): I18nCatalog {
  return activeCatalog;
}

// Re-export the types so consumers (scenes, HUD, tests) can import
// everything they need from a single module.
export { EN, type I18nKey, type I18nCatalog };
