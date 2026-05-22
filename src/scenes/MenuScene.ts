// -----------------------------------------------------------------------------
// carrot-code — MenuScene (demo title screen)
//
// First scene the player sees after BootScene finishes preloading.
// Responsibilities:
//   1. Show the game title + tagline + version badge.
//   2. Offer a clear "Play" affordance for keyboard, mouse, and touch.
//   3. Hand off to LevelScene with the requested levelId.
//
// Originally a stub (the vertical slice skipped MenuScene entirely).
// Graduated for the v0.1 cohort demo so first-impression has a framing
// frame instead of dropping cold into gameplay.
//
// Inputs that start the level:
//   - Keyboard: Enter or Space.
//   - Mouse: click the Play button (its larger invisible hit-zone).
//   - Touch: tap anywhere on the screen (whole-canvas hit-zone for
//     forgiving first-touch).
//
// Coexistence note:
//   UIScene is NOT launched from here. LevelScene launches it on entry,
//   keeping the menu visually clean (no HUD over the title).
//
// See:
//   src/scenes/BootScene.ts          — starts MenuScene after preload
//   src/scenes/LevelScene.ts         — launched by the Play button
//   src/i18n/en.ts                   — menu.* strings
//   .specify/memory/constitution.md  — Principles III + XI
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";
import { type LevelId } from "../data/levels/index.js";
import { t } from "../i18n/index.js";
import { canInstall, promptInstall } from "../pwa.js";

/** What MenuScene expects in its `init(data)` call. */
interface MenuSceneData {
  /** Level the Play button starts. Defaults to `"level-01"` when omitted. */
  readonly levelId?: LevelId;
}

/** Default level for the Play button (single-level v0). */
const DEFAULT_LEVEL_ID: LevelId = "level-01";

/** Detection: are we on a touch-capable device? Mirrors UIScene's check. */
function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/** Demo title screen — title, tagline, version badge, Play button. */
export class MenuScene extends Phaser.Scene {
  private levelId: LevelId = DEFAULT_LEVEL_ID;
  /** True once Play has fired; prevents double-start from chained inputs. */
  private started = false;
  /**
   * Optional install affordance (T056). Created hidden; the per-frame
   * update() shows it when `canInstall()` flips true and hides it after
   * the user accepts the prompt. Null when never created (e.g. test
   * scenes that skip `create()`).
   */
  private installLabel: Phaser.GameObjects.Text | null = null;

  public constructor() {
    super({ key: "MenuScene" });
  }

  /** Phaser hook — record which level to start when Play is pressed. */
  public init(data: MenuSceneData): void {
    this.levelId = data.levelId ?? DEFAULT_LEVEL_ID;
    this.started = false;
  }

