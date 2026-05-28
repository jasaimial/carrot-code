// -----------------------------------------------------------------------------
// carrot-code — Economy (carrot ↔ gem exchange)
//
// Pure logic for the player-initiated carrot/gem exchange on MenuScene.
// No I/O, no Phaser, no DOM. Fully unit-testable.
//
// Exchange rules (agreed 2026-05-27):
//   - Symmetric: 1 gem ↔ 10 carrots. No taper, no fee.
//   - Player-initiated only. No auto-conversion at level-end.
//   - Conversions are integer-clean: spending requires you to have
//     enough of the source unit AND the amount must be a multiple of
//     the conversion rate.
//
// Risk-profile space the exchange creates for the player:
//   - All-carrots: max ammo, max death risk (lose all on death).
//   - All-gems: nothing in the satchel, nothing to lose, nothing to
//     throw. Safe but defenseless.
//   - Mix: their call.
//
// See:
//   src/scenes/MenuScene.ts                  - upcoming exchange UI
//   src/types/save-state.ts                  - the SaveState fields touched
//   tests/unit/economy.test.ts
// -----------------------------------------------------------------------------

/** How many carrots one gem is worth in either direction. */
export const CARROTS_PER_GEM = 10;

/**
 * Outcome of a successful exchange. Caller (MenuScene) writes the
 * resulting (newCarrots, newGems) tuple back to SaveState atomically.
 */
export interface ExchangeOutcome {
  /** Player's new carrot total after the exchange. */
  readonly newCarrots: number;
  /** Player's new gem total after the exchange. */
  readonly newGems: number;
}

/**
 * Reason an exchange request was rejected. Each value names a specific
 * legible-to-the-player problem the UI can surface.
 */
export type ExchangeError =
  | "amount-not-positive"
  | "amount-not-integer"
  | "insufficient-carrots"
  | "insufficient-gems"
  | "amount-not-multiple-of-rate"
  | "would-exceed-gem-cap";

/**
 * A union return type: either success or a categorized error.
 * Discriminated by `ok` so callers can switch exhaustively.
 */
export type ExchangeResult =
  | { readonly ok: true; readonly outcome: ExchangeOutcome }
  | { readonly ok: false; readonly error: ExchangeError };

/**
 * Convert `carrotsToSpend` worth of carrots into gems at the canonical
 * conversion rate.
 *
 * @param currentCarrots - The player's carrot total before the exchange.
 * @param currentGems    - The player's gem total before the exchange.
 * @param carrotsToSpend - How many carrots the player wants to convert.
 *   Must be a positive integer AND a multiple of CARROTS_PER_GEM.
 * @param gemCap         - Hard cap on the resulting gem total.
 * @returns The exchange result (success or categorized error).
 */
export function exchangeCarrotsForGems(
  currentCarrots: number,
  currentGems: number,
  carrotsToSpend: number,
  gemCap: number,
): ExchangeResult {
  if (carrotsToSpend <= 0) {
    return { ok: false, error: "amount-not-positive" };
  }
  if (!Number.isInteger(carrotsToSpend)) {
    return { ok: false, error: "amount-not-integer" };
  }
  if (carrotsToSpend % CARROTS_PER_GEM !== 0) {
    return { ok: false, error: "amount-not-multiple-of-rate" };
  }
  if (carrotsToSpend > currentCarrots) {
    return { ok: false, error: "insufficient-carrots" };
  }
  const gemsGained = carrotsToSpend / CARROTS_PER_GEM;
  const newGems = currentGems + gemsGained;
  if (newGems > gemCap) {
    return { ok: false, error: "would-exceed-gem-cap" };
  }
  return {
    ok: true,
    outcome: {
      newCarrots: currentCarrots - carrotsToSpend,
      newGems,
    },
  };
}

/**
 * Convert `gemsToSpend` worth of gems into carrots at the canonical
 * conversion rate.
 *
 * @param currentCarrots - The player's carrot total before the exchange.
 * @param currentGems    - The player's gem total before the exchange.
 * @param gemsToSpend    - How many gems the player wants to convert.
 *   Must be a positive integer.
 * @returns The exchange result (success or categorized error).
 */
export function exchangeGemsForCarrots(
  currentCarrots: number,
  currentGems: number,
  gemsToSpend: number,
): ExchangeResult {
  if (gemsToSpend <= 0) {
    return { ok: false, error: "amount-not-positive" };
  }
  if (!Number.isInteger(gemsToSpend)) {
    return { ok: false, error: "amount-not-integer" };
  }
  if (gemsToSpend > currentGems) {
    return { ok: false, error: "insufficient-gems" };
  }
  return {
    ok: true,
    outcome: {
      newCarrots: currentCarrots + gemsToSpend * CARROTS_PER_GEM,
      newGems: currentGems - gemsToSpend,
    },
  };
}
