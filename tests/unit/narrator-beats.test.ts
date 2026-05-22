import { describe, expect, it } from "vitest";

import { evaluateNarratorTrigger } from "../../src/systems/narrator-trigger.js";
import { LEVEL_IDS } from "../../src/data/levels/index.js";
import { getNarratorBeatsForLevel } from "../../src/data/narrator-beats.js";
import type { NarratorBeat } from "../../src/types/level.js";

function beat(trigger: NarratorBeat["trigger"]): NarratorBeat {
  return {
    id: "test-beat",
    trigger,
    text: "Original test prose.",
    dismissable: true,
  };
}

describe("evaluateNarratorTrigger", () => {
  it("fires after-spawn when elapsed time reaches delay", () => {
    const b = beat({ kind: "after-spawn", delayMs: 2000 });

    expect(evaluateNarratorTrigger(b, 1999, { x: 0, y: 0 }, [])).toBe(false);
    expect(evaluateNarratorTrigger(b, 2000, { x: 0, y: 0 }, [])).toBe(true);
  });

  it("fires on-position when hero enters radius", () => {
    const b = beat({ kind: "on-position", x: 100, y: 100, radius: 20 });

    expect(evaluateNarratorTrigger(b, 0, { x: 121, y: 100 }, [])).toBe(false);
    expect(evaluateNarratorTrigger(b, 0, { x: 120, y: 100 }, [])).toBe(true);
    expect(evaluateNarratorTrigger(b, 0, { x: 110, y: 110 }, [])).toBe(true);
  });

  it("fires on-event only when the expected event is present", () => {
    const b = beat({ kind: "on-event", event: "first-jump" });

    expect(evaluateNarratorTrigger(b, 0, { x: 0, y: 0 }, [])).toBe(false);
    expect(evaluateNarratorTrigger(b, 0, { x: 0, y: 0 }, ["first-carrot"])).toBe(false);
    expect(evaluateNarratorTrigger(b, 0, { x: 0, y: 0 }, ["first-jump"])).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Data-driven sweep over every registered level's beats (Layer 1).
//
// Catches: a beat with empty text (visible-but-blank dialog), a beat with
// a malformed trigger, a beat with a duplicate id within the same level
// (would make dismiss-state tracking ambiguous). Runs against the real
// shipped narrator content, so adding a new level's beats earns coverage
// without writing per-level tests.
//
// What it does NOT enforce: anything about copyrighted phrasing - that
// is a human review concern at content-authoring time (Principle I), not
// a regex an automated test can usefully assert.
// -----------------------------------------------------------------------------

describe.each(LEVEL_IDS)("registered narrator beats: %s", (levelId) => {
  const beats = getNarratorBeatsForLevel(levelId);

  it("returns a frozen array (callers cannot mutate beat content)", () => {
    expect(Object.isFrozen(beats)).toBe(true);
  });

  it("declares at least one beat (otherwise the registry call is dead weight)", () => {
    expect(beats.length).toBeGreaterThan(0);
  });

  it("each beat has a non-empty id, non-empty text, and a recognised trigger kind", () => {
    for (const b of beats) {
      expect(b.id.trim()).not.toBe("");
      expect(b.text.trim()).not.toBe("");
      expect(["after-spawn", "on-position", "on-event"]).toContain(b.trigger.kind);
    }
  });

  it("beat ids are unique within the level", () => {
    const ids = beats.map((b) => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
