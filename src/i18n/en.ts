// -----------------------------------------------------------------------------
// carrot-code — English strings catalog
//
// Single source of truth for every player-visible English string. Add
// a new key here, reference it via `t("...")` from scenes / HUD / dialog
// code. NEVER inline a player-visible string in TS, even when there's
// only ever going to be one language (there's never only ever going to
// be one language).
//
// Per Constitution Principle III (extended in v1.1.1 amendment proposal):
// all player-visible text MUST go through the translation function.
//
// Adding a language later:
//   1. Create src/i18n/<locale>.ts with the same key set (TypeScript
//      enforces full coverage via the I18nKey type below).
//   2. Pass it to setLocale() in src/i18n/index.ts.
//   3. Optionally add a language picker UI; until then EN is the default.
//
// See:
//   src/i18n/index.ts                — the t() lookup + locale switch
//   .specify/memory/constitution.md  — Principle III
// -----------------------------------------------------------------------------

/**
 * The flat English string catalog. Keys are dot-namespaced
 * (`<area>.<purpose>`) so future autocomplete and grep stay friendly.
 *
 * KEEP THIS SHAPE STABLE. Other locale files must declare the EXACT
 * same key set; TypeScript enforces parity at compile time via the
 * I18nKey type derived from this object.
 */
export const EN = {
  // --- Dev / placeholder strings (visible in stubs; remove with stubs) ---
  "dev.bootStub": "BootScene stub\n(asset preload lands in T032)",
  "dev.menuStub": "MenuScene stub\n(intentionally a stub for v0)",
  "dev.levelStub": "LevelScene stub\n(Tiled-driven level renderer lands in T034)",
  "dev.uiStub": "UIScene stub (HUD/touch/dialog lands later)",
  "dev.gameOverStub": "GameOverScene stub\n(end-of-run UI lands in T036)",
  "dev.fpsLabel": "FPS",

  // --- HUD labels (T035 / T043) -------------------------------------------
  "hud.carrots": "Carrots",
  "hud.lives": "Lives",
  "hud.powerupRemaining": "Power",

  // --- Game-over / level-complete (T036 / T044) ---------------------------
  "outcome.levelComplete": "Level complete!",
  "outcome.gameOver": "Game over",
  "outcome.playAgain": "Play again",

  // --- Narrator dialog framing (T049). The BEAT TEXT itself lives in
  //     src/data/narrator-beats.ts (T047) and is NOT here, because the
  //     beat data is the canonical narrator content, not a UI string. ---
  "dialog.dismissKey": "Press [Space] to continue",
  "dialog.dismissTap": "Tap to continue",

  // --- No-script fallback (also mirrored in index.html for SEO/no-JS) ---
  "boot.noScript":
    "Carrot Code needs JavaScript to run. Please enable it and reload, or open this page in a modern browser.",
} as const;

/**
 * Every legal key for the {@link t} lookup. Other locale files must
 * declare these exact keys (TypeScript enforces via type intersection
 * in src/i18n/index.ts).
 */
export type I18nKey = keyof typeof EN;

/** The catalog type all locales must satisfy. */
export type I18nCatalog = Readonly<Record<I18nKey, string>>;
