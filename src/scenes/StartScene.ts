// -----------------------------------------------------------------------------
// carrot-code — StartScene (v0.4)
//
// First scene the player sees after BootScene finishes preloading.
// Replaces the old MenuScene-as-everything pattern with a focused
// landing page: title, tagline, and a clear list of who can play.
//
// Routes:
//   - Existing profile row tap   → set active profile + go to TreasureScene
//   - "+ New player"             → create-new flow (prompt + show phrase)
//                                  → set active profile + go to TreasureScene
//   - "Restore with phrase"      → restore flow (handle + phrase)
//                                  → set active profile + go to TreasureScene
//   - "Play as guest"            → set active profile to GUEST_PROFILE_KEY
//                                  → SKIP TreasureScene, go straight to LevelScene
//                                  (guest has no Treasure Box, no exchange)
//
// Guest cleanup: any prior _guest save slot is wiped on scene mount so
// guest progress never persists across launches. Even mid-session writes
// to the guest key happen normally; they just don't survive next launch.
//
// See:
//   src/scenes/BootScene.ts          — starts StartScene after preload
//   src/scenes/TreasureScene.ts      — Treasure Box lobby for real profiles
//   src/services/profile-service.ts  — handle / phrase / hash helpers
//   src/services/save-service.ts     — LEGACY_PROFILE_KEY + GUEST_PROFILE_KEY
//   .specify/memory/constitution.md  — Principles I (original prose) + III
// -----------------------------------------------------------------------------

import Phaser from "phaser";

import { PALETTE_HEX } from "../config/palette.js";
import { type LevelId } from "../data/levels/index.js";
import { REGISTRY_KEY_ACTIVE_PROFILE_KEY, REGISTRY_KEY_SAVE_SERVICE } from "../game.js";
import { t } from "../i18n/index.js";
import {
  generatePhrase,
  hashHandleAndPhrase,
  joinPhrase,
  normalizeHandle,
  normalizePhrase,
  ProfileValidationError,
  type RecoveryPhrase,
} from "../services/profile-service.js";
import {
  GUEST_PROFILE_KEY,
  LEGACY_PROFILE_KEY,
  type SaveService,
  SaveQuotaExceededError,
} from "../services/save-service.js";
import { type SaveState } from "../types/save-state.js";

/** What StartScene expects in its `init(data)` call. */
interface StartSceneData {
  /** Level the eventual Play button starts. Defaults to `"level-01"`. */
  readonly levelId?: LevelId;
}

/** Default level to start with after a profile is picked. */
const DEFAULT_LEVEL_ID: LevelId = "level-01";

