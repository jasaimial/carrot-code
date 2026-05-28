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
import { REGISTRY_KEY_ACTIVE_PROFILE_KEY, REGISTRY_KEY_SAVE_SERVICE } from "../game.js";
import { t } from "../i18n/index.js";
import {
  LEGACY_PROFILE_KEY,
  type SaveService,
  SaveQuotaExceededError,
} from "../services/save-service.js";
import {
  CARROTS_PER_GEM,
  exchangeCarrotsForGems,
  exchangeGemsForCarrots,
} from "../systems/economy.js";
import { MAX_GEMS_PER_PROFILE, type SaveState } from "../types/save-state.js";

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

/** Demo title screen — title, tagline, version badge, Play button, Treasure Box. */
export class MenuScene extends Phaser.Scene {
  private levelId: LevelId = DEFAULT_LEVEL_ID;
  /** True once Play has fired; prevents double-start from chained inputs. */
  private started = false;
  /** Text node showing current carrot count in the Treasure Box panel. */
  private treasureCarrotsText: Phaser.GameObjects.Text | undefined;
  /** Text node showing current gem count in the Treasure Box panel. */
  private treasureGemsText: Phaser.GameObjects.Text | undefined;
  /** Text node showing owned abilities count + names. */
  private treasureAbilitiesText: Phaser.GameObjects.Text | undefined;
  /** Text node showing the active profile's handle. */
  private treasureProfileText: Phaser.GameObjects.Text | undefined;
  /** Transient feedback text below the exchange buttons (errors, etc). */
  private exchangeFeedbackText: Phaser.GameObjects.Text | undefined;
  /** Timer that auto-clears the exchange feedback after a few seconds. */
  private exchangeFeedbackTimer: Phaser.Time.TimerEvent | undefined;

  public constructor() {
    super({ key: "MenuScene" });
  }

