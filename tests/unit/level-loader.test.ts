// -----------------------------------------------------------------------------
// carrot-code — level-loader tests (T021)
//
// Written BEFORE the implementation, per Constitution Principle VI. On
// the T021 commit every test here is expected to FAIL — the level-loader
// module does not exist yet. On the T022 commit the impl lands and all
// tests turn green.
//
// Coverage maps 1:1 to the four invariants in
//   specs/001-vertical-slice/contracts/level-format.md#loader-contract
// plus a happy-path round-trip test that exercises the typical case
// (one spawn, one end, one enemy, one carrot, one powerup).
//
// Test environment: `node`. The loader is a pure function — input is the
// already-parsed Tiled JSON object — so no FS / DOM tax.
//
// See:
//   specs/001-vertical-slice/contracts/level-format.md
//   .specify/memory/constitution.md  — Principle VI
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { LevelLoadError, loadLevel } from "../../src/services/level-loader.js";

// -----------------------------------------------------------------------------
// Tiled fixture helpers. We never load a real .tmj file from disk — the
// loader's contract is "input is the already-parsed object", so we build
// minimal fixtures in code that satisfy only the shape under test.
// -----------------------------------------------------------------------------

interface TiledProperty {
  readonly name: string;
  readonly type: string;
  readonly value: string | number | boolean;
}

interface TiledObject {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly properties: readonly TiledProperty[];
}

/**
 * Build a Tiled-style property entry.
 * @param name  - Property name as it would appear in Tiled.
 * @param value - String or number value (the loader rejects others).
 * @returns A `TiledProperty` ready to embed in a fixture object.
 */
function prop(name: string, value: string | number): TiledProperty {
  return {
    name,
    type: typeof value === "number" ? "float" : "string",
    value,
  };
}

/**
 * A complete object set: spawn + end + one of each entity kind.
 * @returns A fresh mutable array; tests are free to mutate / filter it.
 */
function defaultObjects(): TiledObject[] {
  return [
    {
      name: "spawn-point",
      x: 64,
      y: 320,
      properties: [prop("kind", "spawn")],
    },
    {
      name: "end-zone",
      x: 800,
      y: 256,
      width: 32,
      height: 128,
      properties: [prop("kind", "end")],
    },
    {
      name: "slime-1",
      x: 400,
      y: 300,
      properties: [
        prop("kind", "enemy"),
        prop("id", "slime-1"),
        prop("spriteKey", "slime"),
        prop("patrolAxis", "horizontal"),
        prop("patrolSpeedPxPerSec", 60),
        prop("patrolMin", 350),
        prop("patrolMax", 450),
      ],
    },
    {
      name: "carrot-1",
      x: 200,
      y: 280,
      properties: [prop("kind", "carrot"), prop("id", "carrot-1"), prop("spriteKey", "carrot")],
    },
    {
      name: "shield-1",
      x: 600,
      y: 280,
      properties: [
        prop("kind", "powerup"),
        prop("id", "shield-1"),
        prop("spriteKey", "shield"),
        prop("effect", "invincibility"),
        prop("durationMs", 4000),
      ],
    },
  ];
}

/**
 * Wrap a list of object-layer objects in a minimal Tiled map.
 * @param objects - The objects to place on the `entities` object layer.
 * @returns A Tiled-shaped object ready to hand to `loadLevel`.
 */
function tiledMap(objects: readonly TiledObject[]): object {
  return {
    width: 30,
    height: 17,
    tilewidth: 32,
    tileheight: 32,
    layers: [
      { name: "terrain", type: "tilelayer", data: [] },
      { name: "entities", type: "objectgroup", objects },
    ],
  };
}

