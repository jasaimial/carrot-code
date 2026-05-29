// -----------------------------------------------------------------------------
// carrot-code — Game-over / level-complete scene (T036)
//
// Two-outcome end-of-run scene. Receives `{ outcome, levelId }` in
// `init(data)`:
//
//   - "complete" — hero touched the end-trigger (FR-024). Shows the
//     localized "Level complete!" headline.
//   - "gameover" — hero ran out of lives (FR-025). Shows "Game over".
//     (Hero-death is not wired in v0; that's US2 enemy-contact work.
//      Today only the "complete" path actually fires.)
//
// Either way the Play-again button restarts LevelScene with the same
// `levelId`. Spec Story 1 acceptance #4.
//
// See:
//   src/scenes/LevelScene.ts        — fires "complete" on end-trigger
//   src/i18n/en.ts                   — outcome.* + outcome.playAgain
//   .specify/memory/constitution.md  — Principles III + XI
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";
import { type LevelId } from "../data/levels/index.js";
import { REGISTRY_KEY_ACTIVE_PROFILE_KEY } from "../game.js";
import { t, type I18nKey } from "../i18n/index.js";
import { GUEST_PROFILE_KEY } from "../services/save-service.js";

/** Possible end-of-run outcomes. */
export type GameOverOutcome = "complete" | "gameover";

/** What GameOverScene expects in its `init(data)`. */
interface GameOverSceneData {
  /** Which outcome the player reached. */
  readonly outcome: GameOverOutcome;
  /** Which level to restart on Play-again. */
  readonly levelId: LevelId;
  /** Carrots in the satchel at outcome time (for the post-outcome line). */
  readonly outcomeCarrots?: number;
}

/** Renders the end-of-run screen with a Continue button. */
export class GameOverScene extends Phaser.Scene {
  private outcome: GameOverOutcome = "complete";
  private levelId: LevelId = "level-01";
  private outcomeCarrots = 0;
  /** Idempotent guard so a double-input doesn't double-start the level. */
  private restarting = false;

  public constructor() {
    super({ key: "GameOverScene" });
  }

  /** Phaser hook — record the outcome + which level to restart + carrot count. */
  public init(data: GameOverSceneData): void {
    this.outcome = data.outcome;
    this.levelId = data.levelId;
    this.outcomeCarrots = data.outcomeCarrots ?? 0;
    this.restarting = false;
  }

  /** Phaser hook — render headline + Play-again button. */
  public create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(this.hexToNumber(PALETTE_HEX.bgForest));

    // Dim panel behind the text for legibility on any background.
    this.add
      .rectangle(
        width / 2,
        height / 2,
        Math.min(540, width - 64),
        220,
        this.hexToNumber(PALETTE_HEX.bgDialog),
        0.85,
      )
      .setOrigin(0.5);

    const headlineKey: I18nKey =
      this.outcome === "complete" ? "outcome.levelComplete" : "outcome.gameOver";
    this.add
      .text(width / 2, height / 2 - 36, t(headlineKey), {
        fontFamily: "monospace",
        fontSize: "32px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5);

    const playAgain = this.add
      .text(width / 2, height / 2 + 32, `▶  ${t("outcome.continueButton")}`, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: PALETTE_HEX.uiCarrot,
        align: "center",
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5);

    // Use a larger invisible rectangle behind the text as the hit area
    // so the button is easy to click/tap (a text-only hit area is the
    // tight glyph bounds, which is fiddly on desktop and unusable on
    // touch). The visible text stays on top for the user; the hit zone
    // is what receives input.
    const hitZone = this.add
      .rectangle(width / 2, height / 2 + 32, 260, 56)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    hitZone.on(Phaser.Input.Events.POINTER_OVER, () => {
      playAgain.setColor(PALETTE_HEX.textCream);
    });
    hitZone.on(Phaser.Input.Events.POINTER_OUT, () => {
      playAgain.setColor(PALETTE_HEX.uiCarrot);
    });
    hitZone.on(Phaser.Input.Events.POINTER_DOWN, () => {
      // Immediate visual feedback so the user sees their tap was
      // received, even before the scene transition runs.
      playAgain.setColor(PALETTE_HEX.textCream);
      playAgain.setText(`▶  ${t("outcome.restarting")}`);
      this.restartLevel();
    });

    // Keyboard fallback: Enter or Space also restarts.
    // Phaser keyboard events are named after the KEY NAME ("ENTER"),
    // not the numeric KeyCode (13). Earlier version used .toString()
    // on the KeyCode and silently never fired.
    const kb = this.input.keyboard;
    if (kb !== null) {
      kb.once("keydown-ENTER", () => {
        playAgain.setText(`▶  ${t("outcome.restarting")}`);
        this.restartLevel();
      });
      kb.once("keydown-SPACE", () => {
        playAgain.setText(`▶  ${t("outcome.restarting")}`);
        this.restartLevel();
      });
    }
  }

  /**
   * Restart the level by handing off to LevelScene with the same
   * levelId. Two Phaser footguns avoided here:
   *
   *   1. We do NOT call `scene.stop("LevelScene")` or
   *      `scene.stop("UIScene")` before `scene.start("LevelScene")`.
   *      LevelScene + UIScene are both already in STOPPED state at
   *      this point (LevelScene's endLevel transitioned to
   *      GameOverScene, which Phaser implements by shutting down the
   *      calling scene). Calling stop() on an already-STOPPED scene
   *      in the SAME frame as a subsequent start() can leave Phaser's
   *      scene state queue in an inconsistent state where PENDING_STOP
   *      wins the race and start() silently becomes a no-op - the
   *      symptom being a button that visibly responds (color flips,
   *      "Restarting…" text appears) but no actual transition.
   *      Confirmed broken on Phaser 4.1 iOS Safari 2026-05-21.
   *
   *   2. We DEFER the start by one tick via `time.delayedCall(0)`.
   *      Calling scene.start synchronously inside a pointerdown
   *      handler runs while Phaser is mid-input-dispatch; the start
   *      gets queued but the queued ops from the current frame
   *      (input-dispatch finalize, etc.) can race with it.
   *      delayedCall(0) yields to the next tick where Phaser's
   *      scene queue is empty and the start runs clean.
   *
   * v0.4 routing: real profiles continue to TreasureScene (lobby);
   * guest profiles replay LevelScene directly (no Treasure Box to
   * visit). Both paths use the same delayed-start guard.
   */
  private restartLevel(): void {
    if (this.restarting) {
      return;
    }
    this.restarting = true;
    const profileKey = this.registry.get(REGISTRY_KEY_ACTIVE_PROFILE_KEY) as unknown;
    const isGuest = profileKey === GUEST_PROFILE_KEY;
    this.time.delayedCall(0, () => {
      if (isGuest) {
        // Guests skip the lobby; replay the same level.
        this.scene.start("LevelScene", { levelId: this.levelId });
      } else {
        // Real profiles return to the lobby with the outcome line on top.
        this.scene.start("TreasureScene", {
          levelId: this.levelId,
          outcome: this.outcome,
          outcomeCarrots: this.outcomeCarrots,
        });
      }
    });
  }

  /** CSS hex string -> Phaser numeric color (0xRRGGBB). */
  private hexToNumber(hex: string): number {
    return Number.parseInt(hex.slice(1), 16);
  }
}
