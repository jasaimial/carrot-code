/**
 * Vite entry point. Mounts the Phaser game into #game and registers the PWA
 * service worker via vite-plugin-pwa's virtual module.
 *
 * Constitution Principle XI: `Player` and `Game` are instances, not globals.
 * This file is the ONE place we cross the global-DOM boundary to start them.
 *
 * See:
 *   index.html             - the #game mount point + iOS standalone meta
 *   src/game.ts            - Phaser game config + scene registration (T027)
 *   specs/001-vertical-slice/plan.md#technical-context
 */

import { startGame } from "./game";

// Phaser needs a real DOM element to mount into. If we ever ship a different
// host page that doesn't include #game, fail loudly here rather than letting
// Phaser produce a confusing error.
const mount = document.getElementById("game");
if (mount === null) {
  throw new Error("carrot-code: #game mount point not found in index.html");
}

startGame(mount);

// PWA service worker registration. The 'virtual:pwa-register' module is
// provided at build time by vite-plugin-pwa. We register on next tick so the
// game has a head start on its own asset loading before the SW kicks in.
//
// `registerType: 'autoUpdate'` in vite.config.ts means new builds activate
// automatically; we don't need to prompt the user.
if ("serviceWorker" in navigator) {
  // Use dynamic import so non-PWA dev runs that strip the plugin still work.
  void import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
