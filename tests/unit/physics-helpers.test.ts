// -----------------------------------------------------------------------------
// carrot-code — physics-helpers tests (T026)
//
// Pure vector / contact math the entities and LevelScene depend on.
// Phaser's Arcade physics handles collision response and integration;
// these helpers cover the small calculations we want to unit-test
// without spinning up a Phaser world.
//
// Test-first within the T026 file pair (Principle VI).
//
// See:
//   src/systems/physics-helpers.ts
//   .specify/memory/constitution.md  — Principle VI
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  clamp,
  nextPatrolDirection,
  pointDistanceSq,
  pointInRect,
} from "../../src/systems/physics-helpers.js";

describe("clamp", () => {
  it("returns the value when inside the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("returns the min when below the range", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it("returns the max when above the range", () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("handles inclusive boundaries", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("returns the min when min equals max", () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });
});

describe("pointInRect", () => {
  const rect = { x: 100, y: 200, w: 50, h: 80 } as const;

  it("returns true for a point strictly inside the rect", () => {
    expect(pointInRect({ x: 120, y: 240 }, rect)).toBe(true);
  });

  it("returns true for a point on the rect's lower edge (inclusive)", () => {
    expect(pointInRect({ x: 100, y: 200 }, rect)).toBe(true);
  });

  it("returns true for a point on the rect's upper edge (inclusive)", () => {
    expect(pointInRect({ x: 150, y: 280 }, rect)).toBe(true);
  });

  it("returns false for a point just outside the rect", () => {
    expect(pointInRect({ x: 99, y: 240 }, rect)).toBe(false);
    expect(pointInRect({ x: 151, y: 240 }, rect)).toBe(false);
    expect(pointInRect({ x: 120, y: 199 }, rect)).toBe(false);
    expect(pointInRect({ x: 120, y: 281 }, rect)).toBe(false);
  });
});

describe("pointDistanceSq", () => {
  it("returns 0 for identical points", () => {
    expect(pointDistanceSq({ x: 5, y: 7 }, { x: 5, y: 7 })).toBe(0);
  });

  it("returns the squared euclidean distance", () => {
    // (3,4) vs origin -> 3^2 + 4^2 = 25.
    expect(pointDistanceSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
  });

  it("is symmetric in its inputs", () => {
    expect(pointDistanceSq({ x: 1, y: 2 }, { x: 10, y: 20 })).toBe(
      pointDistanceSq({ x: 10, y: 20 }, { x: 1, y: 2 }),
    );
  });

  it("never goes negative for any inputs", () => {
    expect(pointDistanceSq({ x: -5, y: -10 }, { x: 5, y: 10 })).toBeGreaterThanOrEqual(0);
  });
});

describe("nextPatrolDirection", () => {
  const bounds = { min: 100, max: 200 } as const;

  it("keeps direction +1 when inside bounds moving right", () => {
    expect(nextPatrolDirection(150, bounds, 1)).toBe(1);
  });

  it("keeps direction -1 when inside bounds moving left", () => {
    expect(nextPatrolDirection(150, bounds, -1)).toBe(-1);
  });

  it("flips direction at or past the max bound", () => {
    expect(nextPatrolDirection(200, bounds, 1)).toBe(-1);
    expect(nextPatrolDirection(210, bounds, 1)).toBe(-1); // overshoot still flips
  });

  it("flips direction at or past the min bound", () => {
    expect(nextPatrolDirection(100, bounds, -1)).toBe(1);
    expect(nextPatrolDirection(90, bounds, -1)).toBe(1); // overshoot still flips
  });

  it("does NOT flip when at the max bound but already moving inward", () => {
    // Hitting the wall on the previous tick already flipped us; the
    // following tick must not flip back.
    expect(nextPatrolDirection(200, bounds, -1)).toBe(-1);
    expect(nextPatrolDirection(100, bounds, 1)).toBe(1);
  });
});