/** Detection: are we on a touch-capable device? Mirrors UIScene's check. */
function isTouchDevice(): boolean {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/** Profile row data displayed in the user list. */
interface ProfileRow {
  /** Storage key (hash or sentinel). */
  readonly key: string;
  /** Display handle (read from SaveState.profileHandle). */
  readonly handle: string;
  /** Lifetime gems for the row's right-side stat. */
  readonly gems: number;
  /** True for the legacy slot (shows a "legacy" tag). */
  readonly isLegacy: boolean;
}

/** Top-of-the-game landing page. */
export class StartScene extends Phaser.Scene {
  private levelId: LevelId = DEFAULT_LEVEL_ID;
  /** True once a route has fired; prevents double-start from chained inputs. */
  private routed = false;

  public constructor() {
    super({ key: "StartScene" });
  }

  /** Phaser hook — record which level to eventually start. */
  public init(data: StartSceneData): void {
    this.levelId = data.levelId ?? DEFAULT_LEVEL_ID;
    this.routed = false;
  }

  /** Phaser hook — render the landing page. */
  public create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(this.hexToNumber(PALETTE_HEX.bgForest));

    // Clear any prior guest data so guest sessions are ephemeral.
    this.clearGuestSlot();

    // Title — top-third of screen, large, carrot-orange.
    this.add
      .text(width / 2, 60, t("menu.title"), {
        fontFamily: "monospace",
        fontSize: "44px",
        color: PALETTE_HEX.uiCarrot,
        align: "center",
      })
      .setOrigin(0.5, 0);

    // Tagline below title.
    this.add
      .text(width / 2, 116, t("menu.tagline"), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5, 0);

    // Version badge.
    this.add
      .text(width / 2, 142, t("menu.versionBadge"), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE_HEX.textCream,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.7);

    // Build SHA + timestamp at bottom-right.
    this.add
      .text(width - 8, height - 8, `build ${__BUILD_SHA__} · ${__BUILD_TIMESTAMP__} UTC`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(1, 1)
      .setAlpha(0.45);

    // Section heading.
    this.add
      .text(width / 2, 180, t("start.chooseHeading"), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE_HEX.uiCarrot,
      })
      .setOrigin(0.5, 0);

    // Player rows + action buttons.
    this.buildProfileList(width / 2, 220);
  }

  /**
   * Build the list of existing profiles + action buttons (New / Restore /
   * Guest). Vertical stack centered on `cx`, starting at `topY`.
   */
  private buildProfileList(cx: number, topY: number): void {
    const profiles = this.readProfiles();
    let y = topY;

    if (profiles.length === 0) {
      this.add
        .text(cx, y, t("start.noProfiles"), {
          fontFamily: "monospace",
          fontSize: "13px",
          color: PALETTE_HEX.textCream,
        })
        .setOrigin(0.5, 0)
        .setAlpha(0.6);
      y += 30;
    } else {
      for (const profile of profiles) {
        this.buildProfileRow(cx, y, profile);
        y += 44;
      }
      y += 12;
    }

    // Action buttons row.
    this.buildActionButton(cx - 130, y, t("start.newPlayerButton"), () => {
      void this.flowCreateNewProfile();
    });
    this.buildActionButton(cx, y, t("start.restoreButton"), () => {
      void this.flowRestoreProfile();
    });
    this.buildActionButton(cx + 130, y, t("start.guestButton"), () => {
      this.startAsGuest();
    });
  }

  /** Build one profile row: handle + gems + "Play" button. */
  private buildProfileRow(cx: number, cy: number, profile: ProfileRow): void {
    const rowW = 380;
    const rowH = 36;

    // Background.
    this.add
      .rectangle(cx, cy, rowW, rowH, this.hexToNumber(PALETTE_HEX.bgDialog), 0.6)
      .setOrigin(0.5, 0)
      .setStrokeStyle(1, this.hexToNumber(PALETTE_HEX.textCream), 0.3);

    // Handle text (left).
    const handleText = profile.isLegacy
      ? `${profile.handle} ${t("profile.legacyLabel")}`
      : profile.handle;
    this.add
      .text(cx - rowW / 2 + 14, cy + rowH / 2, handleText, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0, 0.5);

    // Gems count (middle-right).
    this.add
      .text(cx + rowW / 2 - 110, cy + rowH / 2, `💎 ${profile.gems.toString()}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.textCream,
      })
      .setOrigin(0, 0.5)
      .setAlpha(0.85);

    // Play button (right).
    const playLabel = this.add
      .text(cx + rowW / 2 - 14, cy + rowH / 2, t("start.resumeButton"), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.uiCarrot,
        backgroundColor: PALETTE_HEX.bgForest,
        padding: { x: 10, y: 4 },
      })
      .setOrigin(1, 0.5);

    const playHit = this.add
      .rectangle(cx + rowW / 2 - 50, cy + rowH / 2, 100, 28)
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });

    playHit.on(Phaser.Input.Events.POINTER_OVER, () => {
      playLabel.setColor(PALETTE_HEX.textCream);
    });
    playHit.on(Phaser.Input.Events.POINTER_OUT, () => {
      playLabel.setColor(PALETTE_HEX.uiCarrot);
    });
    playHit.on(Phaser.Input.Events.POINTER_DOWN, () => {
      this.setActiveProfileAndGoToTreasure(profile.key);
    });
  }

  /** Build one centered action button at (cx, cy). */
  private buildActionButton(cx: number, cy: number, label: string, onClick: () => void): void {
    const text = this.add
      .text(cx, cy, label, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE_HEX.textCream,
        backgroundColor: PALETTE_HEX.bgDialog,
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5);

    const hit = this.add
      .rectangle(cx, cy, 130, 32)
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
   * Enumerate existing profile slots that should appear in the picker.
   * Excludes the GUEST sentinel; includes LEGACY with a flag.
   */
  private readProfiles(): readonly ProfileRow[] {
    const saveService = this.requireSaveService();
    if (saveService === undefined) {
      return [];
    }
    const keys = saveService.listProfileKeys();
    const rows: ProfileRow[] = [];
    for (const key of keys) {
      if (key === GUEST_PROFILE_KEY) {
        continue;
      }
      let state: SaveState;
      try {
        state = saveService.load(key);
      } catch {
        continue;
      }
      // Skip empty/un-touched legacy slot to avoid noise.
      if (key === LEGACY_PROFILE_KEY && state.lastPlayedAtIso === new Date(0).toISOString()) {
        continue;
      }
      rows.push({
        key,
        handle: state.profileHandle,
        gems: state.gems,
        isLegacy: key === LEGACY_PROFILE_KEY,
      });
    }
    return rows;
  }

  /** Wipe the guest slot so guest sessions are ephemeral. */
  private clearGuestSlot(): void {
    const saveService = this.requireSaveService();
    saveService?.clear(GUEST_PROFILE_KEY);
  }

  /**
   * Set the active profile + transition. Used by all the "real profile"
   * routes; guest takes the separate `startAsGuest` path.
   */
  private setActiveProfileAndGoToTreasure(profileKey: string): void {
    if (this.routed) {
      return;
    }
    this.routed = true;
    this.registry.set(REGISTRY_KEY_ACTIVE_PROFILE_KEY, profileKey);
    this.scene.start("TreasureScene", { levelId: this.levelId });
  }

  /**
   * Guest path: set the guest profile key + skip TreasureScene entirely,
   * go straight to LevelScene. Guests have no Treasure Box, no exchange,
   * no persistence.
   */
  private startAsGuest(): void {
    if (this.routed) {
      return;
    }
    this.routed = true;
    this.registry.set(REGISTRY_KEY_ACTIVE_PROFILE_KEY, GUEST_PROFILE_KEY);
    this.scene.start("LevelScene", { levelId: this.levelId });
  }

  // ---- Create-new + Restore flows (window.prompt-based) ------------------

  /** Create-new flow: prompt for handle, generate phrase, confirm, persist. */
  private async flowCreateNewProfile(): Promise<void> {
    const rawHandle = window.prompt(t("profile.newPromptHandle"));
    if (rawHandle === null) {
      return;
    }
    let handle: string;
    try {
      handle = normalizeHandle(rawHandle);
    } catch (err) {
      window.alert(
        err instanceof ProfileValidationError ? err.message : t("profile.errorInvalidInput"),
      );
      return;
    }

    const phrase = generatePhrase();
    const phraseText = joinPhrase(phrase);

    const hash = await hashHandleAndPhrase(handle, phrase);
    const saveService = this.requireSaveService();
    if (saveService === undefined) {
      window.alert("Save service unavailable");
      return;
    }
    const existing = saveService.load(hash);
    if (existing.lastPlayedAtIso !== new Date(0).toISOString()) {
      window.alert(t("profile.errorHandleExists"));
      return;
    }

    const confirmed = window.confirm(
      `${t("profile.newPromptShowPhrase")}\n\n    ${phraseText.toUpperCase()}\n\nOK = ${t(
        "profile.newPromptConfirm",
      )}\nCancel = abort`,
    );
    if (!confirmed) {
      return;
    }

    try {
      saveService.save(hash, {
        version: 2,
        profileHandle: handle,
        currentCarrots: 0,
        gems: 0,
        abilities: [],
        completedLevelIds: [],
      });
    } catch (err) {
      window.alert(err instanceof SaveQuotaExceededError ? "Storage full" : "Save failed");
      return;
    }
    this.setActiveProfileAndGoToTreasure(hash);
  }

  /** Restore flow: prompt for handle + phrase, compute hash, set active if it matches. */
  private async flowRestoreProfile(): Promise<void> {
    const rawHandle = window.prompt(t("profile.restorePromptHandle"));
    if (rawHandle === null) {
      return;
    }
    let handle: string;
    try {
      handle = normalizeHandle(rawHandle);
    } catch (err) {
      window.alert(
        err instanceof ProfileValidationError ? err.message : t("profile.errorInvalidInput"),
      );
      return;
    }

    const rawPhrase = window.prompt(t("profile.restorePromptPhrase"));
    if (rawPhrase === null) {
      return;
    }
    let phrase: RecoveryPhrase;
    try {
      phrase = normalizePhrase(rawPhrase.split(/\s+/));
    } catch (err) {
      window.alert(
        err instanceof ProfileValidationError ? err.message : t("profile.errorInvalidInput"),
      );
      return;
    }

    const hash = await hashHandleAndPhrase(handle, phrase);
    const saveService = this.requireSaveService();
    if (saveService === undefined) {
      window.alert("Save service unavailable");
      return;
    }
    const loaded = saveService.load(hash);
    if (loaded.lastPlayedAtIso === new Date(0).toISOString()) {
      window.alert(t("profile.errorNoSuchProfile"));
      return;
    }

    this.setActiveProfileAndGoToTreasure(hash);
  }

  /** Retrieve the SaveService from the registry. Undefined if boot failed. */
  private requireSaveService(): SaveService | undefined {
    return this.registry.get(REGISTRY_KEY_SAVE_SERVICE) as SaveService | undefined;
  }

  /** CSS hex string -> Phaser numeric color (0xRRGGBB). */
  private hexToNumber(hex: string): number {
    return Number.parseInt(hex.slice(1), 16);
  }
}

// Touch-utility reference (kept around for future per-platform tweaks).
void isTouchDevice;
