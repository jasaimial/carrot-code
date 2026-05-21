// -----------------------------------------------------------------------------
// carrot-code — physics-helpers (T026)
//
// Pure vector / contact math used by entities (patrol reversal,
// narrator-trigger proximity) and the level scene (end-trigger overlap
// when we want to test the predicate without a Phaser world).
//
// Phaser's Arcade physics handles collision response and integration;
// this module is the small set of calculations we want to unit-test
// without spinning a scene. All functions are pure: no globals, no
// closures over mutable state, no Phaser imports.
//
// Tests: tests/unit/physics-helpers.test.ts.
//
// See:
//   src/systems/coyote-time.ts, src/systems/jump-buffer.ts (sibling systems)
//   .specify/memory/constitution.md  — Principles III + VI
// -----------------------------------------------------------------------------

/**
 * A point in 2D world coordinates (Phaser convention: +y is down).
 */
export interface Point2 {
  /** World x coordinate. */
  readonly x: number;
  /** World y coordinate. */
  readonly y: number;
}

/**
 * An axis-aligned rectangle in 2D world coordinates with size in
 * pixels. Matches the shape of `LevelData.endTrigger`.
 */
export interface Rect2 {
  /** Top-left x. */
  readonly x: number;
  /** Top-left y. */
  readonly y: number;
  /** Width in pixels. */
  readonly w: number;
  /** Height in pixels. */
  readonly h: number;
}

/** Inclusive 1D range along a patrol axis. */
export interface Range1 {
  /** Lower bound (inclusive). */
  readonly min: number;
  /** Upper bound (inclusive). */
  readonly max: number;
}

/** Patrol direction: `+1` toward `max`, `-1` toward `min`. */
export type PatrolDirection = 1 | -1;

/**
 * Clamp `value` to the inclusive range `[min, max]`.
 *
 * @param value - Input value.
 * @param min   - Lower bound, inclusive.
 * @param max   - Upper bound, inclusive. Must be `>= min`.
 * @returns `min` if `value < min`, `max` if `value > max`, else `value`.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/**
 * Inclusive point-in-rectangle test. Used by the end-trigger overlap
 * predicate when we want to test it without a Phaser overlap collider.
 *
 * @param p    - The point to test.
 * @param rect - The rectangle.
 * @returns `true` if the point lies on or inside the rect's edges.
 */
export function pointInRect(p: Point2, rect: Rect2): boolean {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

/**
 * Squared euclidean distance between two points. Squared (rather than
 * sqrt'd) because callers compare to a fixed radius — squaring the
 * radius once is cheaper than a per-frame `Math.sqrt`. Used by the
 * narrator `on-position` trigger.
 *
 * @param a - First point.
 * @param b - Second point.
 * @returns `(b.x - a.x)^2 + (b.y - a.y)^2`. Always `>= 0`.
 */
export function pointDistanceSq(a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Decide the patrol direction for the next tick.
 *
 * Used by the enemy patrol behaviour: feed in the entity's current
 * position along its patrol axis, the patrol bounds, and the current
 * direction; the return is the direction to apply this tick. Flips
 * at or past either bound, but only if the current direction would
 * push the entity further outside — entities that just flipped on
 * the previous tick don't re-flip back into the wall.
 *
 * @param positionOnAxis - Current position along the patrol axis.
 * @param bounds         - Inclusive patrol bounds along the axis.
 * @param currentDir     - Direction in effect this tick (`+1` or `-1`).
 * @returns The direction to use for next-tick movement.
 */
export function nextPatrolDirection(
  positionOnAxis: number,
  bounds: Range1,
  currentDir: PatrolDirection,
): PatrolDirection {
  if (positionOnAxis >= bounds.max && currentDir === 1) {
    return -1;
  }
  if (positionOnAxis <= bounds.min && currentDir === -1) {
    return 1;
  }
  return currentDir;
}
