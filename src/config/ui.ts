// -----------------------------------------------------------------------------
// carrot-code — UI tuning
//
// HUD positions, dialog timings, and font sizes — anything that affects
// how UIScene renders text and HUD elements. Coordinates are in the
// scene's local space (top-left origin); negative offsets are measured
// from the right / bottom edge by the consuming code.
//
// Mobile accessibility minimum bar (spec FR-043): HUD text must be
// legible at arm's length on a 2022-era mid-range phone. Values below
// are starting points; T046b is the sign-off playtest.
//
// See:
//   specs/001-vertical-slice/spec.md    — FR-030, FR-031, FR-043
//   .specify/memory/constitution.md     — Principles III + IX
// -----------------------------------------------------------------------------

/**
 * HUD layout, dialog box, and shared text-style constants for UIScene.
 *
 * Positions are pixel offsets from the named scene edge:
 *   - `top`/`bottom`/`left`/`right` are insets from that edge.
 */
export const UI = {
  // --- Hearts / lives ----------------------------------------------------
  /** Hearts HUD inset from the top edge. */
  heartsTopPx: 16,
  /** Hearts HUD inset from the left edge. */
  heartsLeftPx: 16,
  /** Gap between heart icons. */
  heartsGapPx: 6,

  // --- Carrot counter ----------------------------------------------------
  /** Carrot counter inset from the top edge. */
  carrotsTopPx: 16,
  /** Carrot counter inset from the right edge. */
  carrotsRightPx: 16,

  // --- Power-up timer ----------------------------------------------------
  /** Power-up timer ring inset from the top edge. */
  powerTimerTopPx: 56,
  /** Power-up timer ring inset from the right edge. */
  powerTimerRightPx: 16,

  // --- Narrator dialog ---------------------------------------------------
  /** Narrator dialog inset from the bottom edge. */
  dialogBottomPx: 24,
  /** Narrator dialog horizontal inset from both side edges. */
  dialogSidePx: 24,
  /** Padding inside the narrator dialog box. */
  dialogPaddingPx: 12,
  /** Fade-in duration for a newly-triggered narrator beat. */
  dialogFadeInMs: 200,
  /** Fade-out duration on dismiss. */
  dialogFadeOutMs: 150,

  // --- Typography (must remain legible on a phone at arm's length) ------
  /** Default HUD font size in CSS pixels. */
  hudFontSizePx: 18,
  /** Narrator dialog font size in CSS pixels. */
  dialogFontSizePx: 20,
  // HUD text color now lives in src/config/palette.ts (PALETTE_HEX.textCream)
  // per Constitution Principle III: single source of truth per concern.
  // Import it directly from palette.ts in scenes that render text.

  // --- Dev FPS overlay (visible in dev only; Constitution Principle X) --
  /** FPS overlay inset from the top edge. */
  fpsOverlayTopPx: 8,
  /** FPS overlay inset from the left edge. */
  fpsOverlayLeftPx: 8,
  /** FPS overlay font size in CSS pixels. */
  fpsOverlayFontSizePx: 12,
  /** Update interval for the FPS overlay text. */
  fpsOverlayRefreshMs: 250,

  // --- Touch controls (T035) --------------------------------------------
  // Buttons render only on touch devices (UIScene feature-detects via
  // 'ontouchstart' in window). Positions are in the scene's internal
  // 960x540 coordinate space; Phaser's FIT scale handles physical
  // pixels. Sizes are square (width == height).
  /** Touch button edge length (square). */
  touchButtonSizePx: 88,
  /** Distance from the bottom edge to the button center. */
  touchButtonBottomPx: 70,
  /** Distance from the left edge to the left button center. */
  touchLeftButtonLeftPx: 80,
  /** Distance from the left edge to the right button center. */
  touchRightButtonLeftPx: 196,
  /** Distance from the right edge to the jump button center. */
  touchJumpButtonRightPx: 80,
  /**
   * Distance from the right edge to the throw button center. Stacked
   * above JUMP so right-thumb users can reach both without moving.
   */
  touchThrowButtonRightPx: 80,
  /** Distance from the bottom edge to the throw button center. */
  touchThrowButtonBottomPx: 180,
  /** Touch button fill opacity (0..1). Low so it doesn't dominate. */
  touchButtonOpacity: 0.35,
  /** Touch button opacity boost when pressed. */
  touchButtonPressedOpacity: 0.7,
  /** Touch button label font size. */
  touchButtonLabelFontSizePx: 36,
  /**
   * Touch button label font size for the THROW button. Smaller than
   * jump because "THROW" is more characters than "JUMP".
   */
  touchThrowButtonLabelFontSizePx: 22,
} as const;
