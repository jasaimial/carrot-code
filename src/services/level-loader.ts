// -----------------------------------------------------------------------------
// carrot-code — level-loader (T022)
//
// Pure function that translates a Tiled JSON map (`.tmj`) into a typed,
// frozen `LevelData`. No FS, no network — the caller is responsible for
// reading the file; the loader only takes the already-parsed object.
//
// Why pure: the loader is what we test for level-authoring correctness
// (Principle VI). Scenes accept `LevelData` as input rather than a path,
// so both loader and scene are independently testable.
//
// The level format contract is documented in
//   specs/001-vertical-slice/contracts/level-format.md
// and the four loader invariants are exercised in
//   tests/unit/level-loader.test.ts.
//
// Narrator beats are NOT parsed from Tiled — they live in
// `src/data/narrator-beats.ts` (T047) and are composed onto the level
// at scene-build time. The loader returns an empty `narratorBeats`
// array; the scene fills it in.
//
// See:
//   specs/001-vertical-slice/contracts/level-format.md
//   .specify/memory/constitution.md  — Principles IV + VI + XI
// -----------------------------------------------------------------------------

import type {
  CarrotConfig,
  EnemyConfig,
  EntityConfig,
  PowerupConfig,
} from "../types/entity-config.js";
import type { LevelData } from "../types/level.js";

/**
 * Thrown by {@link loadLevel} when the input map fails any invariant
 * from the level-format contract. The message names the offending
 * object (when applicable) so a Tiled author can find the problem.
 */
export class LevelLoadError extends Error {
  /**
   * @param message - Human-readable reason; should include the offending
   *   object's `name` when the failure is per-object.
   */
  public constructor(message: string) {
    super(message);
    this.name = "LevelLoadError";
  }
}

// -----------------------------------------------------------------------------
// Internal types matching the Tiled JSON shape we read. We model only
// the parts the loader actually touches; unknown fields pass through
// untouched as part of `tiledMap`.
// -----------------------------------------------------------------------------

interface TiledProperty {
  readonly name: string;
  readonly type: string;
  readonly value: unknown;
}

interface TiledObject {
  readonly name?: string;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly properties?: readonly TiledProperty[];
  /** Index signature so `obj[axis]` typechecks for axis: "x" | "y". */
  readonly [key: string]: unknown;
}

interface TiledLayer {
  readonly name?: string;
  readonly type?: string;
  readonly objects?: readonly TiledObject[];
}

interface TiledMap {
  readonly layers?: readonly TiledLayer[];
}

/** Every value the `kind` custom property is allowed to take. */
const VALID_KINDS = ["spawn", "end", "enemy", "carrot", "powerup"] as const;
type Kind = (typeof VALID_KINDS)[number];

/**
 * Parse a Tiled JSON map into a frozen {@link LevelData}.
 *
 * The loader is pure: same input → same output, no I/O. All failure
 * modes throw {@link LevelLoadError} with a message that points at the
 * offending object when possible.
 *
 * @param tiledJson        - The already-parsed Tiled map object.
 * @param levelId          - Stable id used as a SaveState key.
 * @param levelName        - Human-readable name for HUD / debug.
 * @param assetBudgetBytes - Per-level asset budget (Principle X).
 * @returns A frozen `LevelData` ready to hand to `LevelScene`.
 * @throws {LevelLoadError} When any contract invariant fails.
 */
export function loadLevel(
  tiledJson: object,
  levelId: string,
  levelName: string,
  assetBudgetBytes: number,
): LevelData {
  const map = tiledJson as TiledMap;
  const entitiesLayer = (map.layers ?? []).find(
    (l) => l.type === "objectgroup" && l.name === "entities",
  );
  if (entitiesLayer === undefined) {
    throw new LevelLoadError("level-loader: required object layer `entities` is missing");
  }

  const objects: readonly TiledObject[] = entitiesLayer.objects ?? [];

  const spawnObjects: TiledObject[] = [];
  const endObjects: TiledObject[] = [];
  const entities: EntityConfig[] = [];

  for (const obj of objects) {
    const kind = readKind(obj);
    switch (kind) {
      case "spawn":
        spawnObjects.push(obj);
        break;
      case "end":
        endObjects.push(obj);
        break;
      case "enemy":
        entities.push(readEnemy(obj));
        break;
      case "carrot":
        entities.push(readCarrot(obj));
        break;
      case "powerup":
        entities.push(readPowerup(obj));
        break;
    }
  }

  const [spawn, ...extraSpawns] = spawnObjects;
  if (spawn === undefined) {
    throw new LevelLoadError("level-loader: no `spawn` object found on the entities layer");
  }
  if (extraSpawns.length > 0) {
    throw new LevelLoadError(
      `level-loader: expected exactly one \`spawn\` object, found ${String(spawnObjects.length)}`,
    );
  }
  const [end] = endObjects;
  if (end === undefined) {
    throw new LevelLoadError("level-loader: no `end` object found on the entities layer");
  }

  if (typeof spawn.x !== "number" || typeof spawn.y !== "number") {
    throw new LevelLoadError(
      `level-loader: spawn object \`${nameOf(spawn)}\` is missing x or y coordinates`,
    );
  }
  if (
    typeof end.x !== "number" ||
    typeof end.y !== "number" ||
    typeof end.width !== "number" ||
    typeof end.height !== "number"
  ) {
    throw new LevelLoadError(
      `level-loader: end object \`${nameOf(end)}\` must be a rectangle with x/y/width/height`,
    );
  }

  return Object.freeze<LevelData>({
    id: levelId,
    name: levelName,
    tiledMap: tiledJson,
    spawn: Object.freeze({ x: spawn.x, y: spawn.y }),
    endTrigger: Object.freeze({ x: end.x, y: end.y, w: end.width, h: end.height }),
    entities: Object.freeze(entities.slice()),
    narratorBeats: Object.freeze([]),
    assetBudgetBytes,
  });
}

