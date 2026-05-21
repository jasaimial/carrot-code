// -----------------------------------------------------------------------------
// carrot-code — debug-overlay (T027)
//
// Tiny dev-only helper that attaches a live FPS readout to a Phaser
// scene. Constitution Principle X says development needs an FPS
// indicator; this is the seam.
//
// Gating: reads `scene.registry.get("devMode")`, which game.ts sets
// from `import.meta.env.DEV` in its `callbacks.postBoot` hook. A
// production build sees `devMode === false` and the helper is a no-op,
// so production never pays the per-frame text update.
//
// Authoring rule: scenes call `attachFpsOverlay(this)` from their
// `create()` if they want the overlay. BootScene calls it during Phase
// 2; when UIScene becomes the long-lived HUD layer (T035 / T043) it
// will own the overlay and the BootScene call disappears.
//
// See:
//   src/game.ts                — registers `devMode` on the registry
//   src/config/ui.ts           — overlay tuning (position, refresh rate)
//   .specify/memory/constitution.md — Principles III + X
// -----------------------------------------------------------------------------

import type Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";
import { UI } from "../config/ui.js";
import { t } from "../i18n/index.js";

/**
 * Attach a live FPS readout to the top-left corner of `scene`. No-op
 * outside dev mode (i.e. when `scene.registry.get("devMode")` is
 * falsy), so production builds never render or update the overlay.
 *
 * Cleanup is automatic: the underlying timer event is owned by the
 * scene, so it stops with the scene.
 *
 * @param scene - The Phaser scene to attach the overlay to. Typically
 *   the active gameplay or boot scene.
 */
export function attachFpsOverlay(scene: Phaser.Scene): void {
  if (scene.registry.get("devMode") !== true) {
    return;
  }

  // depth Number.MAX_SAFE_INTEGER keeps the overlay on top regardless
  // of how the rest of the scene layers itself.
  const text = scene.add
    .text(UI.fpsOverlayLeftPx, UI.fpsOverlayTopPx, "", {
      fontFamily: "monospace",
      fontSize: `${String(UI.fpsOverlayFontSizePx)}px`,
      color: PALETTE_HEX.textCream,
    })
    .setScrollFactor(0)
    .setDepth(Number.MAX_SAFE_INTEGER);

  const refresh = (): void => {
    const fps = scene.game.loop.actualFps;
    text.setText(`${t("dev.fpsLabel")}: ${fps.toFixed(0)}`);
  };
  refresh();

  scene.time.addEvent({
    delay: UI.fpsOverlayRefreshMs,
    loop: true,
    callback: refresh,
  });
}
