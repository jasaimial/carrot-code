/**
 * Tests for the Hero's pure-logic lives + invulnerability state machine.
 *
 * The Phaser sprite is integration-glue (verified via T046 playtest);
 * the state machine that says "after a hit, hero is invulnerable for
 * N ms, then vulnerable again; lives reach 0 → game over" is pure
 * logic and lives in a separate module that has no Phaser imports.
 *
 * Side-effects mode: the state machine takes time deltas, returns the
 * resulting state. Tests advance time, hit it, assert state.
 *
 * See:
 *   src/entities/hero-lives.ts        — the state machine under test
 *   src/entities/hero.ts              — Phaser sprite that owns it
 *   .specify/memory/constitution.md   — Principle VI (test-first)
 */

import { describe, expect, it } from "vitest";

import { HeroLivesState } from "../../src/entities/hero-lives.js";

describe("HeroLivesState", () => {
  describe("initial state", () => {
    it("starts with the supplied life count and is vulnerable", () => {
      const state = new HeroLivesState(3, 1000);
      expect(state.lives).toBe(3);
      expect(state.isInvulnerable(0)).toBe(false);
      expect(state.isGameOver).toBe(false);
    });

    it("rejects construction with zero or negative lives", () => {
      expect(() => new HeroLivesState(0, 1000)).toThrow();
      expect(() => new HeroLivesState(-1, 1000)).toThrow();
    });
  });

  describe("takeHit while vulnerable", () => {
    it("decrements lives", () => {
      const state = new HeroLivesState(3, 1000);
      const result = state.takeHit(0);
      expect(result).toBe("hurt");
      expect(state.lives).toBe(2);
    });

    it("starts invulnerability window", () => {
      const state = new HeroLivesState(3, 1000);
      state.takeHit(0);
      expect(state.isInvulnerable(500)).toBe(true);
      expect(state.isInvulnerable(999)).toBe(true);
      expect(state.isInvulnerable(1001)).toBe(false);
    });
  });

  describe("takeHit while invulnerable", () => {
    it("returns 'ignored' and does not decrement lives", () => {
      const state = new HeroLivesState(3, 1000);
      state.takeHit(0);
      expect(state.lives).toBe(2);
      const result = state.takeHit(500); // still inside invuln window
      expect(result).toBe("ignored");
      expect(state.lives).toBe(2);
    });
  });

  describe("invulnerability window expiry", () => {
    it("the hero is vulnerable again after the window", () => {
      const state = new HeroLivesState(3, 1000);
      state.takeHit(0);
      // After window, second hit lands.
      const result = state.takeHit(1100);
      expect(result).toBe("hurt");
      expect(state.lives).toBe(1);
    });
  });

  describe("game over on final hit", () => {
    it("takeHit returns 'gameover' when lives would drop to 0", () => {
      const state = new HeroLivesState(1, 1000);
      const result = state.takeHit(0);
      expect(result).toBe("gameover");
      expect(state.lives).toBe(0);
      expect(state.isGameOver).toBe(true);
    });

    it("further hits after game over are ignored", () => {
      const state = new HeroLivesState(1, 1000);
      state.takeHit(0);
      // After invuln window has passed, the hero shouldn't reset to alive.
      const result = state.takeHit(2000);
      expect(result).toBe("ignored");
      expect(state.lives).toBe(0);
    });
  });

  describe("reset", () => {
    it("restores lives and clears invuln state", () => {
      const state = new HeroLivesState(3, 1000);
      state.takeHit(0);
      state.takeHit(2000);
      expect(state.lives).toBe(1);

      state.reset(0);
      expect(state.lives).toBe(3);
      expect(state.isInvulnerable(0)).toBe(false);
      expect(state.isGameOver).toBe(false);
    });
  });
});
