// -----------------------------------------------------------------------------
// carrot-code — Palette
//
// Single source of truth for every color the game renders. Constitution
// Principle III applied to colors: no inline hex literals in scenes,
// entities, HUD code, or the manifest. Change a color here, every
// surface that uses it follows.
//
// Why centralise:
//   - Theming: future light/dark/high-contrast modes flip one map.
//   - Consistency: forest-green is forest-green everywhere, not "almost
//     the same forest-green" across five files.
//   - Asset pipeline: pixel-art tooling exports a palette; this file is
//     where we declare the in-engine equivalents.
//
// Two access shapes are exported:
//   - PALETTE_HEX: CSS / Phaser-string form, "#rrggbb". Used by
//     style: { color: ... }, backgroundColor: "...", manifest theme_color.
//   - PALETTE: numeric 0xRRGGBB form. Used by Phaser APIs that take a
//     number (Graphics fill, scene.cameras.main.setBackgroundColor when
//     called with a number, etc.).
//
// Token naming:
//   bg* = background / surface fills
//   text* = foreground text
//   ui* = HUD glyphs (hearts, carrots, power-bar)
//   debug* = devtools / dev-only overlays
//
// See:
//   .specify/memory/constitution.md   — Principle III (no magic values)
//   docs/learning/02-phaser-101.md    — colors in scenes section
// -----------------------------------------------------------------------------

/**
 * Canonical color tokens in CSS hex string form (`"#rrggbb"`).
 *
 * Use these for Phaser text styles, manifest theme/background colors,
 * inline HTML styles, and anywhere a CSS color string is expected.
 */
export const PALETTE_HEX = {
  /** Forest-green primary surface (game background, manifest theme). */
  bgForest: "#2d6a3e",
  /** Sky gradient top — soft cyan. Used by the parallax backdrop. */
  bgSkyTop: "#92c0d4",
  /** Sky gradient horizon — sage teal that meets the forest. Backdrop only. */
  bgSkyHorizon: "#5f8a7c",
  /** Warm cream — primary foreground text, manifest background fallback. */
  textCream: "#fdf6e3",
  /** Carrot orange — collectibles, accent flourishes. */
  uiCarrot: "#f59e0b",
  /** Heart / lives indicator red. */
  uiHeart: "#dc2626",
  /** Power-up timer ring / invincibility flash. */
  uiPowerup: "#facc15",
  /** Subtle in-dialog background (semi-transparent in render code). */
  bgDialog: "#1f2937",
  /** Debug HUD text (FPS overlay) — high contrast on any background. */
  debugText: "#10b981",
} as const;

/**
 * Same tokens as {@link PALETTE_HEX}, in Phaser-numeric `0xRRGGBB` form.
 *
 * Use these where the Phaser API expects a number (Graphics.fillStyle,
 * Camera.setBackgroundColor(0x...), tween color interpolation, etc.).
 *
 * Kept in lock-step with PALETTE_HEX by the local hexToNumber()
 * conversion below; do not edit one without the other.
 */
export const PALETTE = {
  bgForest: hexToNumber(PALETTE_HEX.bgForest),
  bgSkyTop: hexToNumber(PALETTE_HEX.bgSkyTop),
  bgSkyHorizon: hexToNumber(PALETTE_HEX.bgSkyHorizon),
  textCream: hexToNumber(PALETTE_HEX.textCream),
  uiCarrot: hexToNumber(PALETTE_HEX.uiCarrot),
  uiHeart: hexToNumber(PALETTE_HEX.uiHeart),
  uiPowerup: hexToNumber(PALETTE_HEX.uiPowerup),
  bgDialog: hexToNumber(PALETTE_HEX.bgDialog),
  debugText: hexToNumber(PALETTE_HEX.debugText),
} as const;

/**
 * Convert a `"#rrggbb"` hex string to a `0xRRGGBB` number.
 *
 * Private; exported only as a type-guarded constant generator for
 * PALETTE above. Asserts (not throws-with-message) on malformed input
 * because every input here is a literal from PALETTE_HEX directly above
 * — a malformed string is a code typo, not a runtime condition.
 *
 * @param hex - A 7-char string starting with "#" followed by 6 hex digits.
 * @returns The numeric color value.
 */
function hexToNumber(hex: string): number {
  // Sanity check the inputs we control. Any failure here is a typo in
  // PALETTE_HEX above, caught the first time tests / typecheck run.
  if (hex.length !== 7 || !hex.startsWith("#")) {
    throw new Error(`palette.ts: malformed hex token ${hex}`);
  }
  return Number.parseInt(hex.slice(1), 16);
}
