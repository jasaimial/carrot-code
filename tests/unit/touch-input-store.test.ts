/**
 * Tests for TouchInputStore — the pure-logic singleton that receives
 * touch-button presses from UIScene and exposes them to the Hero
 * entity each frame.
 *
 * The store is intentionally trivial (boolean flags + a one-shot edge
 * detect for jump-press) but the edge-detect is the bit that's easy to
 * get wrong, so it gets explicit cases.
 *
 * See:
 *   src/systems/touch-input-store.ts  — the store under test
 *   src/scenes/UIScene.ts              — the writer
 *   src/entities/hero.ts               — the reader
 *   .specify/memory/constitution.md    — Principle VI (test-first)
 */

import { describe, expect, it } from "vitest";

import { TouchInputStore } from "../../src/systems/touch-input-store.js";

describe("TouchInputStore", () => {
  describe("directional flags", () => {
    it("starts with all flags false", () => {
      const store = new TouchInputStore();
      expect(store.left).toBe(false);
      expect(store.right).toBe(false);
      expect(store.jumpHeld).toBe(false);
    });

    it("setLeft toggles the left flag", () => {
      const store = new TouchInputStore();
      store.setLeft(true);
      expect(store.left).toBe(true);
      store.setLeft(false);
      expect(store.left).toBe(false);
    });

    it("setRight toggles the right flag", () => {
      const store = new TouchInputStore();
      store.setRight(true);
      expect(store.right).toBe(true);
      store.setRight(false);
      expect(store.right).toBe(false);
    });

    it("left and right are independent", () => {
      const store = new TouchInputStore();
      store.setLeft(true);
      store.setRight(true);
      expect(store.left).toBe(true);
      expect(store.right).toBe(true);
      store.setLeft(false);
      expect(store.left).toBe(false);
      expect(store.right).toBe(true);
    });
  });

  describe("jump (edge-detected press + held state)", () => {
    it("setJump(true) sets jumpHeld and signals a fresh press", () => {
      const store = new TouchInputStore();
      store.setJump(true);
      expect(store.jumpHeld).toBe(true);
      expect(store.consumeJumpPressed()).toBe(true);
    });

    it("consumeJumpPressed returns false after first consume", () => {
      const store = new TouchInputStore();
      store.setJump(true);
      expect(store.consumeJumpPressed()).toBe(true);
      expect(store.consumeJumpPressed()).toBe(false);
    });

    it("setJump(true) twice in a row only fires one press (no auto-repeat)", () => {
      const store = new TouchInputStore();
      store.setJump(true);
      store.setJump(true); // still down, not a new press
      expect(store.consumeJumpPressed()).toBe(true);
      expect(store.consumeJumpPressed()).toBe(false);
    });

    it("release-then-press fires a new press", () => {
      const store = new TouchInputStore();
      store.setJump(true);
      store.consumeJumpPressed(); // clear first press
      store.setJump(false);
      store.setJump(true);
      expect(store.consumeJumpPressed()).toBe(true);
    });

    it("setJump(false) clears jumpHeld without queuing a press", () => {
      const store = new TouchInputStore();
      store.setJump(true);
      store.consumeJumpPressed();
      store.setJump(false);
      expect(store.jumpHeld).toBe(false);
      expect(store.consumeJumpPressed()).toBe(false);
    });

    it("consumeJumpPressed returns false when jump never pressed", () => {
      const store = new TouchInputStore();
      expect(store.consumeJumpPressed()).toBe(false);
    });
  });
});
