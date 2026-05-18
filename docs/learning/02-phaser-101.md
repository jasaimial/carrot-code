# Phaser 101 — a tech memo for carrot-code

**Audience:** the project maintainer + any agent picking up the code without prior Phaser experience.
**Goal:** enough Phaser vocabulary and mental model to read the scenes and entities in this repo and understand what's happening.
**Scope:** Phaser 3.x (the version pinned in [package.json](../../package.json)). Phaser 4 is still pre-release as of 2026-05.

This is **not** the Phaser docs. It's the on-ramp that the docs assume you already have. After reading this, the [official examples](https://phaser.io/examples) and [API reference](https://newdocs.phaser.io/) will make sense.

---

## What Phaser is — and what it isn't

**Phaser is** an HTML5 game framework: a scene graph, a 2D renderer (WebGL with Canvas fallback), an asset loader, an input subsystem, and an arcade physics engine. You write TypeScript that uses Phaser's classes; Phaser owns the main loop.

**Phaser is not:**

- **Not an ECS** (Entity-Component-System). Game objects are OOP-style classes that own their own state. You can layer an ECS on top, but for a small platformer it's overkill.
- **Not a level editor.** We use [Tiled](https://www.mapeditor.org/) (a separate tool) to author tilemaps; Phaser loads them via `load.tilemapTiledJSON`.
- **Not 3D.** Phaser is 2D only. (Phaser 4 adds optional 3D; not relevant to us.)
- **Not a game engine in the Unity/Godot sense.** No built-in animation timeline editor, no asset pipeline, no scripting GUI. Just a framework you import like a library.

---

## The hierarchy: Game → Scene → GameObject

Every Phaser app is a single **`Phaser.Game`** instance configured at startup. The Game owns:

- The canvas it draws into.
- A **scene manager** with one or more **`Phaser.Scene`** instances.
- A **physics manager**, **input manager**, **loader**, **registry**, and a global **event emitter**.

Each scene owns its own:

- **GameObjects** (sprites, text, tilemaps, particles, …) created via `this.add.*` factories.
- **Physics bodies** for those of its objects that participate in physics.
- **Cameras** (every scene has a default `main` camera; you can add more).
- **Tweens**, **timers**, and **sound** instances scoped to the scene.

When a scene shuts down, everything it owns is cleaned up automatically — including tweens and timers, which is why you should always create them through `this.tweens.*` / `this.time.*` and not via raw `setTimeout` / `requestAnimationFrame`.

```
Phaser.Game
├── SceneManager
│   ├── BootScene       (we have stubs for these in src/scenes/)
│   ├── MenuScene
│   ├── LevelScene      ← gameplay
│   ├── UIScene         ← parallel HUD overlay on top of LevelScene
│   └── GameOverScene
├── Registry            (scene-wide key/value store — shared state)
├── Events              (global event emitter — cross-scene comms)
├── Loader              (per-scene asset loading)
├── Input               (keyboard / mouse / touch / gamepad)
└── Physics             (arcade in our case)
```

---

## The scene lifecycle (the four methods that matter)

Every scene class extends `Phaser.Scene` and overrides some subset of these in order:

```ts
class LevelScene extends Phaser.Scene {
  constructor() {
    super({ key: "LevelScene" }); // unique scene key, used to start/stop
  }

  init(data: { levelId: string }): void {
    // 1. Called first, with whatever data the previous scene passed.
    //    Use this to set up scene-local fields. NO Phaser objects yet
    //    (the scene's add/load/physics isn't fully wired here).
  }

  preload(): void {
    // 2. Asset loading. Anything queued here is guaranteed loaded
    //    before create() runs. We move most asset loading into BootScene
    //    so individual scenes rarely use this.
    this.load.image("hero", "/assets/sprites/hero.png");
  }

  create(): void {
    // 3. Everything is ready: assets loaded, physics armed, input
    //    available. Build the scene world here: add sprites, set up
    //    colliders, wire up input handlers. Runs ONCE per scene start.
    const hero = this.add.sprite(100, 100, "hero");
    this.physics.add.existing(hero);
  }

  update(time: number, delta: number): void {
    // 4. The per-frame tick (default ~60 FPS). `time` is total ms since
    //    game start; `delta` is ms since the previous frame. KEEP THIS
    //    CHEAP — anything heavy here makes the game feel laggy.
    //    Most gameplay logic lives here.
  }

  shutdown(): void {
    // Optional: called when the scene stops. Tweens/timers/groups are
    //    auto-cleaned; only manually-attached listeners need disposal.
  }
}
```

**Footgun #1 (the `this` rebind problem):** Phaser callbacks (e.g., on input events, tween onComplete) are called with the scene as `this` if you provide a context argument; otherwise `this` is whatever JavaScript decides, which is often `undefined` in strict mode. **Solution:** prefer arrow functions, which lexically capture `this`. Don't use plain `function` keyword inside scene methods.

**Footgun #2 (units in `update`):** `delta` is in **milliseconds**, not seconds. If you write `hero.x += speed * delta` thinking delta is seconds, your hero will travel 1000× too far. The conventional fix: convert to seconds at the top of `update` (`const dt = delta / 1000`) or, simpler, define speeds in pixels-per-millisecond.

---

## Scenes can run in parallel — this is how the HUD works

A scene isn't a "screen." Multiple scenes can be **active simultaneously**, layered top-to-bottom in their declared order:

```ts
// In game.ts, scenes are registered in render order:
scene: [BootScene, MenuScene, LevelScene, UIScene, GameOverScene];
// → BootScene runs alone first.
// → After it transitions, MenuScene runs alone.
// → On Play, LevelScene starts AND UIScene starts on top (transparent
//    background). LevelScene runs the world; UIScene draws the HUD.
```

To start a second scene on top of the current one:

```ts
this.scene.launch("UIScene"); // additive — both run
// vs.
this.scene.start("UIScene"); // replaces the current scene
```

UIScene listens to the global event emitter for events LevelScene emits (e.g., `"carrot-collected"`) and updates its text accordingly. This is the canonical Phaser pattern for HUDs.

---

## Arcade physics in 60 seconds

We're using `arcade` physics — the cheap, AABB-only (axis-aligned bounding box, no rotation) engine Phaser ships with. It's perfect for platformers and what the [research.md](../../specs/001-vertical-slice/research.md) chose for us.

```ts
// Tell Phaser this sprite has a physics body:
this.physics.add.existing(hero);

// Now hero.body is a Phaser.Physics.Arcade.Body with:
hero.body.setVelocityX(180); // horizontal speed in px/sec
hero.body.setVelocityY(-460); // negative = up (Phaser Y axis goes DOWN)
hero.body.setGravityY(1200); // world gravity is in PHYSICS.gravityYPxPerSec2
hero.body.blocked.down; // true if grounded this frame
hero.body.touching.left; // true if touching wall on the left
```

**Collide vs. overlap:**

- **`this.physics.add.collider(a, b)`** — physically separates `a` and `b` (they bounce/stop). Used for hero × ground.
- **`this.physics.add.overlap(a, b, callback)`** — fires `callback` when `a` overlaps `b` but DOESN'T separate them. Used for hero × carrot, hero × end-trigger, hero × enemy (we run our own damage logic in the callback rather than letting physics resolve the collision).

**Layers and groups:** physics objects belong to **groups** (`this.physics.add.group(...)`). Setting up colliders between groups instead of individual sprites scales better as the level grows.

---

## Asset loader and keys

Phaser identifies every loaded asset by a **string key**. Keys are global within a Game instance. The pattern this project enforces (Principle XI):

1. All asset declarations live in `src/services/asset-service.ts` (T023).
2. `BootScene` iterates `assetService.assets` and calls the matching loader (`load.image`, `load.spritesheet`, `load.tilemapTiledJSON`).
3. Other scenes and entities reference assets by the key string declared in AssetService — never a URL.

```ts
// In src/services/asset-service.ts:
const assets: AssetDeclaration[] = [
  { key: "hero", type: "spritesheet", url: "/assets/sprites/hero.png", approxBytes: 24_000 },
  // ...
];

// In BootScene.create():
for (const a of assetService.assets) {
  if (a.type === "image") this.load.image(a.key, a.url);
  else if (a.type === "spritesheet") this.load.spritesheet(a.key, a.url, { frameWidth: 32, frameHeight: 32 });
  // ...
}
this.load.once("complete", () => this.scene.start("LevelScene", { levelId: "level-01" }));
this.load.start();

// In LevelScene.create():
this.add.sprite(spawn.x, spawn.y, "hero"); // ← "hero" is the AssetService key
```

This indirection is what lets the **asset-budget verifier** (T059) sum bytes per level at build time without having to scan source for URL strings.

---

## The Registry and Event Emitter — cross-scene state

`game.registry` is a key/value store shared by every scene. `game.events` is an event emitter shared by every scene. Principle XI explicitly allows these as the in-engine state-coordination idiom (it's how Phaser is meant to be used; banning them would force everyone to reinvent service-locator patterns).

```ts
// LevelScene.create():
this.registry.set("currentCarrots", 0);

// On carrot collect:
this.registry.inc("currentCarrots"); // built-in helper
this.game.events.emit("carrot-collected");

// UIScene.create() — listens for the event:
this.game.events.on("carrot-collected", () => {
  this.carrotsText.setText(`${this.registry.get("currentCarrots")}`);
});
```

**Footgun #3 (listener cleanup):** the global event emitter does NOT auto-clean listeners when a scene shuts down. If you add listeners in `create()`, remove them in `shutdown()`, or they'll leak and double-fire on the next scene start. The scene-local `this.events` emitter DOES auto-clean — prefer it when the listener only needs intra-scene scope.

---

## Where Phaser concepts land in this codebase

| Phaser concept | carrot-code location | Notes |
| --- | --- | --- |
| `Phaser.Game` config | [src/game.ts](../../src/game.ts) | renderer choice, scene registration, FPS overlay (dev only) |
| `Phaser.Scene` subclasses | [src/scenes/](../../src/scenes/) | one file per scene; thin — most logic delegates to services/systems |
| Sprite factories | [src/entities/](../../src/entities/) (T033/T039/T040, lands w/ US1+US2) | `createHero(scene, config)` returns a typed Hero wrapping a Phaser sprite |
| Pure logic (no Phaser) | [src/systems/](../../src/systems/) (T024–T026) | coyote-time, jump-buffer, physics-helpers — pure functions/state-machines, fully unit-tested without Phaser |
| Asset declarations | [src/services/asset-service.ts](../../src/services/) (T023) | the single source of truth for what BootScene preloads |
| Tilemap data | [src/data/levels/level-01.tmj](../../src/data/levels/) (T029) | Tiled JSON; loaded by level-loader → passed to LevelScene |
| Save / load | [src/services/save-service.ts](../../src/services/save-service.ts) | NEVER call `localStorage.*` from a scene — always go through SaveService |
| Tuning constants | [src/config/](../../src/config/) | PHYSICS, HERO, ENEMY, POWERUPS, UI — all `as const`, imported by entities |
| Cross-scene events | `this.game.events.emit("foo")` from emitting scene, `this.game.events.on("foo", handler)` from listening scene | per Principle XI, allowed |
| Intra-scene events | `this.events.emit("foo")` / `this.events.on("foo")` | auto-cleaned on shutdown; prefer when possible |

---

## Common footguns this project guards against

1. **`this` in callbacks** → use arrow functions; never plain `function`.
2. **`update` delta is milliseconds** → either `dt = delta / 1000` or speeds in px/ms.
3. **Global event leaks** → use `this.events` (scene-local) when possible; manually remove from `this.game.events` in `shutdown()` when not.
4. **Pixel-art blur** → in `game.ts` config, set `pixelArt: true` AND `roundPixels: true` to avoid sub-pixel sampling.
5. **Tween leaks** → always create via `this.tweens.add(...)` (scene-scoped), not raw `setTimeout` loops.
6. **Loading assets in `update`** → only ever load in `preload()` or via `this.load.*` calls in `create()` followed by `this.load.start()`.
7. **Hard-coded asset keys / URLs** → always through AssetService.
8. **Hard-coded magic numbers in gameplay** → always through `src/config/*.ts`.
9. **`localStorage` access from a scene** → always through SaveService.
10. **Modifying `LevelData` after the loader returns it** → it's frozen; treat it as read-only.

---

## Further reading

When you need more depth:

- **[Phaser API docs](https://newdocs.phaser.io/)** — searchable, exhaustive. The API for `Phaser.Scene`, `Phaser.GameObjects.Sprite`, `Phaser.Physics.Arcade.Body`, and `Phaser.Tilemaps.Tilemap` is where you'll spend most of your time.
- **[Phaser examples site](https://phaser.io/examples)** — copy-pasteable demos for almost every API. Filter by "Tilemap," "Arcade physics," "Input," etc.
- **[Phaser 3 by example](https://phasergames.com/)** — community-driven tutorials with full source.

When you don't need depth, this memo + the code in [src/](../../src/) should be enough.
