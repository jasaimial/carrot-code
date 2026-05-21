# Art Direction v0.1

> **Status**: starting baseline for the v0.1 demo build.
> **Scope**: this document is a guardrail for the demo-sprint visual pass.
> It is intentionally short. It says NO more often than it says yes.

## Why this exists

Without a written direction, polish drifts. One commit tints things green,
the next adds a particle burst, the third changes the font, and the
whole thing reads like four different games stitched together. This file
exists so the visual pass for the cohort demo has a single answer to
"does this fit?"

## North star

The game is a **small, hand-pixel-feel platformer with a narrator voice**.
Limited palette, readable silhouettes, three depth layers. Nothing more.

Reference vibe: late-80s arcade meets cosy modern indie. Closer to
*Celeste*'s restraint than to *Hollow Knight*'s density. The narrator
beats are the personality vector; the visuals should support that
voice, not compete with it.

## Hard rules

1. **All colors via [`PALETTE_HEX`](../src/config/palette.ts) / `PALETTE`.**
   This was promoted to a Constitution Principle III mechanical bar in
   v1.1.1. No exceptions in gameplay code. Procedural pixels (a
   render-texture gradient, a Graphics fill) MUST resolve their fill
   color through a palette token.

2. **Three depth layers, no more:**
   - **Far**: sky / horizon. `scrollFactor: 0.0`. Almost still.
   - **Mid**: parallax silhouette (hills / treeline). `scrollFactor: 0.3–0.5`.
   - **Near**: gameplay layer (tilemap + entities + hero). `scrollFactor: 1.0`.

   No fourth layer. If something is tempting to add as "even closer"
   foreground, it goes in the gameplay tilemap or it's cut.

3. **Silhouette readability is non-negotiable.**
   Every entity the player can interact with (hero, enemy, carrot,
   powerup) must be distinguishable by silhouette alone (squint test).
   Color is secondary; if a thing only reads because of its color, it
   needs a shape change.

4. **Maximum two simultaneous effects per frame.**
   Particles are great. Two particle bursts on screen at once is fine.
   Three at once with a screen-shake on top is noise. Cut.

5. **No animated backgrounds in the demo.**
   The parallax layer scrolls because the camera moves — that's free
   motion. No drifting clouds, no waving grass, no shimmer. v0.1 budget
   is small.

## Palette intent (what each token is for)

| Token | Intent |
|---|---|
| `bgForest` | Far-back sky / default game canvas color. The "world is alive" baseline. |
| `bgDialog` | Mid-layer hill silhouettes; UI dim panels; touch button fills. The "step back" color. |
| `textCream` | All foreground text; sprite highlights. The "look here" warm. |
| `uiCarrot` | Hero accents; carrot collectibles; primary CTAs (Play button, narrator dismiss hint). The "do this" orange. |
| `uiHeart` | Lives HUD only. Stays a single-purpose alarm color. |
| `uiPowerup` | Powerup HUD timer + powered-state hero tint. The "you have an ability" gold. |
| `debugText` | Dev-only FPS overlay. Never visible to players. |

Adding a new token requires editing the palette file with a one-line
comment naming what it's for. No drive-by additions.

## What's in scope for v0.1 visual pass

In priority order:

1. **Backdrop gradient + parallax hills** (procedural, drawn via
   Phaser Graphics, no new assets). Adds depth without an asset
   pipeline detour.
2. **Carrot-collect particle burst** (Phaser built-in particle
   emitter; one-shot ~200ms). The cheapest juice win in the codebase.
3. **Powerup pickup gold flash** (single quick tween on the hero
   sprite). Reinforces the "something happened" moment.
4. **Slime silhouette** strengthened (already darker than the floor
   tiles; if not visible enough on phone in landscape, add a 1px dark
   outline via render-texture trick).

## What's explicitly out of scope for v0.1

- New character sprite art (we're shipping with Kenney CC0; replacement
  sprites are a post-cohort track).
- A custom font (monospace is intentional for arcade tone + zero
  download cost).
- Lighting / shaders / shaders of any kind.
- Animated tile variants (waterfall, torch flicker, etc.).
- Particle systems on the enemy or on jump (we'd blow the two-effects
  budget instantly).
- Per-level theming. There's one level. It looks how it looks.

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-05-21 | Procedural backdrop, not new image assets | Faster to ship, no license trail needed, parameter-tunable. |
| 2026-05-21 | Two-effects-max budget | Demo readability. The narrator is the personality; visuals support, don't compete. |
| 2026-05-21 | Keep monospace font | Arcade tone fit, zero load cost, no licensing decisions to make. |

## Review trigger

Re-read this doc before any commit that touches:
- A `Graphics`, `RenderTexture`, or particle-emitter call.
- A new color literal (which shouldn't exist — but if you're tempted,
  you're about to break rule #1).
- A new depth layer.
- A new asset under `public/assets/`.

If the change can't be defended against the rules above, it's not in
scope for v0.1.
