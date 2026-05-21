// -----------------------------------------------------------------------------
// carrot-code — NarratorBeat / NarratorTrigger
//
// Typed shapes for the narrator dialog system (User Story 3). The actual
// beat data lives in src/data/narrator-beats.ts (lands in T047) and MUST
// contain only original prose — no copyrighted phrasing per spec FR-029
// and Constitution Principle I.
//
// The `kind`-discriminated trigger union lets us add new trigger types
// without touching the dispatcher (Principle IV).
//
// See:
//   specs/001-vertical-slice/data-model.md#narratorbeat
//   .specify/memory/constitution.md   — Principles I + IV
// -----------------------------------------------------------------------------

/**
 * Condition under which a narrator beat fires. Discriminated on `kind`.
 *
 * - `after-spawn`: fires once when `delayMs` has elapsed since hero spawn.
 * - `on-position`: fires when the hero is within `radius` of `(x, y)`.
 * - `on-event`: fires on a named scene-registry event.
 */
export type NarratorTrigger =
  | {
      /** Discriminant. */
      readonly kind: "after-spawn";
      /** Delay since hero spawn before the beat fires, in milliseconds. */
      readonly delayMs: number;
    }
  | {
      /** Discriminant. */
      readonly kind: "on-position";
      /** World-coordinate x to trigger near. */
      readonly x: number;
      /** World-coordinate y to trigger near. */
      readonly y: number;
      /** Trigger radius in pixels. */
      readonly radius: number;
    }
  | {
      /** Discriminant. */
      readonly kind: "on-event";
      /** Named gameplay event that fires the beat. */
      readonly event: "first-jump" | "first-carrot";
    };

/**
 * A single line of narrator dialog plus the condition that triggers it.
 *
 * `dismissable` is locked to `true` in v0 (spec FR-028) — the dialog
 * never blocks the player indefinitely. The flag is still present in
 * the type so future non-dismissable beats are an additive change.
 */
export interface NarratorBeat {
  /** Unique within the owning level. */
  readonly id: string;
  /** Condition under which this beat fires. */
  readonly trigger: NarratorTrigger;
  /** Original prose. No copyrighted phrasing (spec FR-029, Principle I). */
  readonly text: string;
  /** Always `true` in v0 — every beat is dismissable on input. */
  readonly dismissable: true;
}
