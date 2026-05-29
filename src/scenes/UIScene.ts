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
import { REGISTRY_KEY_ACTIVE_PROFILE_KEY, REGISTRY_KEY_SAVE_SERVICE } from "../game.js";
import { t } from "../i18n/index.js";
import { LEGACY_PROFILE_KEY, type SaveService } from "../services/save-service.js";
import { REGISTRY_KEY_SOUND_FX, type SoundFx } from "../systems/sound-fx.js";
import { REGISTRY_KEY_TOUCH_INPUT, TouchInputStore } from "../systems/touch-input-store.js";

import {
  REGISTRY_KEY_CARROT_COUNT,
  REGISTRY_KEY_HERO_LIVES,
  REGISTRY_KEY_NARRATOR_TEXT,
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
  /** Container holding the narrator dialog box. Built lazily. */
  private narratorContainer: Phaser.GameObjects.Container | undefined;
  /** The body text inside the narrator dialog box. */
  private narratorBodyText: Phaser.GameObjects.Text | undefined;
  /** Whether a narrator dialog is currently visible. */
  private narratorVisible = false;
  /** Container for the first-input controls hint (auto-fades out). */
  private controlsHintContainer: Phaser.GameObjects.Container | undefined;
  /** Auto-fade-out timer for the controls hint (canceled on first input). */
  private controlsHintTimer: Phaser.Time.TimerEvent | undefined;
  /** True once the controls hint has been dismissed (any-cause); blocks re-trigger. */
  private controlsHintDismissed = false;
  /** Text object for the audio mute toggle button. */
  private muteToggleText: Phaser.GameObjects.Text | undefined;

  // Bound registry-event handlers. Stored so we can `off` them in
  // shutdown() — otherwise stale listeners survive Play-again and
  // fire against destroyed game objects (drawImage on null crash).
  //
  // Each handler is double-guarded:
  //   1. `this.scene.isActive()` skips the handler when this UIScene
  //      instance is between scenes (post-shutdown, pre-create).
  //      Phaser's scene.stop is queued, not synchronous, so a
  //      registry write from a sibling scene's init() can fire a
  //      handler in the window between stop being requested and
  //      shutdown actually running.
  //   2. Each GameObject reference is checked with `.active` before
  //      operating on it. A destroyed-but-not-nulled GameObject has
  //      `active === false` and a null underlying texture; calling
  //      `setText` on such an object crashes inside Phaser's
  //      drawImage path. Reference-cleared on shutdown.
  private readonly onLivesChanged = (_p: unknown, value: unknown): void => {
    if (!this.scene.isActive()) {
      return;
    }
    if (typeof value === "number") {
      this.buildHearts(value);
    }
  };
  private readonly onCarrotsChanged = (_p: unknown, value: unknown): void => {
    if (!this.scene.isActive()) {
      return;
    }
    if (typeof value === "number" && this.carrotCountText?.active === true) {
      this.carrotCountText.setText(this.formatCarrotCount(value));
    }
  };
  private readonly onPowerChanged = (_p: unknown, value: unknown): void => {
    if (!this.scene.isActive()) {
      return;
    }
    if (typeof value === "number") {
      this.updatePowerTimer(value);
    }
  };
  private readonly onNarratorChanged = (_p: unknown, value: unknown): void => {
    if (!this.scene.isActive()) {
      return;
    }
    if (typeof value !== "string") {
      return;
    }
    if (value === "") {
      this.hideNarrator();
    } else {
      this.showNarrator(value);
    }
  };

  public constructor() {
    super({ key: "UIScene" });
  }

  /** Phaser hook — build touch controls if applicable + start orientation watch. */
  public create(): void {
    this.store = this.requireTouchStore();

    // HUD (hearts + carrot count) renders on both desktop and mobile.
    this.buildHud();

    // First-input controls hint (auto-dismisses on first move/jump or
    // after a few seconds). Reset on every UIScene create so it
    // re-shows on Play-again — cheap, and an attendee who replays a
    // minute later may have forgotten the keymap.
    this.controlsHintDismissed = false;
    this.showControlsHint();

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
    // THROW button stacked above JUMP so right-thumb users can reach
    // both without moving the thumb across the screen.
    this.buildButton(
      this.scale.width - UI.touchThrowButtonRightPx,
      this.scale.height - UI.touchThrowButtonBottomPx,
      t("touch.throw"),
      (down) => this.store?.setThrow(down),
      UI.touchThrowButtonLabelFontSizePx,
    );

    this.setupPortraitWatch();
    this.tryLockLandscape();
  }

  /** Phaser hook — clean up the MediaQueryList listener. */
  public shutdown(): void {
    this.releaseOrientationWatch();
    // Cancel the controls-hint timer if it's still pending; otherwise
    // it fires against this destroyed scene's GameObjects.
    this.controlsHintTimer?.remove(false);
    this.controlsHintTimer = undefined;
    this.controlsHintContainer?.destroy();
    this.controlsHintContainer = undefined;
    // Remove registry-event listeners; otherwise they fire after
    // restart against this destroyed scene's GameObjects.
    this.registry.events.off(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_HERO_LIVES,
      this.onLivesChanged,
    );
    this.registry.events.off(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_CARROT_COUNT,
      this.onCarrotsChanged,
    );
    this.registry.events.off(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_POWERUP_REMAINING_MS,
      this.onPowerChanged,
    );
    this.registry.events.off(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_NARRATOR_TEXT,
      this.onNarratorChanged,
    );
    // Null every GameObject reference so any handler that did get
    // through the off() call (e.g. mid-flight emit from a registry
    // write earlier in the same frame as shutdown) hits the
    // optional-chain bail-out instead of touching a destroyed object.
    this.heartsContainer = undefined;
    this.carrotCountText = undefined;
    this.powerTimerText = undefined;
    this.narratorContainer = undefined;
    this.narratorBodyText = undefined;
    this.narratorVisible = false;
    this.muteToggleText = undefined;
    // Clear the touch store so a returning desktop player after restart
    // doesn't see stale touch flags.
    this.store?.setLeft(false);
    this.store?.setRight(false);
    this.store?.setJump(false);
    this.store?.consumeJumpPressed();
    this.store?.setThrow(false);
    this.store?.consumeThrowPressed();
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
    fontSizeOverridePx?: number,
  ): void {
    const size = UI.touchButtonSizePx;
    const fillColor = this.hexToNumber(PALETTE_HEX.bgDialog);

    const bg = this.add
      .rectangle(cx, cy, size, size, fillColor, UI.touchButtonOpacity)
      .setStrokeStyle(2, this.hexToNumber(PALETTE_HEX.textCream), 0.6)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: false });

    const fontSizePx = fontSizeOverridePx ?? UI.touchButtonLabelFontSizePx;
    const text = this.add
      .text(cx, cy, label, {
        fontFamily: "monospace",
        fontSize: `${fontSizePx.toString()}px`,
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
    this.buildGemCounter();
    this.buildPowerTimer();
    this.buildMuteToggle();
    this.setupNarratorSubscription();

    // Re-render hearts when LevelScene publishes a new life count.
    this.registry.events.on(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_HERO_LIVES,
      this.onLivesChanged,
    );
    // Update the carrot counter text when count changes.
    this.registry.events.on(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_CARROT_COUNT,
      this.onCarrotsChanged,
    );
    // Update / hide the power-up timer as remaining ms changes.
    this.registry.events.on(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_POWERUP_REMAINING_MS,
      this.onPowerChanged,
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
   * Build the gem counter below the carrot counter. Read once from
   * SaveState on mount; gems don't change during play (only in the
   * Treasure Box / market in TreasureScene), so no registry watch.
   *
   * Surfaces the conservation thesis during play: the kid sees their
   * gems alongside their per-run carrots, so "the thing I'm keeping"
   * stays visible while "the thing I might spend" is also in view.
   */
  private buildGemCounter(): void {
    const gems = this.readGemsFromSave();
    // Position: one line below the carrot counter.
    const y = UI.carrotsTopPx + 24;
    // Same right-edge alignment as carrot counter; gem emoji acts as
    // the icon (we don't have a gem sprite in the existing Kenney
    // icons-pixel-platformer-tiles sheet at a frame index we know is
    // gem-shaped, so the emoji is the safer choice here).
    this.add
      .text(this.scale.width - UI.carrotsRightPx, y, `💎 ${gems.toString()}`, {
        fontFamily: "monospace",
        fontSize: `${UI.hudFontSizePx.toString()}px`,
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setAlpha(0.9);
  }

  /** Read the active profile's gem count from SaveService. 0 on any failure. */
  private readGemsFromSave(): number {
    const saveService = this.registry.get(REGISTRY_KEY_SAVE_SERVICE) as SaveService | undefined;
    if (saveService === undefined) {
      return 0;
    }
    const profileKey = this.registry.get(REGISTRY_KEY_ACTIVE_PROFILE_KEY) as unknown;
    const key =
      typeof profileKey === "string" && profileKey.length > 0 ? profileKey : LEGACY_PROFILE_KEY;
    try {
      return saveService.load(key).gems;
    } catch {
      return 0;
    }
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

  /**
   * Build the audio mute toggle button. Sits bottom-right with a low
   * background opacity so it doesn't fight HUD elements; small enough
   * to ignore but reachable on both desktop and touch. Persists
   * across Play-again because the SoundFx instance lives on the
   * (game-wide) registry, not the scene.
   */
  private buildMuteToggle(): void {
    const soundFx = this.requireSoundFx();
    if (soundFx === undefined) {
      // No audio service registered (test harness, very old browser).
      // Skip the button to avoid a useless visible element.
      return;
    }
    const x = this.scale.width - 28;
    const y = this.scale.height - 28;
    const labelKey = soundFx.isMuted() ? "audio.muted" : "audio.unmuted";
    this.muteToggleText = this.add
      .text(x, y, t(labelKey), {
        fontFamily: "monospace",
        fontSize: "22px",
        color: PALETTE_HEX.textCream,
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1100)
      .setAlpha(0.7)
      .setInteractive({ useHandCursor: true });

    this.muteToggleText.on(Phaser.Input.Events.POINTER_DOWN, () => {
      const muted = soundFx.toggleMuted();
      this.muteToggleText?.setText(t(muted ? "audio.muted" : "audio.unmuted"));
    });
  }

  /**
   * Retrieve the shared SoundFx. Returns undefined when missing (test
   * harness, very old browser without WebAudio). Mute toggle bails
   * silently if the service isn't present.
   */
  private requireSoundFx(): SoundFx | undefined {
    return this.registry.get(REGISTRY_KEY_SOUND_FX) as SoundFx | undefined;
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

  // ---------- Narrator dialog (T049) ---------------------------------------

  /** Watch the narrator text registry key and show/hide accordingly. */
  private setupNarratorSubscription(): void {
    this.registry.events.on(
      Phaser.Data.Events.CHANGE_DATA_KEY + REGISTRY_KEY_NARRATOR_TEXT,
      this.onNarratorChanged,
    );
    // Surface an already-active beat if UIScene launches after LevelScene
    // has already published one (e.g. fast spawn + delayMs == 0).
    const initial = this.registry.get(REGISTRY_KEY_NARRATOR_TEXT) as unknown;
    if (typeof initial === "string" && initial !== "") {
      this.showNarrator(initial);
    }
  }

  /** Lazily build the dialog container; subsequent calls just update text. */
  private showNarrator(text: string): void {
    if (this.narratorContainer === undefined) {
      this.buildNarratorContainer();
    }
    this.narratorBodyText?.setText(text);
    this.narratorContainer?.setVisible(true);
    this.narratorVisible = true;
  }

  /** Hide the dialog (kept around for reuse on the next beat). */
  private hideNarrator(): void {
    this.narratorContainer?.setVisible(false);
    this.narratorVisible = false;
  }

  /** Build the dialog box + dismiss affordance + input wiring. */
  private buildNarratorContainer(): void {
    const { width, height } = this.scale;
    const boxW = Math.min(width - 32, 520);
    const boxH = 96;
    const cx = width / 2;
    const cy = height - boxH / 2 - 16;

    const bg = this.add
      .rectangle(cx, cy, boxW, boxH, this.hexToNumber(PALETTE_HEX.bgDialog), 0.92)
      .setStrokeStyle(2, this.hexToNumber(PALETTE_HEX.textCream), 0.8)
      .setScrollFactor(0);

    this.narratorBodyText = this.add
      .text(cx, cy - 12, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE_HEX.textCream,
        align: "center",
        wordWrap: { width: boxW - 24 },
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0);

    const hintKey = this.add
      .text(cx, cy + boxH / 2 - 14, t("dialog.dismissKey"), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0.85)
      .setScrollFactor(0);

    // Make the whole box tap-to-dismiss on touch (and click on desktop).
    bg.setInteractive({ useHandCursor: true });
    bg.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.dismissNarrator();
    });

    // Keyboard: Space / Enter dismisses while dialog is visible.
    if (this.input.keyboard !== null) {
      this.input.keyboard.on("keydown-SPACE", () => {
        if (this.narratorVisible) {
          this.dismissNarrator();
        }
      });
      this.input.keyboard.on("keydown-ENTER", () => {
        if (this.narratorVisible) {
          this.dismissNarrator();
        }
      });
    }

    this.narratorContainer = this.add
      .container(0, 0, [bg, this.narratorBodyText, hintKey])
      .setDepth(1500);
  }

  /** Clear the registry key so LevelScene knows the beat was dismissed. */
  private dismissNarrator(): void {
    if (!this.narratorVisible) {
      return;
    }
    this.registry.set(REGISTRY_KEY_NARRATOR_TEXT, "");
  }

  // ---------- First-input controls hint -----------------------------------
  //
  // Shown briefly on every level mount so a first-time player (or a
  // returning attendee on their second run) sees the controls without
  // having to guess. Auto-dismisses on:
  //   1. Any keyboard input (any keydown).
  //   2. Any pointer/touch input anywhere on the canvas.
  //   3. A 4-second timeout (defensive: if for some reason no input
  //      arrives, the hint still goes away on its own).
  // Whichever happens first.
  //
  // Position: upper-middle of the screen (y ~ 28% of height) so it
  // doesn't fight with the top HUD (hearts / carrots / powerup timer)
  // or the bottom narrator dialog. Fades out via a tween so the
  // dismissal feels intentional rather than abrupt.

  /** Build the controls hint container + wire dismissal triggers. */
  private showControlsHint(): void {
    const { width, height } = this.scale;
    const hintText = isTouchDevice() ? t("hint.controlsTouch") : t("hint.controlsKeyboard");
    const cx = width / 2;
    const cy = Math.round(height * 0.28);

    const text = this.add
      .text(cx, cy, hintText, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE_HEX.textCream,
        align: "center",
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.controlsHintContainer = this.add.container(0, 0, [text]).setDepth(1500);

    // Auto-dismiss after 4s if the player hasn't moved yet.
    this.controlsHintTimer = this.time.delayedCall(4000, () => {
      this.dismissControlsHint();
    });

    // Dismiss on first keyboard input. `once` removes the listener
    // after firing, so subsequent keypresses don't re-trigger.
    if (this.input.keyboard !== null) {
      this.input.keyboard.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, () => {
        this.dismissControlsHint();
      });
    }

    // Dismiss on first pointer/touch input anywhere AFTER a 600ms
    // cooldown. Without the cooldown, the same touch that crosses
    // from MenuScene into LevelScene fires POINTER_DOWN here and
    // dismisses the hint before the player can read it. The 600ms
    // gives the transition + frame time for the player to register
    // they're now in the level. Keyboard / touch-button taps after
    // the cooldown dismiss as intended.
    this.time.delayedCall(600, () => {
      if (this.controlsHintDismissed) {
        return;
      }
      this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
        this.dismissControlsHint();
      });
    });
  }

  /** Fade the controls hint out and tear it down. Idempotent. */
  private dismissControlsHint(): void {
    if (this.controlsHintDismissed) {
      return;
    }
    this.controlsHintDismissed = true;
    this.controlsHintTimer?.remove(false);
    this.controlsHintTimer = undefined;

    const container = this.controlsHintContainer;
    if (container === undefined) {
      return;
    }
    this.tweens.add({
      targets: container,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        container.destroy();
        if (this.controlsHintContainer === container) {
          this.controlsHintContainer = undefined;
        }
      },
    });
  }
}
