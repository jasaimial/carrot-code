// -----------------------------------------------------------------------------
// carrot-code — UIScene (T035 mobile-controls slice)
//
// Runs in parallel ABOVE the active gameplay scene (LevelScene /
// GameOverScene) so HUD elements survive scene transitions. Today
// (T035) it implements the mobile touch controls and the
// portrait-orientation prompt; HUD elements (hearts, carrot counter,
// power-up timer) land in T043; narrator dialog in T049.
//
// Touch detection: feature-detected via `'ontouchstart' in window`
// or `navigator.maxTouchPoints > 0`. If neither is true (desktop
// browser), the buttons are not rendered at all. The Hero entity
// still reads the (empty) TouchInputStore unconditionally, so the
// resolver path is identical across platforms.
//
// Portrait warning: detected via `matchMedia("(orientation: portrait)")`.
// When matched + touch-device, a translucent full-canvas overlay
// invites the player to rotate. Auto-dismisses on landscape.
//
// `screen.orientation.lock("landscape")` is NOT called: it requires
// fullscreen on most browsers, fails silently on iOS Safari, and the
// PWA manifest already declares `orientation: landscape` for installed
// installs. The visual prompt is the cross-browser fallback.
//
// Input wiring: button pointerdown/pointerup writes to the shared
// TouchInputStore on the registry. Hero.update() merges those flags
// with keyboard state to build each frame's HeroInput snapshot.
//
// See:
//   src/systems/touch-input-store.ts  — the shared input store
//   src/entities/hero.ts              — reads the store each frame
//   src/config/ui.ts                  — button sizes + positions
//   .specify/memory/constitution.md   — Principles III + XI
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";
import { UI } from "../config/ui.js";
import { t } from "../i18n/index.js";
import { REGISTRY_KEY_TOUCH_INPUT, TouchInputStore } from "../systems/touch-input-store.js";

import {
  REGISTRY_KEY_CARROT_COUNT,
  REGISTRY_KEY_HERO_LIVES,
  REGISTRY_KEY_POWERUP_REMAINING_MS,
} from "./LevelScene.js";

