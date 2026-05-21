/**
 * Tests for HeroPowerupState — pure-logic state machine for the
 * invincibility power-up timer.
 *
 * State: powered (true/false) + expiresAtMs. The `applyPowerup` call
 * either starts a fresh window or refreshes/extends an existing one
 * depending on the configured stack mode (POWERUPS.invincibilityStackMode).
 *
 * For v0 the only mode actually exercised is `"refresh"` (the default).
 * We still cover `"extend"` and `"ignore"` so the contract is documented
 * + the polish-phase tuner can flip the mode without re-reading code.
 *
 * See:
 *   src/entities/hero-powerup.ts      — module under test
 *   src/config/powerups.ts            — POWERUPS.invincibilityStackMode
 *   .specify/memory/constitution.md   — Principle VI (test-first)
 */

import { describe, expect, it } from "vitest";

import { HeroPowerupState } from "../../src/entities/hero-powerup.js";

describe("HeroPowerupState", () => {
  describe("initial state", () => {
    it("starts unpowered with zero remaining ms", () => {
      const state = new HeroPowerupState("refresh");
      expect(state.isPowered(0)).toBe(false);
      expect(state.remainingMs(0)).toBe(0);
    });
  });

  describe("first applyPowerup", () => {
    it("becomes powered for the requested duration", () => {
      const state = new HeroPowerupState("refresh");
      state.applyPowerup(0, 5000);
      expect(state.isPowered(0)).toBe(true);
      expect(state.isPowered(4999)).toBe(true);
      expect(state.isPowered(5000)).toBe(false);
    });

    it("remainingMs decreases as time advances", () => {
      const state = new HeroPowerupState("refresh");
      state.applyPowerup(0, 5000);
      expect(state.remainingMs(0)).toBe(5000);
      expect(state.remainingMs(1000)).toBe(4000);
      expect(state.remainingMs(5000)).toBe(0);
      expect(state.remainingMs(6000)).toBe(0);
    });
  });

  describe("re-grant while powered — refresh mode", () => {
    it("resets the timer to the new duration (does not stack)", () => {
      const state = new HeroPowerupState("refresh");
      state.applyPowerup(0, 5000);
      // At t=2000, 3000ms remain; new powerup at 4000ms should give 4000ms
      // remaining (not 3000+4000=7000).
      state.applyPowerup(2000, 4000);
      expect(state.remainingMs(2000)).toBe(4000);
      expect(state.isPowered(6000)).toBe(false);
    });
  });

  describe("re-grant while powered — extend mode", () => {
    it("adds the new duration to the remaining time", () => {
      const state = new HeroPowerupState("extend");
      state.applyPowerup(0, 5000);
      state.applyPowerup(2000, 4000); // 3000 remaining + 4000 = 7000
      expect(state.remainingMs(2000)).toBe(7000);
      expect(state.isPowered(8999)).toBe(true);
      expect(state.isPowered(9000)).toBe(false);
    });
  });

  describe("re-grant while powered — ignore mode", () => {
    it("drops the new pickup (timer unchanged)", () => {
      const state = new HeroPowerupState("ignore");
      state.applyPowerup(0, 5000);
      state.applyPowerup(2000, 10000); // ignored
      expect(state.remainingMs(2000)).toBe(3000);
      expect(state.isPowered(5000)).toBe(false);
    });
  });

  describe("re-grant while unpowered (all modes)", () => {
    it("refresh: starts fresh", () => {
      const state = new HeroPowerupState("refresh");
      state.applyPowerup(0, 5000);
      state.applyPowerup(10000, 3000); // expired, fresh start
      expect(state.remainingMs(10000)).toBe(3000);
    });

    it("extend: starts fresh (nothing to extend)", () => {
      const state = new HeroPowerupState("extend");
      state.applyPowerup(0, 5000);
      state.applyPowerup(10000, 3000);
      expect(state.remainingMs(10000)).toBe(3000);
    });

    it("ignore: still grants when not currently powered", () => {
      const state = new HeroPowerupState("ignore");
      state.applyPowerup(10000, 3000);
      expect(state.isPowered(10000)).toBe(true);
    });
  });
});
