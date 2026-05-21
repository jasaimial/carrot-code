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
import { t, type I18nKey } from "../i18n/index.js";

/** Possible end-of-run outcomes. */
export type GameOverOutcome = "complete" | "gameover";

/** What GameOverScene expects in its `init(data)`. */
interface GameOverSceneData {
  /** Which outcome the player reached. */
  readonly outcome: GameOverOutcome;
  /** Which level to restart on Play-again. */
  readonly levelId: LevelId;
}

/** Renders the end-of-run screen with a Play-again button. */
export class GameOverScene extends Phaser.Scene {
  private outcome: GameOverOutcome = "complete";
  private levelId: LevelId = "level-01";
  /** Idempotent guard so a double-input doesn't double-start the level. */
  private restarting = false;

  public constructor() {
    super({ key: "GameOverScene" });
  }

  /** Phaser hook — record the outcome + which level to restart. */
  public init(data: GameOverSceneData): void {
    this.outcome = data.outcome;
    this.levelId = data.levelId;
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
      .text(width / 2, height / 2 + 32, `▶  ${t("outcome.playAgain")}`, {
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
      this.restartLevel();
    });

    // Keyboard fallback: Enter or Space also restarts.
    // Phaser keyboard events are named after the KEY NAME ("ENTER"),
    // not the numeric KeyCode (13). Earlier version used .toString()
    // on the KeyCode and silently never fired.
    const kb = this.input.keyboard;
    if (kb !== null) {
      kb.once("keydown-ENTER", () => {
        this.restartLevel();
      });
      kb.once("keydown-SPACE", () => {
        this.restartLevel();
      });
    }
  }

  /**
   * Restart by stopping UIScene + LevelScene defensively (both may
   * already be stopped from endLevel's earlier teardown, but stop()
   * on an already-stopped scene is a safe no-op) and then starting
   * a fresh LevelScene with the same levelId. Assets are already in
   * Phaser's cache from the first boot, so the new LevelScene mounts
   * immediately without going back through BootScene.
   *
   * scene.start on the LevelScene key from this scene also stops
   * GameOverScene (Phaser's standard scene.start semantics).
   */
  private restartLevel(): void {
    // Idempotent guard: an ENTER + tap could otherwise double-fire.
    if (this.restarting) {
      return;
    }
    this.restarting = true;
    this.scene.stop("UIScene");
    this.scene.stop("LevelScene");
    this.scene.start("LevelScene", { levelId: this.levelId });
  }

  /** CSS hex string -> Phaser numeric color (0xRRGGBB). */
  private hexToNumber(hex: string): number {
    return Number.parseInt(hex.slice(1), 16);
  }
}
