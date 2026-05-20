import { describe, expect, it } from "vitest";

import { evaluateNarratorTrigger } from "../../src/systems/narrator-trigger.js";
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