/** Detection: are we on a touch-capable device? */
function isTouchDevice(): boolean {
  // Two signals because some Windows touch laptops set one but not the
  // other, and some iOS pretend-desktop modes only set maxTouchPoints.
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/** Renders the on-screen touch controls + portrait-rotate prompt. */
export class UIScene extends Phaser.Scene {
  private store: TouchInputStore | undefined;
  private portraitOverlay: Phaser.GameObjects.Container | undefined;
  private orientationMql: MediaQueryList | undefined;
  /** Container holding the lives-hearts icons. Re-rendered when count changes. */
  private heartsContainer: Phaser.GameObjects.Container | undefined;
  /** Text object for the carrot counter. Updated in-place when count changes. */
  private carrotCountText: Phaser.GameObjects.Text | undefined;
  /** Text object for the power-up timer (visible only when timer > 0). */
  private powerTimerText: Phaser.GameObjects.Text | undefined;

  public constructor() {
    super({ key: "UIScene" });
  }

  /** Phaser hook — build touch controls if applicable + start orientation watch. */
  public create(): void {
    this.store = this.requireTouchStore();

    // HUD (hearts + carrot count) renders on both desktop and mobile.
    this.buildHud();

    if (!isTouchDevice()) {
      // Desktop browsers (mouse + keyboard) get no touch buttons. The
      // TouchInputStore stays empty; Hero reads it unchanged.
      return;
    }

    // ---------- Multi-touch slots ----------
    // Phaser defaults to ONE active pointer. With only one slot, pressing
    // a second button while a first is still held does nothing until the
    // first releases — and there's a perceptible delay after the release
    // before the second tap registers (Phaser is busy re-assigning the
    // pointer slot). We need at least 2 simultaneous fingers (e.g. right
    // + jump); allocating 3 gives headroom (left/right + jump + spare).
    // Must be called BEFORE any pointer listeners are attached.
    this.input.addPointer(2);

    this.buildButton(
      UI.touchLeftButtonLeftPx,
      this.scale.height - UI.touchButtonBottomPx,
      t("touch.left"),
      (down) => this.store?.setLeft(down),
    );
    this.buildButton(
      UI.touchRightButtonLeftPx,
      this.scale.height - UI.touchButtonBottomPx,
      t("touch.right"),
      (down) => this.store?.setRight(down),
    );
    this.buildButton(
      this.scale.width - UI.touchJumpButtonRightPx,
      this.scale.height - UI.touchButtonBottomPx,
      t("touch.jump"),
      (down) => this.store?.setJump(down),
    );

    this.setupPortraitWatch();
    this.tryLockLandscape();
  }

  /** Phaser hook — clean up the MediaQueryList listener. */
  public shutdown(): void {
    this.releaseOrientationWatch();
    // Clear the store so a returning desktop player after restart
    // doesn't see stale touch flags.
    this.store?.setLeft(false);
    this.store?.setRight(false);
    this.store?.setJump(false);
    this.store?.consumeJumpPressed();
  }

  /** Retrieve the shared TouchInputStore (game.ts seeds it at postBoot). */
  private requireTouchStore(): TouchInputStore {
    const svc = this.registry.get(REGISTRY_KEY_TOUCH_INPUT) as TouchInputStore | undefined;
    if (svc === undefined) {
      throw new Error(
        "UIScene: TouchInputStore not found on registry; game.ts postBoot must run first.",
      );
    }
    return svc;
  }

  /**
   * Build one square touch button at the given screen-space center,
   * wire its pointer handlers to the supplied flag-setter.
   *
   * Pointer handling notes:
   *   - `pointerdown` on the button → flag true.
   *   - `pointerup` AND `pointerupoutside` on the button → flag false.
   *     The "outside" event fires if the finger slides off while still
   *     pressed (very common with rapid jumping); without it the
   *     button stays "stuck" until the next clean release.
   *   - `setScrollFactor(0)` keeps buttons fixed to the screen as the
   *     camera follows the hero.
   */
  private buildButton(
    cx: number,
    cy: number,
    label: string,
    onPressChange: (down: boolean) => void,
  ): void {
    const size = UI.touchButtonSizePx;
    const fillColor = this.hexToNumber(PALETTE_HEX.bgDialog);

    const bg = this.add
      .rectangle(cx, cy, size, size, fillColor, UI.touchButtonOpacity)
      .setStrokeStyle(2, this.hexToNumber(PALETTE_HEX.textCream), 0.6)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false });

    const text = this.add
      .text(cx, cy, label, {
        fontFamily: "monospace",
        fontSize: `${UI.touchButtonLabelFontSizePx.toString()}px`,
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    // Both children live above the gameplay layer.
    bg.setDepth(1000);
    text.setDepth(1001);

    const press = (): void => {
      bg.setFillStyle(fillColor, UI.touchButtonPressedOpacity);
      onPressChange(true);
    };
    const release = (): void => {
      bg.setFillStyle(fillColor, UI.touchButtonOpacity);
      onPressChange(false);
    };

    bg.on(Phaser.Input.Events.POINTER_DOWN, press);
    bg.on(Phaser.Input.Events.POINTER_UP, release);
    bg.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    bg.on(Phaser.Input.Events.POINTER_OUT, release);
  }

  /**
   * Best-effort attempt to lock the screen orientation to landscape.
   *
   * Browser support is patchy:
   *   - Installed PWAs (Add to Home Screen) respect the manifest's
   *     `orientation: "landscape"` declaration. No JS needed.
   *   - In-browser Chrome on Android: lock() succeeds only when the
   *     document is in fullscreen mode. We don't force fullscreen
   *     here (that would surprise the player); the lock attempt
   *     fails silently and the portrait-rotate prompt is the user-
   *     facing fallback.
   *   - iOS Safari (in-browser): `screen.orientation.lock` is not
   *     supported. Throws or rejects. Caught silently.
   *
   * We attempt it from create() (after the first user gesture on the
   * Play-again button or any earlier gameplay tap that brought the
   * player here from BootScene). Most browsers count that as enough
   * of a gesture. If they don't, no harm done.
   */
  private tryLockLandscape(): void {
    // Feature-detect: `screen.orientation` is non-nullable in modern
    // type defs but might be undefined on older browsers. Coerce to
    // the loose shape to handle both, then check `lock` is a function.
    const orientation = window.screen.orientation as ScreenOrientation | undefined;
    if (orientation === undefined || typeof orientation.lock !== "function") {
      return;
    }
    // `lock()` returns a Promise that rejects on unsupported / wrong
    // state. Swallow silently — the visual prompt is the fallback.
    try {
      void orientation.lock("landscape").catch(() => {
        // Intentionally empty: this is the expected path on iOS
        // Safari and on Android Chrome outside fullscreen mode. The
        // portrait-rotate overlay handles the user-facing message.
      });
    } catch {
      // Intentionally empty: some browsers throw synchronously instead
      // of rejecting. Same fallback applies.
    }
  }

  /**
   * Subscribe to portrait/landscape changes and show/hide the rotate
   * prompt. The PWA manifest declares landscape orientation for
   * installed installs; this is the in-browser fallback.
   */
  private setupPortraitWatch(): void {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    this.orientationMql = window.matchMedia("(orientation: portrait)");
    const apply = (matchesPortrait: boolean): void => {
      if (matchesPortrait) {
        this.showPortraitOverlay();
      } else {
        this.hidePortraitOverlay();
      }
    };
    apply(this.orientationMql.matches);
    // `addEventListener("change")` is the modern API; Safari < 14
    // needs the legacy addListener fallback.
    if (typeof this.orientationMql.addEventListener === "function") {
      this.orientationMql.addEventListener("change", this.onOrientationChange);
    } else {
      // Legacy fallback for older Safari versions.
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      this.orientationMql.addListener(this.onOrientationChange);
    }
  }

  /** Tear down the MediaQueryList listener registered in setupPortraitWatch. */
  private releaseOrientationWatch(): void {
    if (this.orientationMql === undefined) {
      return;
    }
    if (typeof this.orientationMql.removeEventListener === "function") {
      this.orientationMql.removeEventListener("change", this.onOrientationChange);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      this.orientationMql.removeListener(this.onOrientationChange);
    }
    this.orientationMql = undefined;
  }

  /** Arrow-form so `this` binds correctly when used as an event listener. */
  private readonly onOrientationChange = (event: MediaQueryListEvent): void => {
    if (event.matches) {
      this.showPortraitOverlay();
    } else {
      this.hidePortraitOverlay();
    }
  };

  /** Build (lazily) and show the portrait-rotate overlay. */
  private showPortraitOverlay(): void {
    if (this.portraitOverlay !== undefined) {
      this.portraitOverlay.setVisible(true);
      return;
    }
    const { width, height } = this.scale;
    const dim = this.add
      .rectangle(width / 2, height / 2, width, height, this.hexToNumber(PALETTE_HEX.bgDialog), 0.85)
      .setScrollFactor(0);
    const label = this.add
      .text(width / 2, height / 2, t("touch.rotatePrompt"), {
        fontFamily: "monospace",
        fontSize: "24px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.portraitOverlay = this.add.container(0, 0, [dim, label]).setDepth(2000);
  }

  /** Hide the portrait overlay (don't destroy — recyclable on next portrait). */
  private hidePortraitOverlay(): void {
    this.portraitOverlay?.setVisible(false);
  }

  /** CSS hex string -> Phaser numeric color (0xRRGGBB). */
  private hexToNumber(hex: string): number {
    return Number.parseInt(hex.slice(1), 16);
  }

  // ---------- HUD (hearts + carrot count) ----------------------------------
  //
  // The HUD reads its initial values from the scene registry and subscribes
  // to change events on the keys LevelScene publishes.

  /**
   * Tile-sheet frame indices for the HUD glyphs. Tiles are 18×18 packed
   * 20-per-row on `icons-pixel-platformer-tiles`. These numbers are
   * eyeballed guesses on first pass — swap by inspecting the image
   * (`public/assets/tilemaps/kenney-pixel-platformer/tilemap_packed.png`)
   * and updating the literal. Index = `row × 20 + col` (0-based).
   */
  private static readonly HEART_FRAME = 44;
  private static readonly CARROT_HUD_FRAME = 67;
  /** Phaser asset key for the items-as-spritesheet declaration. */
  private static readonly ICONS_KEY = "icons-pixel-platformer-tiles";

  /** Build the hearts container + carrot counter + powerup timer; subscribe to registry. */
  private buildHud(): void {
    this.buildHearts(this.readLives());
    this.buildCarrotCounter(this.readCarrots());
    this.buildPowerTimer();

    // Re-render hearts when LevelScene publishes a new life count.
    this.registry.events.on(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_HERO_LIVES,
      (_parent: unknown, value: unknown) => {
        if (typeof value === "number") {
          this.buildHearts(value);
        }
      },
    );
    // Update the carrot counter text when count changes.
    this.registry.events.on(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_CARROT_COUNT,
      (_parent: unknown, value: unknown) => {
        if (typeof value === "number") {
          this.carrotCountText?.setText(this.formatCarrotCount(value));
        }
      },
    );
    // Update / hide the power-up timer as remaining ms changes.
    this.registry.events.on(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_POWERUP_REMAINING_MS,
      (_parent: unknown, value: unknown) => {
        if (typeof value === "number") {
          this.updatePowerTimer(value);
        }
      },
    );
  }

  /** Build (or rebuild) the hearts row. Replaces the previous container. */
  private buildHearts(lives: number): void {
    this.heartsContainer?.destroy();
    const heartSize = 18;
    const icons: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < Math.max(0, lives); i++) {
      const x = UI.heartsLeftPx + i * (heartSize + UI.heartsGapPx);
      const img = this.add.image(x, UI.heartsTopPx, UIScene.ICONS_KEY, UIScene.HEART_FRAME);
      img.setOrigin(0, 0);
      img.setScrollFactor(0);
      // Slight upscale so hearts read at arm's length on mobile.
      img.setScale(1.4);
      icons.push(img);
    }
    this.heartsContainer = this.add.container(0, 0, icons).setDepth(1000);
  }

  /** Build the carrot counter (icon + numeric text) once. */
  private buildCarrotCounter(initialCount: number): void {
    const icon = this.add.image(
      this.scale.width - UI.carrotsRightPx - 36,
      UI.carrotsTopPx,
      UIScene.ICONS_KEY,
      UIScene.CARROT_HUD_FRAME,
    );
    icon.setOrigin(0, 0);
    icon.setScrollFactor(0);
    icon.setScale(1.4);
    icon.setDepth(1000);

    this.carrotCountText = this.add
      .text(
        this.scale.width - UI.carrotsRightPx,
        UI.carrotsTopPx,
        this.formatCarrotCount(initialCount),
        {
          fontFamily: "monospace",
          fontSize: `${UI.hudFontSizePx.toString()}px`,
          color: PALETTE_HEX.textCream,
        },
      )
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  /** Format the carrot counter. Padded so the layout doesn't shift. */
  private formatCarrotCount(count: number): string {
    return `× ${count.toString().padStart(2, "0")}`;
  }

  /**
   * Build the power-up timer text (centered along the top). Hidden by
   * default; shown via updatePowerTimer when remaining ms > 0.
   */
  private buildPowerTimer(): void {
    this.powerTimerText = this.add
      .text(this.scale.width / 2, UI.powerTimerTopPx, "", {
        fontFamily: "monospace",
        fontSize: `${UI.hudFontSizePx.toString()}px`,
        color: PALETTE_HEX.uiPowerup,
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);
  }

  /**
   * Update the power-up timer text. Shows "⚡ N.Ns" while > 0, hides
   * when the timer expires.
   */
  private updatePowerTimer(remainingMs: number): void {
    if (this.powerTimerText === undefined) {
      return;
    }
    if (remainingMs <= 0) {
      this.powerTimerText.setVisible(false);
      return;
    }
    const seconds = (remainingMs / 1000).toFixed(1);
    this.powerTimerText.setText(`⚡ ${seconds}s`);
    this.powerTimerText.setVisible(true);
  }

  /** Read current life count from registry; fallback for first frame. */
  private readLives(): number {
    const v = this.registry.get(REGISTRY_KEY_HERO_LIVES) as unknown;
    return typeof v === "number" ? v : 3;
  }

  /** Read current carrot count from registry; fallback for first frame. */
  private readCarrots(): number {
    const v = this.registry.get(REGISTRY_KEY_CARROT_COUNT) as unknown;
    return typeof v === "number" ? v : 0;
  }
}
