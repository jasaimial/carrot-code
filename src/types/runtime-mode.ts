// -----------------------------------------------------------------------------
// carrot-code — RuntimeMode
//
// String-literal union describing the runtime modes the game can boot in.
// Today there is exactly one mode; the union shape is deliberate so that
// adding a future mode (e.g. multiplayer host) is a one-line type change
// rather than a refactor.
//
// See:
//   specs/001-vertical-slice/data-model.md#runtimemode
//   .specify/memory/constitution.md   — Principle XI (serializable state)
// -----------------------------------------------------------------------------

/**
 * Runtime mode the game is currently operating in.
 *
 * Modelled as a string-literal union with a single member today. Future
 * modes (e.g. `"multiplayer-host"`, `"replay"`) can be added by extending
 * this union; every `switch` over `RuntimeMode` will then become a
 * compile-time exhaustiveness check.
 */
export type RuntimeMode = "single-player-local";
