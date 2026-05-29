// -----------------------------------------------------------------------------
// carrot-code — TreasureScene (v0.4 lobby)
//
// Full-screen lobby reached from StartScene (after profile pick) or from
// GameOverScene (post-level outcome). Replaces the cramped top-right
// Treasure Box panel of the v0.3 MenuScene with a full-screen layout
// that gives transactions room to breathe.
//
// Layout (top to bottom):
//   1. Header           — "Treasure Box" + welcome / outcome line.
//   2. Satchel + Box    — two big stat columns (current carrots vs gems).
//   3. Market           — two exchange buttons (10c→1g, 1g→10c).
//   4. Level select     — list of levels, locked vs unlocked vs cleared.
//   5. Hop In button    — bottom-right, explicit transition to LevelScene.
//   6. Switch Player    — bottom-left, route back to StartScene.
//
// Routes IN:
//   - From StartScene with `init({ levelId, outcome? })`. If outcome is
//     "complete" or "gameover", header shows the corresponding narrator
//     line (with carrot-count substitution).
//   - From GameOverScene with the same shape.
//
// Routes OUT:
//   - "Hop In" tap            → LevelScene with the selected level id.
//   - "Different player" tap  → StartScene (re-pick from the user list).
//
// First-time visit: the welcome line is replaced with the "your Treasure
// Box" tutorial beat. Tracked via a flag on the active profile's
// SaveState (added to v2 schema). When complete + gameover lines need
// to win over the tutorial, those take precedence.
//
// See:
//   src/scenes/StartScene.ts          — routes in for first launch
//   src/scenes/GameOverScene.ts       — routes in post-level
//   src/scenes/LevelScene.ts          — destination of the Hop In tap
//   src/systems/economy.ts            — pure exchange logic this calls
//   src/data/narrator-beats.ts        — getPostOutcomeLine()
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";
import { getPostOutcomeLine, type PostOutcome } from "../data/narrator-beats.js";
import { isLevelId, LEVEL_IDS, type LevelId } from "../data/levels/index.js";
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

/** Data accepted by TreasureScene.init. */
interface TreasureSceneData {
  /** Level the Hop In button will start. Defaults to first unlocked level. */
  readonly levelId?: LevelId;
  /** Outcome that brought us here (from GameOverScene). Optional. */
  readonly outcome?: PostOutcome;
  /** Carrot count to substitute into the outcome line. */
  readonly outcomeCarrots?: number;
}

/** Default level when no override is passed. */
const FALLBACK_LEVEL_ID: LevelId = "level-01";

/** Full-screen lobby between StartScene and LevelScene. */
export class TreasureScene extends Phaser.Scene {
  private selectedLevelId: LevelId = FALLBACK_LEVEL_ID;
  private outcome: PostOutcome | undefined;
  private outcomeCarrots = 0;
  private hopped = false;

  // Text nodes refreshed on save changes.
  private satchelCarrotsText: Phaser.GameObjects.Text | undefined;
  private boxGemsText: Phaser.GameObjects.Text | undefined;
  private marketFeedbackText: Phaser.GameObjects.Text | undefined;
  private marketFeedbackTimer: Phaser.Time.TimerEvent | undefined;
  // Level row state - mapped by LevelId so we can update visuals
  // in place on selection change rather than destroy + rebuild
  // (destroy-mid-pointer-event freezes Phaser's input system).
  private readonly levelRowBgs = new Map<LevelId, Phaser.GameObjects.Rectangle>();

  public constructor() {
    super({ key: "TreasureScene" });
  }

  /** Phaser hook — record level id + optional outcome. */
  public init(data: TreasureSceneData): void {
    this.selectedLevelId = data.levelId ?? FALLBACK_LEVEL_ID;
    this.outcome = data.outcome;
    this.outcomeCarrots = data.outcomeCarrots ?? 0;
    this.hopped = false;
    this.satchelCarrotsText = undefined;
    this.boxGemsText = undefined;
    this.marketFeedbackText = undefined;
    this.marketFeedbackTimer = undefined;
    this.levelRowBgs.clear();
  }