  /** Phaser hook — record which level to start when Play is pressed. */
  public init(data: MenuSceneData): void {
    this.levelId = data.levelId ?? DEFAULT_LEVEL_ID;
    this.started = false;
    this.treasureCarrotsText = undefined;
    this.treasureGemsText = undefined;
    this.treasureAbilitiesText = undefined;
    this.treasureProfileText = undefined;
    this.exchangeFeedbackText = undefined;
    this.exchangeFeedbackTimer = undefined;
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
    //
    // The exchange buttons (top-right Treasure Box panel) consume
    // POINTER_DOWN events on themselves, so a tap on an exchange
    // button won't also start the level - Phaser's input bubbling
    // doesn't trigger the scene-level once-handler when an
    // interactive object handled the event first.
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

    // ---- Treasure Box panel + Exchange UI -----------------------------
    // Sits in the top-right of the screen so it doesn't compete with
    // the centered title block. Read-only display + two trade buttons.
    // The profile picker (separate PR) will add a "Switch player" button
    // here too.
    this.buildTreasurePanel();
    this.refreshTreasureDisplay();
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

  /** CSS hex string -> Phaser numeric color (0xRRGGBB). */
  private hexToNumber(hex: string): number {
    return Number.parseInt(hex.slice(1), 16);
  }

  // ---- Treasure Box + Exchange UI ----------------------------------------

  /**
   * Build the Treasure Box panel (top-right corner). Static layout +
   * empty text nodes; refreshTreasureDisplay populates the values.
   */
  private buildTreasurePanel(): void {
    const { width } = this.scale;
    // Panel anchor: top-right corner with comfortable inset.
    const panelW = 260;
    const panelH = 240;
    const panelRight = width - 16;
    const panelTop = 16;
    const panelCx = panelRight - panelW / 2;
    const panelCy = panelTop + panelH / 2;

    // Dim panel background.
    this.add
      .rectangle(panelCx, panelCy, panelW, panelH, this.hexToNumber(PALETTE_HEX.bgDialog), 0.7)
      .setOrigin(0.5)
      .setStrokeStyle(1, this.hexToNumber(PALETTE_HEX.textCream), 0.4);

    // Heading.
    this.add
      .text(panelCx, panelTop + 14, t("treasure.heading"), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE_HEX.uiCarrot,
      })
      .setOrigin(0.5, 0);

    // Profile handle line (smaller, below heading).
    this.treasureProfileText = this.add
      .text(panelCx, panelTop + 36, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.7);

    // Stat lines: carrots / gems / abilities count. Left-aligned.
    const statLeft = panelCx - panelW / 2 + 14;
    this.treasureCarrotsText = this.add
      .text(statLeft, panelTop + 64, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0, 0);
    this.treasureGemsText = this.add
      .text(statLeft, panelTop + 88, "", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0, 0);
    this.treasureAbilitiesText = this.add
      .text(statLeft, panelTop + 112, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0, 0)
      .setAlpha(0.85);

    // Exchange section.
    const tradeY = panelTop + 148;
    this.add
      .text(panelCx, tradeY, t("exchange.heading"), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.uiCarrot,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.85);

    this.buildExchangeButton(panelCx, tradeY + 22, t("exchange.toGems"), () => {
      this.handleCarrotsToGems();
    });
    this.buildExchangeButton(panelCx, tradeY + 52, t("exchange.toCarrots"), () => {
      this.handleGemsToCarrots();
    });

    // Feedback line under the buttons; empty until an action runs.
    this.exchangeFeedbackText = this.add
      .text(panelCx, panelTop + panelH - 12, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE_HEX.uiCarrot,
        align: "center",
      })
      .setOrigin(0.5, 1);
  }

  /** Build one exchange button (text + invisible hit zone). */
  private buildExchangeButton(cx: number, cy: number, label: string, onClick: () => void): void {
    const text = this.add
      .text(cx, cy, label, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.textCream,
        backgroundColor: PALETTE_HEX.bgForest,
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5);

    const hit = this.add
      .rectangle(cx, cy, 180, 26)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    hit.on(Phaser.Input.Events.POINTER_OVER, () => {
      text.setColor(PALETTE_HEX.uiCarrot);
    });
    hit.on(Phaser.Input.Events.POINTER_OUT, () => {
      text.setColor(PALETTE_HEX.textCream);
    });
    hit.on(Phaser.Input.Events.POINTER_DOWN, () => {
      onClick();
    });
  }

  /**
   * Refresh the displayed totals from SaveState. Called on scene mount
   * + after every successful exchange. Read-only.
   */
  private refreshTreasureDisplay(): void {
    const state = this.readActiveSaveState();
    this.treasureProfileText?.setText(`${t("treasure.profileLabel")}: ${state.profileHandle}`);
    this.treasureCarrotsText?.setText(
      `${t("treasure.carrotsLabel")}: ${state.currentCarrots.toString()}`,
    );
    this.treasureGemsText?.setText(`${t("treasure.gemsLabel")}: ${state.gems.toString()}`);
    const abilitiesLabel = t("treasure.abilitiesLabel");
    const abilitiesValue = state.abilities.length === 0 ? "none" : state.abilities.join(", ");
    this.treasureAbilitiesText?.setText(`${abilitiesLabel}: ${abilitiesValue}`);
  }

  /** Read the active profile's SaveState. Defensive fallback to EMPTY on failure. */
  private readActiveSaveState(): SaveState {
    const saveService = this.requireSaveService();
    const profileKey = this.activeProfileKey();
    if (saveService === undefined) {
      // No save service; show zeros so the panel doesn't look broken.
      return {
        version: 2,
        profileHandle: "guest",
        currentCarrots: 0,
        gems: 0,
        abilities: [],
        completedLevelIds: [],
        lastPlayedAtIso: new Date(0).toISOString(),
      };
    }
    try {
      return saveService.load(profileKey);
    } catch {
      return {
        version: 2,
        profileHandle: "guest",
        currentCarrots: 0,
        gems: 0,
        abilities: [],
        completedLevelIds: [],
        lastPlayedAtIso: new Date(0).toISOString(),
      };
    }
  }

  /** Handle a "convert 10 carrots → 1 gem" click. */
  private handleCarrotsToGems(): void {
    const state = this.readActiveSaveState();
    const result = exchangeCarrotsForGems(
      state.currentCarrots,
      state.gems,
      CARROTS_PER_GEM,
      MAX_GEMS_PER_PROFILE,
    );
    if (!result.ok) {
      this.showExchangeFeedback(this.exchangeErrorMessage(result.error));
      return;
    }
    this.commitExchange(state, result.outcome.newCarrots, result.outcome.newGems);
  }

  /** Handle a "convert 1 gem → 10 carrots" click. */
  private handleGemsToCarrots(): void {
    const state = this.readActiveSaveState();
    const result = exchangeGemsForCarrots(state.currentCarrots, state.gems, 1);
    if (!result.ok) {
      this.showExchangeFeedback(this.exchangeErrorMessage(result.error));
      return;
    }
    this.commitExchange(state, result.outcome.newCarrots, result.outcome.newGems);
  }

  /**
   * Write a successful exchange back to SaveState (atomically:
   * carrots and gems update together) and refresh the display.
   */
  private commitExchange(prevState: SaveState, newCarrots: number, newGems: number): void {
    const saveService = this.requireSaveService();
    if (saveService === undefined) {
      this.showExchangeFeedback(t("exchange.errorNotEnoughCarrots")); // best-effort; service should always be present
      return;
    }
    try {
      saveService.save(this.activeProfileKey(), {
        version: 2,
        profileHandle: prevState.profileHandle,
        currentCarrots: newCarrots,
        gems: newGems,
        abilities: prevState.abilities,
        completedLevelIds: prevState.completedLevelIds,
      });
      this.refreshTreasureDisplay();
    } catch (err) {
      if (err instanceof SaveQuotaExceededError) {
        this.showExchangeFeedback("Storage full — couldn't save");
      } else {
        this.showExchangeFeedback("Exchange failed");
      }
    }
  }

  /** Map an ExchangeError variant to user-facing text. */
  private exchangeErrorMessage(
    error:
      | "amount-not-positive"
      | "amount-not-integer"
      | "insufficient-carrots"
      | "insufficient-gems"
      | "amount-not-multiple-of-rate"
      | "would-exceed-gem-cap",
  ): string {
    switch (error) {
      case "insufficient-carrots":
        return t("exchange.errorNotEnoughCarrots");
      case "insufficient-gems":
        return t("exchange.errorNotEnoughGems");
      case "would-exceed-gem-cap":
        return t("exchange.errorGemCapReached");
      // The other variants are caller-precondition violations that the
      // UI shouldn't be able to trigger with the current single-tap
      // exchange buttons (always positive, always integer, always
      // multiple-of-rate). Fall through to a generic message.
      case "amount-not-positive":
      case "amount-not-integer":
      case "amount-not-multiple-of-rate":
        return "Exchange not allowed";
    }
  }

  /** Show transient feedback text under the exchange buttons; auto-clear after 3s. */
  private showExchangeFeedback(message: string): void {
    if (this.exchangeFeedbackText === undefined) {
      return;
    }
    this.exchangeFeedbackText.setText(message);
    this.exchangeFeedbackTimer?.remove(false);
    this.exchangeFeedbackTimer = this.time.delayedCall(3000, () => {
      this.exchangeFeedbackText?.setText("");
    });
  }

  /** Retrieve the SaveService from the registry. Undefined if boot failed. */
  private requireSaveService(): SaveService | undefined {
    return this.registry.get(REGISTRY_KEY_SAVE_SERVICE) as SaveService | undefined;
  }

  /** Resolve the active profile key from the registry. */
  private activeProfileKey(): string {
    const fromRegistry = this.registry.get(REGISTRY_KEY_ACTIVE_PROFILE_KEY) as unknown;
    return typeof fromRegistry === "string" && fromRegistry.length > 0
      ? fromRegistry
      : LEGACY_PROFILE_KEY;
  }
}
