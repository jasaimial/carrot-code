// -----------------------------------------------------------------------------
// tests/unit/economy.test.ts
//
// Pure exchange logic tests. Covers both directions, every error case,
// boundary conditions (exact-spend, all-in, against the gem cap).
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  CARROTS_PER_GEM,
  exchangeCarrotsForGems,
  exchangeGemsForCarrots,
} from "../../src/systems/economy.js";
import { MAX_GEMS_PER_PROFILE } from "../../src/types/save-state.js";

describe("exchangeCarrotsForGems", () => {
  it("succeeds with a clean multiple-of-rate amount", () => {
    const result = exchangeCarrotsForGems(50, 100, 30, MAX_GEMS_PER_PROFILE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome.newCarrots).toBe(20);
      expect(result.outcome.newGems).toBe(103);
    }
  });

  it("succeeds when spending all carrots (boundary)", () => {
    const result = exchangeCarrotsForGems(50, 0, 50, MAX_GEMS_PER_PROFILE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome.newCarrots).toBe(0);
      expect(result.outcome.newGems).toBe(5);
    }
  });

  it("rejects zero amount", () => {
    const result = exchangeCarrotsForGems(50, 0, 0, MAX_GEMS_PER_PROFILE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("amount-not-positive");
    }
  });

  it("rejects negative amount", () => {
    const result = exchangeCarrotsForGems(50, 0, -10, MAX_GEMS_PER_PROFILE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("amount-not-positive");
    }
  });

  it("rejects non-integer amount", () => {
    const result = exchangeCarrotsForGems(50, 0, 10.5, MAX_GEMS_PER_PROFILE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("amount-not-integer");
    }
  });

  it("rejects amount that's not a multiple of the conversion rate", () => {
    const result = exchangeCarrotsForGems(50, 0, 15, MAX_GEMS_PER_PROFILE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("amount-not-multiple-of-rate");
    }
  });

  it("rejects spending more carrots than available", () => {
    const result = exchangeCarrotsForGems(5, 0, 10, MAX_GEMS_PER_PROFILE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("insufficient-carrots");
    }
  });

  it("rejects exchange that would breach the gem cap", () => {
    const result = exchangeCarrotsForGems(10, MAX_GEMS_PER_PROFILE, 10, MAX_GEMS_PER_PROFILE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("would-exceed-gem-cap");
    }
  });

  it("uses CARROTS_PER_GEM as the conversion rate", () => {
    const result = exchangeCarrotsForGems(
      CARROTS_PER_GEM,
      0,
      CARROTS_PER_GEM,
      MAX_GEMS_PER_PROFILE,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome.newGems).toBe(1);
    }
  });
});

describe("exchangeGemsForCarrots", () => {
  it("succeeds with a positive integer amount", () => {
    const result = exchangeGemsForCarrots(20, 5, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome.newCarrots).toBe(50);
      expect(result.outcome.newGems).toBe(2);
    }
  });

  it("succeeds when spending all gems (boundary)", () => {
    const result = exchangeGemsForCarrots(0, 7, 7);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome.newCarrots).toBe(70);
      expect(result.outcome.newGems).toBe(0);
    }
  });

  it("rejects zero amount", () => {
    const result = exchangeGemsForCarrots(0, 10, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("amount-not-positive");
    }
  });

  it("rejects negative amount", () => {
    const result = exchangeGemsForCarrots(0, 10, -5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("amount-not-positive");
    }
  });

  it("rejects non-integer amount", () => {
    const result = exchangeGemsForCarrots(0, 10, 1.5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("amount-not-integer");
    }
  });

  it("rejects spending more gems than available", () => {
    const result = exchangeGemsForCarrots(0, 3, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("insufficient-gems");
    }
  });

  it("uses CARROTS_PER_GEM as the conversion rate", () => {
    const result = exchangeGemsForCarrots(0, 1, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome.newCarrots).toBe(CARROTS_PER_GEM);
    }
  });
});