  /** Phaser hook — render the full lobby. */
  public create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(this.hexToNumber(PALETTE_HEX.bgForest));

    // Dim full-screen panel behind everything so any future bg art doesn't
    // fight the lobby content.
    this.add
      .rectangle(width / 2, height / 2, width, height, this.hexToNumber(PALETTE_HEX.bgDialog), 0.35)
      .setOrigin(0.5);

    const state = this.readActiveSaveState();
    const isLegacy = this.activeProfileKey() === LEGACY_PROFILE_KEY;

    // --- Header -----------------------------------------------------------
    this.add
      .text(width / 2, 20, t("lobby.heading"), {
        fontFamily: "monospace",
        fontSize: "26px",
        color: PALETTE_HEX.uiCarrot,
      })
      .setOrigin(0.5, 0);

    // Headline line under the heading: post-outcome wins; otherwise
    // welcome-back; first-time gets the tutorial.
    const headlineText = this.computeHeadlineText(state, isLegacy);
    this.add
      .text(width / 2, 56, headlineText, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: PALETTE_HEX.textCream,
        align: "center",
        wordWrap: { width: width - 80 },
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.9);

    // --- Satchel + Box columns -------------------------------------------
    const colY = 130;
    const leftCx = width * 0.28;
    const rightCx = width * 0.72;
    this.buildStatColumn(
      leftCx,
      colY,
      t("lobby.satchelHeading"),
      "🥕",
      state.currentCarrots,
      (txt) => {
        this.satchelCarrotsText = txt;
      },
    );
    this.buildStatColumn(rightCx, colY, t("lobby.boxHeading"), "💎", state.gems, (txt) => {
      this.boxGemsText = txt;
    });

    // Abilities row under the stat columns.
    this.add
      .text(
        width / 2,
        colY + 80,
        `${t("lobby.abilitiesHeading")}: ${state.abilities.length === 0 ? "none" : state.abilities.join(", ")}`,
        {
          fontFamily: "monospace",
          fontSize: "13px",
          color: PALETTE_HEX.textCream,
        },
      )
      .setOrigin(0.5, 0)
      .setAlpha(0.75);

