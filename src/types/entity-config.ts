// -----------------------------------------------------------------------------
// carrot-code — EntityConfig
//
// Discriminated-union of every entity kind the level loader can produce
// from a Tiled .tmj object layer. Concrete numeric tuning lives in
// src/config/*.ts (Principle III); these shapes are what crosses the
// data → runtime boundary.
//
// The `kind` discriminant lets the entity factory dispatch without an
// `as` cast and gives every `switch (cfg.kind)` exhaustiveness checking
// for free.
//
// See:
//   specs/001-vertical-slice/data-model.md#entityconfig
//   specs/001-vertical-slice/contracts/level-format.md
//   .specify/memory/constitution.md   — Principle IV (data-driven)
// -----------------------------------------------------------------------------

/**
 * A patrolling enemy. Avoidance-only in v0 (spec FR-014): contact damages
 * the hero, the hero cannot defeat the enemy.
 */
export interface EnemyConfig {
  /** Discriminant for the EntityConfig union. */
  readonly kind: "enemy";
  /** Unique within the owning level. Used for debugging + event correlation. */
  readonly id: string;
  /** Asset key declared in AssetService. */
  readonly spriteKey: string;
  /** Spawn x in world coordinates (from the Tiled object). */
  readonly x: number;
  /** Spawn y in world coordinates (from the Tiled object). */
  readonly y: number;
  /** Patrol behaviour in world coordinates. */
  readonly patrol: {
    /** Axis the enemy patrols along. */
    readonly axis: "horizontal" | "vertical";
    /** Patrol speed in pixels per second; sign determined by current direction. */
    readonly speedPxPerSec: number;
    /** Inclusive world-coordinate bounds along the patrol axis. */
    readonly bounds: {
      /** Lower bound along the patrol axis (inclusive). */
      readonly min: number;
      /** Upper bound along the patrol axis (inclusive). */
      readonly max: number;
    };
  };
}

/**
 * A collectible carrot. Disappears on contact with the hero and is
 * restored on level restart (no per-level checkpointing in v0).
 */
export interface CarrotConfig {
  /** Discriminant for the EntityConfig union. */
  readonly kind: "carrot";
  /** Unique within the owning level. */
  readonly id: string;
  /** Asset key declared in AssetService. */
  readonly spriteKey: string;
  /** Spawn x in world coordinates (from the Tiled object). */
  readonly x: number;
  /** Spawn y in world coordinates (from the Tiled object). */
  readonly y: number;
}

/**
 * A power-up pickup that grants the hero a temporary effect.
 *
 * In v0 the only effect is brief invincibility; the union shape on
 * `effect` keeps the door open for further effects without breaking
 * the entity factory.
 */
export interface PowerupConfig {
  /** Discriminant for the EntityConfig union. */
  readonly kind: "powerup";
  /** Unique within the owning level. */
  readonly id: string;
  /** Asset key declared in AssetService. */
  readonly spriteKey: string;
  /** Spawn x in world coordinates (from the Tiled object). */
  readonly x: number;
  /** Spawn y in world coordinates (from the Tiled object). */
  readonly y: number;
  /** Effect granted on pickup. */
  readonly effect: "invincibility";
  /** Effect duration in milliseconds; tuned in src/config/powerups.ts. */
  readonly durationMs: number;
}

/**
 * Every entity kind the level loader can produce. Discriminated on
 * `kind` so dispatch is exhaustive without runtime type checks.
 */
export type EntityConfig = EnemyConfig | CarrotConfig | PowerupConfig;
