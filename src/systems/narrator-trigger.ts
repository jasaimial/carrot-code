import type { NarratorBeat, NarratorTrigger } from "../types/level.js";

/** Hero world position passed to narrator trigger evaluation. */
export interface HeroPosition {
  readonly x: number;
  readonly y: number;
}

/** Gameplay events observed since the last evaluation tick. */
export type NarratorRecentEvent = Extract<NarratorTrigger, { kind: "on-event" }>["event"];

/**
 * Pure trigger evaluator used by UIScene/LevelScene narrator plumbing.
 *
 * Returns true when the provided beat's trigger condition is satisfied.
 */
export function evaluateNarratorTrigger(
  beat: NarratorBeat,
  gameTimeSinceSpawnMs: number,
  heroPosition: HeroPosition,
  recentEvents: readonly NarratorRecentEvent[],
): boolean {
  const { trigger } = beat;

  switch (trigger.kind) {
    case "after-spawn":
      return gameTimeSinceSpawnMs >= trigger.delayMs;
    case "on-position": {
      const dx = heroPosition.x - trigger.x;
      const dy = heroPosition.y - trigger.y;
      const distanceSq = dx * dx + dy * dy;
      return distanceSq <= trigger.radius * trigger.radius;
    }
    case "on-event":
      return recentEvents.includes(trigger.event);
  }
}