  /** Phaser hook — render the title screen and wire input. */
  public create(): void {
    const { width, height } = this.scale;

    // Forest backdrop matches LevelScene's camera color so the boot →
    // menu → level transition is visually continuous.
    this.cameras.main.setBackgroundColor(this.hexToNumber(PALETTE_HEX.bgForest));

    // Subtle dim panel behind the title block for legibility regardless
    // of the eventual background art behind it.
    this.add
      .rectangle(
        width / 2,
        height / 2,
        Math.min(720, width - 64),
        320,
        this.hexToNumber(PALETTE_HEX.bgDialog),
        0.55,
      )
      .setOrigin(0.5);

    // Title — large, carrot-orange, centered. Original prose; Principle I.
    this.add
      .text(width / 2, height / 2 - 96, t("menu.title"), {
        fontFamily: "monospace",
        fontSize: "56px",
        color: PALETTE_HEX.uiCarrot,
        align: "center",
      })
      .setOrigin(0.5);

    // Tagline — narrator-voice one-liner. Sets the tone before the
    // first beat plays in-level.
    this.add
      .text(width / 2, height / 2 - 32, t("menu.tagline"), {
        fontFamily: "monospace",
        fontSize: "20px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5);

    // Version badge — explicit "feedback build" framing so the cohort
    // expects rough edges as wanted-signal, not as failures.
    this.add
      .text(width / 2, height / 2 + 4, t("menu.versionBadge"), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    // Build SHA + timestamp pinned bottom-right of the screen. Lets us
    // (and any cohort attendee) verify which build the SW is actually
    // serving — invaluable when the page looks "wrong" after a deploy
    // and the question is whether the browser cache served the new
    // build or an old one.
    this.add
      .text(width - 8, height - 8, `build ${__BUILD_SHA__} · ${__BUILD_TIMESTAMP__} UTC`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(1, 1)
      .setAlpha(0.45);

    // Play button — same pattern as GameOverScene (text + larger
    // invisible hit-zone behind it).
    const playLabel = this.add
      .text(width / 2, height / 2 + 64, t("menu.playButton"), {
        fontFamily: "monospace",
        fontSize: "28px",
        color: PALETTE_HEX.uiCarrot,
        align: "center",
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 24, y: 10 },
      })
      .setOrigin(0.5);

    const playHit = this.add
      .rectangle(width / 2, height / 2 + 64, 280, 64)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    playHit.on(Phaser.Input.Events.POINTER_OVER, () => {
      playLabel.setColor(PALETTE_HEX.textCream);
    });
    playHit.on(Phaser.Input.Events.POINTER_OUT, () => {
      playLabel.setColor(PALETTE_HEX.uiCarrot);
    });
    playHit.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.startLevel();
    });

    // Per-platform start hint under the button.
    const hintKey = isTouchDevice() ? "menu.startHintTouch" : "menu.startHintDesktop";
    this.add
      .text(width / 2, height / 2 + 120, t(hintKey), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    // Install affordance (T056). Created always but starts invisible;
    // update() shows it the moment canInstall() flips true and hides it
    // after install. Subtle styling (smaller than start hint, dimmer
    // than the title block) so it never competes with Play. Skipped
    // entirely on iOS / already-standalone where canInstall() will
    // never return true; the per-frame check is the gate.
    const installLabel = this.add
      .text(width / 2, height / 2 + 152, t("menu.installButton"), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5)
      .setAlpha(0.5)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    installLabel.on(Phaser.Input.Events.POINTER_OVER, () => {
      installLabel.setAlpha(1);
    });
    installLabel.on(Phaser.Input.Events.POINTER_OUT, () => {
      installLabel.setAlpha(0.5);
    });
    installLabel.on(Phaser.Input.Events.POINTER_DOWN, () => {
      // Fire and forget — the user's choice resolves async and we don't
      // need to do anything with it. update() will re-poll canInstall()
      // next frame and hide the label whether they accepted or dismissed
      // (the captured event is consumed either way per src/pwa.ts).
      void promptInstall();
    });
    this.installLabel = installLabel;

    // Keyboard fallback: Enter or Space starts the level. Use the
    // string event-name form ("keydown-ENTER") because the numeric
    // KeyCode form silently never fires (documented in repo memory).
    const kb = this.input.keyboard;
    if (kb !== null) {
      kb.once("keydown-ENTER", () => {
        this.startLevel();
      });
      kb.once("keydown-SPACE", () => {
        this.startLevel();
      });
    }

    // Touch "tap-anywhere-to-start" — forgiving first-touch for cohort
    // attendees who don't aim precisely at the Play button. Only on
    // touch devices; on desktop the Play button + keyboard cover it
    // and a global click-anywhere would feel imprecise.
    //
    // 400ms cooldown matters: when the page first loads, the user often
    // already has a finger on the screen (from swiping to this tab,
    // dismissing the URL bar, etc). Without a cooldown the very first
    // POINTER_DOWN fires startLevel() before the menu visibly draws,
    // and the cohort sees a flash of menu and then "the game" with no
    // idea there was a title. The cooldown lets the menu render +
    // settle before tap-anywhere arms.
    if (isTouchDevice()) {
      this.time.delayedCall(400, () => {
        if (this.started) {
          return;
        }
        this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
          this.startLevel();
        });
      });
    }
  }

  /**
   * Transition to LevelScene with the configured levelId. Idempotent:
   * a stray double-tap or Space-after-Enter still only starts once.
   */
  private startLevel(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.scene.start("LevelScene", { levelId: this.levelId });
  }

  /**
   * Phaser hook — runs every frame while the scene is active. Used
   * only to show / hide the install affordance based on the current
   * `canInstall()` value. The platform may fire `beforeinstallprompt`
   * AFTER `create()` has run (notably the very first page load), so a
   * one-shot check at create-time would miss it; per-frame polling is
   * the simplest reliable answer and the check itself is two reads of
   * module-scope state.
   */
  public override update(): void {
    if (this.installLabel === null) {
      return;
    }
    const shouldShow = canInstall();
    if (shouldShow !== this.installLabel.visible) {
      this.installLabel.setVisible(shouldShow);
    }
  }

  /** CSS hex string -> Phaser numeric color (0xRRGGBB). */
  private hexToNumber(hex: string): number {
    return Number.parseInt(hex.slice(1), 16);
  }
}