describe("loadLevel", () => {
  // --- Happy path ---------------------------------------------------------
  it("parses a well-formed Tiled map into a LevelData", () => {
    const level = loadLevel(tiledMap(defaultObjects()), "level-01", "Forest 1", 250_000);
    expect(level.id).toBe("level-01");
    expect(level.name).toBe("Forest 1");
    expect(level.assetBudgetBytes).toBe(250_000);
    expect(level.spawn).toEqual({ x: 64, y: 320 });
    expect(level.endTrigger).toEqual({ x: 800, y: 256, w: 32, h: 128 });
    expect(level.entities).toHaveLength(3);
    expect(level.narratorBeats).toEqual([]);
  });

  it("preserves the typed shape of each entity kind", () => {
    const level = loadLevel(tiledMap(defaultObjects()), "level-01", "Forest 1", 250_000);
    const enemy = level.entities.find((e) => e.kind === "enemy");
    const carrot = level.entities.find((e) => e.kind === "carrot");
    const powerup = level.entities.find((e) => e.kind === "powerup");

    expect(enemy).toEqual({
      kind: "enemy",
      id: "slime-1",
      spriteKey: "slime",
      x: 400,
      y: 300,
      patrol: {
        axis: "horizontal",
        speedPxPerSec: 60,
        bounds: { min: 350, max: 450 },
      },
    });
    expect(carrot).toEqual({
      kind: "carrot",
      id: "carrot-1",
      spriteKey: "carrot",
      x: 200,
      y: 280,
    });
    expect(powerup).toEqual({
      kind: "powerup",
      id: "shield-1",
      spriteKey: "shield",
      x: 600,
      y: 280,
      effect: "invincibility",
      durationMs: 4000,
    });
  });

  // --- Invariant 1: missing required custom property ----------------------
  it("throws LevelLoadError when an enemy is missing a required property", () => {
    const objects = defaultObjects().map((o) =>
      o.name === "slime-1"
        ? { ...o, properties: o.properties.filter((p) => p.name !== "patrolAxis") }
        : o,
    );
    expect(() => loadLevel(tiledMap(objects), "level-01", "Forest 1", 250_000)).toThrow(
      LevelLoadError,
    );
  });

  it("error message names the offending object when a property is missing", () => {
    const objects = defaultObjects().map((o) =>
      o.name === "carrot-1"
        ? { ...o, properties: o.properties.filter((p) => p.name !== "spriteKey") }
        : o,
    );
    expect(() => loadLevel(tiledMap(objects), "level-01", "Forest 1", 250_000)).toThrow(/carrot-1/);
  });

  // --- Invariant 2: spawn count ------------------------------------------
  it("throws LevelLoadError when no spawn object exists", () => {
    const objects = defaultObjects().filter((o) => o.name !== "spawn-point");
    expect(() => loadLevel(tiledMap(objects), "level-01", "Forest 1", 250_000)).toThrow(
      LevelLoadError,
    );
  });

  it("throws LevelLoadError when more than one spawn object exists", () => {
    const objects: TiledObject[] = [
      ...defaultObjects(),
      {
        name: "spawn-point-2",
        x: 100,
        y: 320,
        properties: [prop("kind", "spawn")],
      },
    ];
    expect(() => loadLevel(tiledMap(objects), "level-01", "Forest 1", 250_000)).toThrow(
      LevelLoadError,
    );
  });

  // --- Invariant 3: end exists -------------------------------------------
  it("throws LevelLoadError when no end object exists", () => {
    const objects = defaultObjects().filter((o) => o.name !== "end-zone");
    expect(() => loadLevel(tiledMap(objects), "level-01", "Forest 1", 250_000)).toThrow(
      LevelLoadError,
    );
  });

  // --- Invariant 4: frozen LevelData -------------------------------------
  it("returns a frozen LevelData (and frozen entities array)", () => {
    const level = loadLevel(tiledMap(defaultObjects()), "level-01", "Forest 1", 250_000);
    expect(Object.isFrozen(level)).toBe(true);
    expect(Object.isFrozen(level.entities)).toBe(true);
    expect(Object.isFrozen(level.spawn)).toBe(true);
    expect(Object.isFrozen(level.endTrigger)).toBe(true);
  });

  // --- Additional safety nets --------------------------------------------
  it("throws LevelLoadError when the `entities` object layer is absent", () => {
    const map = {
      width: 30,
      height: 17,
      tilewidth: 32,
      tileheight: 32,
      layers: [{ name: "terrain", type: "tilelayer", data: [] }],
    };
    expect(() => loadLevel(map, "level-01", "Forest 1", 250_000)).toThrow(LevelLoadError);
  });

  it("throws LevelLoadError on an unknown `kind` value", () => {
    const objects: TiledObject[] = [
      ...defaultObjects(),
      {
        name: "mystery-1",
        x: 500,
        y: 320,
        properties: [prop("kind", "mystery")],
      },
    ];
    expect(() => loadLevel(tiledMap(objects), "level-01", "Forest 1", 250_000)).toThrow(
      LevelLoadError,
    );
  });

  it("throws LevelLoadError when the end object is missing width/height", () => {
    // The `end` object MUST be a rectangle per contracts/level-format.md.
    // We rebuild the end entry without width/height rather than spreading
    // `undefined` (rejected under exactOptionalPropertyTypes: true).
    const objects: TiledObject[] = defaultObjects().map((o) =>
      o.name === "end-zone"
        ? {
            name: o.name,
            x: o.x,
            y: o.y,
            properties: o.properties,
          }
        : o,
    );
    expect(() => loadLevel(tiledMap(objects), "level-01", "Forest 1", 250_000)).toThrow(
      LevelLoadError,
    );
  });
});