// -----------------------------------------------------------------------------
// Per-kind readers. Each validates required custom properties and
// returns the matching typed EntityConfig. All throw LevelLoadError
// with the offending object's `name` so authors can find the problem
// in Tiled without grep.
// -----------------------------------------------------------------------------

function readEnemy(obj: TiledObject): EnemyConfig {
  const id = readStringProp(obj, "id");
  const spriteKey = readStringProp(obj, "spriteKey");
  const patrolAxis = readStringProp(obj, "patrolAxis");
  if (patrolAxis !== "horizontal" && patrolAxis !== "vertical") {
    throw new LevelLoadError(
      `level-loader: enemy \`${nameOf(obj)}\` patrolAxis must be "horizontal" or "vertical", got "${patrolAxis}"`,
    );
  }
  const speedPxPerSec = readNumberProp(obj, "patrolSpeedPxPerSec");
  const patrolMin = readNumberProp(obj, "patrolMin");
  const patrolMax = readNumberProp(obj, "patrolMax");
  return Object.freeze<EnemyConfig>({
    kind: "enemy",
    id,
    spriteKey,
    x: readPlacementCoord(obj, "x"),
    y: readPlacementCoord(obj, "y"),
    patrol: Object.freeze({
      axis: patrolAxis,
      speedPxPerSec,
      bounds: Object.freeze({ min: patrolMin, max: patrolMax }),
    }),
  });
}

function readCarrot(obj: TiledObject): CarrotConfig {
  return Object.freeze<CarrotConfig>({
    kind: "carrot",
    id: readStringProp(obj, "id"),
    spriteKey: readStringProp(obj, "spriteKey"),
    x: readPlacementCoord(obj, "x"),
    y: readPlacementCoord(obj, "y"),
  });
}

function readPowerup(obj: TiledObject): PowerupConfig {
  const effect = readStringProp(obj, "effect");
  if (effect !== "invincibility") {
    throw new LevelLoadError(
      `level-loader: powerup \`${nameOf(obj)}\` effect must be "invincibility" in v0, got "${effect}"`,
    );
  }
  return Object.freeze<PowerupConfig>({
    kind: "powerup",
    id: readStringProp(obj, "id"),
    spriteKey: readStringProp(obj, "spriteKey"),
    x: readPlacementCoord(obj, "x"),
    y: readPlacementCoord(obj, "y"),
    effect,
    durationMs: readNumberProp(obj, "durationMs"),
  });
}

/**
 * Read the Tiled object's spawn coordinate. Tiled puts these on the
 * object itself (not inside `properties[]`) so we can't use
 * `readNumberProp`. We check for a non-finite or missing value the
 * same way `readNumberProp` does so authors get the same error shape.
 */
function readPlacementCoord(obj: TiledObject, axis: "x" | "y"): number {
  const value = obj[axis];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new LevelLoadError(
      `level-loader: object \`${nameOf(obj)}\` is missing required placement coordinate \`${axis}\``,
    );
  }
  return value;
}

// -----------------------------------------------------------------------------
// Property-reader helpers. Centralise the missing-property error so the
// per-kind readers stay short and every error message has the same shape.
// -----------------------------------------------------------------------------

function readKind(obj: TiledObject): Kind {
  const value = readStringProp(obj, "kind");
  if (!(VALID_KINDS as readonly string[]).includes(value)) {
    throw new LevelLoadError(
      `level-loader: object \`${nameOf(obj)}\` has unknown kind "${value}" (expected one of: ${VALID_KINDS.join(", ")})`,
    );
  }
  return value as Kind;
}

function readStringProp(obj: TiledObject, propName: string): string {
  const value = findProp(obj, propName);
  if (typeof value !== "string") {
    throw new LevelLoadError(
      `level-loader: object \`${nameOf(obj)}\` is missing required string property \`${propName}\``,
    );
  }
  return value;
}

function readNumberProp(obj: TiledObject, propName: string): number {
  const value = findProp(obj, propName);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new LevelLoadError(
      `level-loader: object \`${nameOf(obj)}\` is missing required number property \`${propName}\``,
    );
  }
  return value;
}

function findProp(obj: TiledObject, propName: string): unknown {
  const props = obj.properties ?? [];
  for (const p of props) {
    if (p.name === propName) {
      return p.value;
    }
  }
  return undefined;
}

/** Tiled allows the `name` field to be empty; fall back to a placeholder. */
function nameOf(obj: TiledObject): string {
  return obj.name !== undefined && obj.name !== "" ? obj.name : "<unnamed>";
}