    // --- Market -----------------------------------------------------------
    const marketY = 250;
    this.add
      .text(width / 2, marketY, t("lobby.marketHeading"), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE_HEX.uiCarrot,
      })
      .setOrigin(0.5, 0);

    this.buildMarketButton(leftCx, marketY + 32, "10 🥕  →  1 💎", () => {
      this.handleCarrotsToGems();
    });
    this.buildMarketButton(rightCx, marketY + 32, "1 💎  →  10 🥕", () => {
      this.handleGemsToCarrots();
    });

    this.marketFeedbackText = this.add
      .text(width / 2, marketY + 72, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE_HEX.uiCarrot,
        align: "center",
      })
      .setOrigin(0.5, 0);

    // --- Level select -----------------------------------------------------
    const levelY = 350;
    this.add
      .text(width / 2, levelY, t("lobby.levelHeading"), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE_HEX.uiCarrot,
      })
      .setOrigin(0.5, 0);

    this.buildLevelList(width / 2, levelY + 30, state);

    // --- Hop In + Switch Player ------------------------------------------
    this.buildHopInButton(width - 24, height - 24);
    this.buildSwitchPlayerButton(24, height - 24);
  }

  /** Compose the line under the heading based on outcome / first visit. */
  private computeHeadlineText(state: SaveState, _isLegacy: boolean): string {
    if (this.outcome !== undefined) {
      const raw = getPostOutcomeLine(this.outcome);
      return raw.replace("{N}", this.outcomeCarrots.toString());
    }
    // First-time visit when the profile is fresh = tutorial line.
    // Heuristic: lifetime gems = 0 AND no abilities AND no levels cleared.
    const isFreshProfile =
      state.gems === 0 && state.abilities.length === 0 && state.completedLevelIds.length === 0;
    if (isFreshProfile) {
      return t("lobby.firstTimeWelcome");
    }
    return t("lobby.welcomeBack").replace("{handle}", state.profileHandle);
  }

  /** Build one of the two big stat columns (Satchel / Box). */
  private buildStatColumn(
    cx: number,
    cy: number,
    heading: string,
    icon: string,
    value: number,
    storeText: (text: Phaser.GameObjects.Text) => void,
  ): void {
    this.add
      .text(cx, cy, heading, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: PALETTE_HEX.uiCarrot,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.9);

    const big = this.add
      .text(cx, cy + 22, `${icon} ${value.toString()}`, {
        fontFamily: "monospace",
        fontSize: "32px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0.5, 0);

    storeText(big);
  }

  /** Build one big market-exchange button. Text itself is the click target. */
  private buildMarketButton(cx: number, cy: number, label: string, onClick: () => void): void {
    const text = this.add
      .text(cx, cy, label, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE_HEX.textCream,
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 18, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    text.on(Phaser.Input.Events.POINTER_OVER, () => {
      text.setColor(PALETTE_HEX.uiCarrot);
    });
    text.on(Phaser.Input.Events.POINTER_OUT, () => {
      text.setColor(PALETTE_HEX.textCream);
    });
    text.on(Phaser.Input.Events.POINTER_DOWN, () => {
      onClick();
    });
  }

  /** Build the list of selectable levels under the Level header. */
  private buildLevelList(cx: number, topY: number, state: SaveState): void {
    const completed = new Set(state.completedLevelIds);

    // Auto-select smart default on first build.
    // Rule: if arriving from a level-complete outcome AND the next
    // level is now unlocked, prefer it over what was passed in.
    // Cohort UX feedback 2026-05-28: "it should automatically select
    // once a previous level is done".
    if (this.outcome === "complete") {
      const nextLevel = this.findNextUnlockedAfter(this.selectedLevelId, completed);
      if (nextLevel !== undefined) {
        this.selectedLevelId = nextLevel;
      }
    } else {
      // Always pick the highest unlocked level if the current selection
      // is locked (shouldn't normally happen, defensive).
      if (!this.isLevelUnlocked(this.selectedLevelId, completed)) {
        this.selectedLevelId = FALLBACK_LEVEL_ID;
      }
    }

    let y = topY;
    for (const id of LEVEL_IDS) {
      const isUnlocked = this.isLevelUnlocked(id, completed);
      const isCompleted = completed.has(id);
      this.buildLevelRow(cx, y, id, isUnlocked, isCompleted);
      y += 36;
    }
  }

  /**
   * Find the next unlocked level after `currentId` (going by LEVEL_IDS
   * order). Used by the auto-select logic on level-complete arrival.
   * Returns undefined if currentId is already the last level or the
   * next level isn't unlocked yet.
   */
  private findNextUnlockedAfter(
    currentId: LevelId,
    completed: ReadonlySet<string>,
  ): LevelId | undefined {
    const currentIdx = LEVEL_IDS.indexOf(currentId);
    if (currentIdx === -1 || currentIdx === LEVEL_IDS.length - 1) {
      return undefined;
    }
    const next = LEVEL_IDS[currentIdx + 1];
    if (next === undefined) {
      return undefined;
    }
    return this.isLevelUnlocked(next, completed) ? next : undefined;
  }

  /** True if this level is playable given current completedLevelIds. */
  private isLevelUnlocked(id: LevelId, completed: ReadonlySet<string>): boolean {
    // Level 01 is always unlocked. Level 02 requires level-01 completed.
    if (id === "level-01") {
      return true;
    }
    return completed.has("level-01");
  }

  /** Build one row of the level list. */
  private buildLevelRow(
    cx: number,
    cy: number,
    id: LevelId,
    isUnlocked: boolean,
    isCompleted: boolean,
  ): void {
    const rowW = 380;
    const rowH = 30;

    const bg = this.add
      .rectangle(cx, cy, rowW, rowH, this.hexToNumber(PALETTE_HEX.bgDialog), 0.5)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, this.hexToNumber(PALETTE_HEX.textCream), 0.3);

    const label = id === "level-01" ? "Level 1 — The Cartridge" : "Level 2 — The Twilight Forest";
    const statusSuffix = !isUnlocked
      ? ` (${t("lobby.levelLocked")})`
      : isCompleted
        ? `  ${t("lobby.levelCompleted")}`
        : "";

    this.add
      .text(cx - rowW / 2 + 14, cy + rowH / 2, `${label}${statusSuffix}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0, 0.5)
      .setAlpha(isUnlocked ? 1 : 0.4);

    if (isUnlocked) {
      bg.setInteractive({ useHandCursor: true });
      bg.on(Phaser.Input.Events.POINTER_DOWN, () => {
        // Just update selection state - do NOT destroy + rebuild rows
        // here. Destroying the bg rect mid-pointer-event freezes
        // Phaser's input system. Updating visuals in-place is safe.
        this.selectedLevelId = id;
        this.refreshLevelRowVisuals();
      });
    }

    // Track for later visual refresh. Even locked rows are tracked so
    // they show the dim state consistently.
    this.levelRowBgs.set(id, bg);

    // Apply initial selected-state visuals.
    this.applyRowSelectedVisuals(bg, id === this.selectedLevelId);
  }

  /**
   * Refresh every level row's selected-state visuals from the current
   * `selectedLevelId`. Cheap: just walks the Map and updates colors
   * + stroke; no GameObject creation or destruction.
   */
  private refreshLevelRowVisuals(): void {
    for (const [id, bg] of this.levelRowBgs) {
      this.applyRowSelectedVisuals(bg, id === this.selectedLevelId);
    }
  }

  /** Apply selected/unselected fill + stroke to a row's bg rectangle. */
  private applyRowSelectedVisuals(bg: Phaser.GameObjects.Rectangle, isSelected: boolean): void {
    bg.setFillStyle(
      this.hexToNumber(isSelected ? PALETTE_HEX.uiCarrot : PALETTE_HEX.bgDialog),
      isSelected ? 0.3 : 0.5,
    );
    bg.setStrokeStyle(
      isSelected ? 2 : 1,
      this.hexToNumber(isSelected ? PALETTE_HEX.uiCarrot : PALETTE_HEX.textCream),
      isSelected ? 1.0 : 0.3,
    );
  }

  /** Build the bottom-right Hop In button. The text itself is the click target. */
  private buildHopInButton(rightX: number, bottomY: number): void {
    const text = this.add
      .text(rightX, bottomY, t("lobby.hopInButton"), {
        fontFamily: "monospace",
        fontSize: "20px",
        color: PALETTE_HEX.uiCarrot,
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 20, y: 12 },
      })
      .setOrigin(1, 1)
      .setInteractive({ useHandCursor: true });

    text.on(Phaser.Input.Events.POINTER_OVER, () => {
      text.setColor(PALETTE_HEX.textCream);
    });
    text.on(Phaser.Input.Events.POINTER_OUT, () => {
      text.setColor(PALETTE_HEX.uiCarrot);
    });
    text.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.hopIntoWorld();
    });

    // Keyboard fallback: Enter or Space hops in.
    const kb = this.input.keyboard;
    if (kb !== null) {
      kb.once("keydown-ENTER", () => {
        this.hopIntoWorld();
      });
      kb.once("keydown-SPACE", () => {
        this.hopIntoWorld();
      });
    }
  }

  /** Build the bottom-left Switch Player button. The text itself is the click target. */
  private buildSwitchPlayerButton(leftX: number, bottomY: number): void {
    const text = this.add
      .text(leftX, bottomY, t("lobby.switchPlayer"), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.textCream,
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0, 1)
      .setAlpha(0.85)
      .setInteractive({ useHandCursor: true });

    text.on(Phaser.Input.Events.POINTER_OVER, () => {
      text.setColor(PALETTE_HEX.uiCarrot);
    });
    text.on(Phaser.Input.Events.POINTER_OUT, () => {
      text.setColor(PALETTE_HEX.textCream);
    });
    text.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.hopped) return;
      this.hopped = true;
      // Defer scene.start to next tick — same input-dispatcher
      // race as hopIntoWorld (see its doc comment).
      this.time.delayedCall(0, () => {
        this.scene.start("StartScene");
      });
    });
  }

  /**
   * Validate level id + hop into LevelScene. Idempotent.
   *
   * scene.start is deferred to the next tick via time.delayedCall(0).
   * Calling scene.start synchronously from a POINTER_DOWN handler
   * leaves Phaser's input dispatcher in a state where NO subsequent
   * input registers (whole-scene freeze). Same footgun pattern as
   * GameOverScene.restartLevel (PR #5 + repo memory note).
   */
  private hopIntoWorld(): void {
    if (this.hopped) {
      return;
    }
    // Re-check unlock at hop time in case the selection isn't valid.
    const state = this.readActiveSaveState();
    const completed = new Set(state.completedLevelIds);
    const targetId = this.isLevelUnlocked(this.selectedLevelId, completed)
      ? this.selectedLevelId
      : FALLBACK_LEVEL_ID;
    if (!isLevelId(targetId)) {
      return;
    }
    this.hopped = true;
    this.time.delayedCall(0, () => {
      this.scene.start("LevelScene", { levelId: targetId });
    });
  }

  // ---- Market actions (use pure economy.ts) ------------------------------

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
      this.showMarketFeedback(this.exchangeErrorMessage(result.error));
      return;
    }
    this.commitExchange(state, result.outcome.newCarrots, result.outcome.newGems);
  }

  /** Handle a "convert 1 gem → 10 carrots" click. */
  private handleGemsToCarrots(): void {
    const state = this.readActiveSaveState();
    const result = exchangeGemsForCarrots(state.currentCarrots, state.gems, 1);
    if (!result.ok) {
      this.showMarketFeedback(this.exchangeErrorMessage(result.error));
      return;
    }
    this.commitExchange(state, result.outcome.newCarrots, result.outcome.newGems);
  }

  /** Write a successful exchange + refresh displayed totals. */
  private commitExchange(prevState: SaveState, newCarrots: number, newGems: number): void {
    const saveService = this.requireSaveService();
    if (saveService === undefined) {
      this.showMarketFeedback("Save service unavailable");
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
      this.satchelCarrotsText?.setText(`🥕 ${newCarrots.toString()}`);
      this.boxGemsText?.setText(`💎 ${newGems.toString()}`);
    } catch (err) {
      this.showMarketFeedback(
        err instanceof SaveQuotaExceededError ? "Storage full" : "Exchange failed",
      );
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
        return t("lobby.exchangeError.notEnoughCarrots");
      case "insufficient-gems":
        return t("lobby.exchangeError.notEnoughGems");
      case "would-exceed-gem-cap":
        return t("lobby.exchangeError.gemCapReached");
      case "amount-not-positive":
      case "amount-not-integer":
      case "amount-not-multiple-of-rate":
        return "Exchange not allowed";
    }
  }

  /** Show transient feedback text under the market buttons; auto-clear. */
  private showMarketFeedback(message: string): void {
    if (this.marketFeedbackText === undefined) {
      return;
    }
    this.marketFeedbackText.setText(message);
    this.marketFeedbackTimer?.remove(false);
    this.marketFeedbackTimer = this.time.delayedCall(3000, () => {
      this.marketFeedbackText?.setText("");
    });
  }

  // ---- Helpers -----------------------------------------------------------

  /** Read the active profile's SaveState. Falls back to EMPTY on failure. */
  private readActiveSaveState(): SaveState {
    const saveService = this.requireSaveService();
    const profileKey = this.activeProfileKey();
    if (saveService === undefined) {
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

  /** Retrieve the SaveService from the registry. */
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

  /** CSS hex string -> Phaser numeric color (0xRRGGBB). */
  private hexToNumber(hex: string): number {
    return Number.parseInt(hex.slice(1), 16);
  }
}
