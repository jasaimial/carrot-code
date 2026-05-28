# Handover — carrot-code

**Last updated:** 2026-05-28 (v0.3 profile + Treasure Box economy arc shipped)
**Active branch:** `main` (production). Future work moves to new feature branches off `main`.
**Current state:** **v0.3 profile + Treasure Box economy is end-to-end functional.** Five PRs landed across one session (#12-#16) per the agreed plan: word bank + ProfileService (pure logic), SaveState v2 schema with per-profile storage + v1 migration, carrot persistence rules + pure exchange logic, Treasure Box display + carrot/gem exchange UI, and the profile picker (New / Restore with recovery-phrase). v0.1-demo tag retagged to the new HEAD so the cohort URL stays current. **Awaiting maintainer review + playtest of the new flows.**
**Live build:** <https://happy-desert-0fe507f1e.7.azurestaticapps.net> (auto-deploys from `main`). Title-screen bottom-right stamps the live commit's short SHA + UTC build timestamp so cache-vs-fresh is verifiable at a glance.
**Local dev:** `npm run dev` → title screen → see the Treasure Box panel top-right (Player, Carrots, Gems, Abilities) + trade buttons + "Switch player" → Play → walk right, carrots persist to your satchel + survive level transitions but zero on death → reach end-trigger → back to MenuScene, see updated counts.

> This doc is a **living snapshot** of where the project is right now. It's
> the single page to read when picking up the project after time away — by
> future-you, by a new agent in a fresh chat, or by anyone joining.
>
> When something material changes, update this file in the same commit.
> History lives in [`docs/learning/journal/`](./journal/); this file is the
> current state.

---

## TL;DR — where we are

- **v0.1-demo tag points to the latest `main` HEAD** (currently the v0.3
  arc + retag). Cohort URL always serves the most-recent merged state.
  Branch protection enforced on main: PR + CI green + linear history
  required.
- **v0.3 ECONOMY ARC complete on disk (2026-05-28):**
  - **Carrots** = per-run consumable. Carry across levels. **Lost on death.**
  - **Gems** = persistent valuables in the Treasure Box. Survive death.
    Hard-capped at 21,000,000 per profile (a world rule).
  - **Abilities** = persistent owned identifiers (e.g. `bunny-hop` in
    future). Permanent once purchased.
  - **Exchange**: 1 gem ↔ 10 carrots, symmetric, player-initiated on
    MenuScene. No auto-conversion at level-end.
  - **Profile system**: local-only, identified by player-chosen handle
    + 4-word recovery phrase from a curated 100^4 word bank. Storage
    key is `SHA-256(handle + ":" + phrase)`. Lose the phrase = lose the
    treasure (architecturally enforced, no recovery path).
- **Cohort feedback closed**: item #4 (eye-direction) shipped at PR #11.
  Items #10 + #5 + #14 (the three independent kid-asks for an economy)
  inspired this v0.3 arc.
- **What's NOT in v0.3** (next direction is maintainer's call after
  playtest): Bunny Hop ability + buyable shield (mechanically ready,
  awaits price tuning), in-canvas profile-input UI (currently uses
  window.prompt/confirm for rough first cut), profile list in picker
  (Restore requires knowing the handle).
- **Repo is public**, CI mechanically enforces all five gates on main
  (Principle VIII). 165 tests across 14 files.

## Quick-start: come back to a working dev loop

From a fresh terminal in the repo root:

```powershell
git status                  # should show clean tree on 001-vertical-slice
npm install                 # idempotent; needed only if node_modules is gone
npm run dev                 # opens dev server at http://localhost:5173

# In another terminal:
npm test                    # vitest (55 unit tests across 6 files)
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
npm run format:check        # prettier --check
npm run build               # vite build → dist/
```

All five validators should be green on `001-vertical-slice` HEAD. If
something is red, **stop and fix before any new feature work** —
Constitution Principle VIII is enforced now.

## Troubleshooting local dev

When `localhost:5173` seems broken, work down this checklist in order
before diagnosing application bugs. Most "local dev is broken"
reports across May 2026 turned out to be one of these four.

1. **Check the title-screen build SHA.** Bottom-right corner displays
   `build <sha> · <UTC timestamp>`. If it doesn't match
   `git rev-parse --short HEAD`, you're not on the build you think
   you're on. Skip to the relevant remediation below.

2. **Port held by a zombie?** If `npm run dev` refuses to start with
   "Port 5173 is already in use", a previous session's node process
   is squatting on the port. Run `npm run kill-dev` to clear it,
   then `npm run dev` again. (The `predev` script is what catches
   this; `strictPort:true` in vite.config.ts is what makes Vite
   refuse to silently shift to 5174.)

3. **Stale service worker?** Symptoms: `main.ts` returns 500,
   `manifest.webmanifest` reports syntax errors, console shows
   `workbox-XXXX.js Router is responding to: /`. A SW from a
   previous PWA-in-dev session is intercepting requests. Fix:
   DevTools → Application → Service Workers → Unregister, then
   Application → Storage → Clear site data, then hard-refresh.
   (The dev-only self-heal in src/main.ts will also unregister
   stale SWs on next page load.)

4. **Browser cache?** Hard-refresh (Ctrl+Shift+R) clears most things.
   If issue persists, DevTools → Application → Storage → Clear site
   data → reload.

If none of the above and the issue is reproducible, then it's a real
application bug. **Screenshot the browser console FIRST** before
asking the agent — `Uncaught TypeError` + filename + line number
points at the actual problem in seconds, vs minutes-to-hours of
guessing without it.

## Where things live

| Looking for... | Path |
| --- | --- |
| Project rules | [.specify/memory/constitution.md](../../.specify/memory/constitution.md) (v1.1.0) |
| What we're building | [specs/001-vertical-slice/spec.md](../../specs/001-vertical-slice/spec.md) |
| How we're building it | [specs/001-vertical-slice/plan.md](../../specs/001-vertical-slice/plan.md) |
| Ordered task list | [specs/001-vertical-slice/tasks.md](../../specs/001-vertical-slice/tasks.md) |
| Replicable setup how-to | [docs/learning/00-setup-from-zero.md](./00-setup-from-zero.md) |
| Workflow reference | [docs/learning/01-spec-kit-workflow.md](./01-spec-kit-workflow.md) |
| Session-by-session story | [docs/learning/journal/](./journal/) |

## What's on disk

```
src/
├── main.ts                ← Vite entry; mounts Phaser into #game; registers SW
├── game.ts                ← T027 + T032 — full Phaser config + postBoot seeds
│                            `devMode` + KennyAssetService on the registry.
├── vite-env.d.ts          ← Vite + vite-plugin-pwa type refs
├── types/                 ← T013–T017 — typed contracts (no runtime)
│   ├── runtime-mode.ts    ←   RuntimeMode string-literal union
│   ├── save-state.ts      ←   SaveState + EMPTY_SAVE_STATE frozen const
│   ├── entity-config.ts   ←   EnemyConfig | CarrotConfig | PowerupConfig
│   ├── narrator-beat.ts   ←   NarratorBeat + NarratorTrigger union
│   └── level.ts           ←   LevelData (re-exports narrator types)
├── config/                ← T018 + T018a + T027 — tuning constants (Principle III)
│   ├── physics.ts         ←   gravity, max fall speed, friction
│   ├── hero.ts            ←   move/jump, coyote+buffer, lives, hit i-frames
│   ├── enemy.ts           ←   default patrol speed, contact knockback
│   ├── powerups.ts        ←   invincibility duration + stack mode + blink
│   ├── ui.ts              ←   HUD positions, dialog timings, fonts, FPS overlay
│   └── palette.ts         ←   T018a — PALETTE_HEX + PALETTE color tokens
├── i18n/                  ← T035a — translation seam (Principle III)
│   ├── en.ts              ←   EN catalog + I18nKey + I18nCatalog types
│   └── index.ts           ←   t() lookup, setLocale(), getActiveCatalog()
├── data/                  ← game-content data (separate from src/types/)
│   └── levels/
│       ├── index.ts       ←   T030 — LevelRegistry
│       └── level-01.tmj   ←   T029 — Tiled JSON map (60×18 @ 18px,
│                               three platforms, spawn + end on the
│                               `entities` layer)
├── entities/              ← T033 — game objects
│   ├── hero-input.ts      ←   pure resolver (HeroInput → HeroFrameAction).
│   │                          Movement direction, jump-fire, variable-
│   │                          height release-cap. Tested in 13 cases.
│   └── hero.ts            ←   Phaser sprite class. Owns CoyoteTimer,
│                              JumpBuffer, keyboard handlers (←/→/A/D/
│                              ↑/W/Space). Wires resolver to Arcade body.
├── services/              ← T020, T022, T023, T031 — I/O seams (Principle XI)
│   ├── save-service.ts    ←   SaveService interface + LocalStorageSaveService
│   ├── level-loader.ts    ←   T022 — pure loadLevel(); LevelLoadError
│   └── asset-service.ts   ←   T023 + T031 — discriminated-union
│                              AssetDeclaration; 2 Kenney declarations
├── systems/               ← T024–T026, T027, T035 — pure logic + debug overlay
│   ├── coyote-time.ts     ←   CoyoteTimer state machine (8 tests)
│   ├── jump-buffer.ts     ←   JumpBuffer (8 tests)
│   ├── physics-helpers.ts ←   clamp, pointInRect, pointDistanceSq,
│   │                          nextPatrolDirection (18 tests)
│   ├── touch-input-store.ts ← T035 — singleton boolean flags driven by
│   │                          UIScene's touch buttons; Hero reads each
│   │                          frame. 10 unit tests including the
│   │                          one-shot edge-detect on jump press.
│   └── debug-overlay.ts   ←   T027 — attachFpsOverlay(scene), dev-only.
└── scenes/
    ├── BootScene.ts       ← T032 — async preload, then start LevelScene.
    ├── MenuScene.ts       ← stub (stays a stub for v0)
    ├── LevelScene.ts      ← T034 — tilemap render + collision +
    │                          hero spawn + camera follow + end-trigger
    │                          overlap + launches UIScene.
    ├── UIScene.ts         ← T035 — touch buttons on touch devices
    │                          (feature-detected); portrait-rotate prompt
    │                          via matchMedia. HUD elements + narrator
    │                          land later (T043 / T049).
    └── GameOverScene.ts   ← T036 — "Level complete!" / "Game over" +
                               Play-again button (mouse + Enter + Space).

public/assets/             ← T029 + T031 — Kenney Pixel Platformer (CC0)
├── CREDITS.md             ←   provenance for every asset, per Principle VII
├── tilemaps/kenney-pixel-platformer/
│   ├── tilemap_packed.png ←   180-tile sheet (20×9 @ 18×18)
│   └── License.txt        ←   verbatim upstream CC0 license
└── sprites/kenney-pixel-platformer/
    ├── tilemap-characters_packed.png ← 27-character sheet (9×3 @ 24×24)
    └── License.txt

specs/001-vertical-slice/
└── playtests/
    └── us1.md             ← T037 — manual playtest checklist

tests/
└── unit/
    ├── save-service.test.ts      ← T019/T020b — 7 tests
    ├── i18n.test.ts              ← T035a — 3 tests
    ├── level-loader.test.ts      ← T021 — 11 tests
    ├── coyote-time.test.ts       ← T024 — 8 tests
    ├── jump-buffer.test.ts       ← T025 — 8 tests
    ├── physics-helpers.test.ts   ← T026 — 18 tests
    └── hero.test.ts              ← T033 — 13 tests (resolver only;
                                    Phaser sprite verified via T037)
                                    Total: 68 tests across 7 files.

(public/icons/ still has PWA icon stubs from T011; real icons land T052.)
```

## What's NOT on disk yet (and why that's fine)

- **No HUD** (hearts + carrot counter + power-up timer) — UIScene only
  has the touch buttons + portrait prompt today. HUD elements land at
  T043 (US2) when there's something to count.
- **No narrator dialog** — lands T049.
- **No entity dispatch** in LevelScene (enemy / carrot / powerup
  sprites) — US2 (T041) for enemies, US3 (T042) for collectibles. The
  level-loader already parses these; LevelScene just doesn't act on
  them yet.
- **No hero-death path** — GameOverScene's `"gameover"` outcome is
  declared but never fired today. Wired in US2 when enemies can hit.
- **No `screen.orientation.lock("landscape")` call.** Cross-browser
  reliability is too poor (iOS Safari doesn't support it; Chrome
  requires fullscreen). The PWA manifest declares landscape so
  installed PWAs respect it; the in-browser fallback is the visual
  rotate prompt.
- **Config values are placeholders** — the numbers in `src/config/*.ts`
  are reasonable starting points, NOT playtested. Run
  [playtests/us1.md](../../specs/001-vertical-slice/playtests/us1.md)
  to find what needs tuning. T060 (polish) is the dedicated retune
  pass.

## Next 3 actions (post-v0.3 economy)

1. **Playtest the v0.3 economy on the live URL** — the maintainer's
   end-to-end pass through the new flows. Walk:
   - Title screen → confirm Treasure Box panel shows top-right with
     "Player: guest" and zeroes (or whatever the legacy save migrated).
   - Play a level → collect some carrots → reach end-trigger → return
     to title → confirm Carrots count carried over.
   - Play again → die deliberately → confirm Carrots zeroed but Gems
     untouched.
   - Trade 10 carrots → 1 gem on MenuScene; trade back; confirm counts.
   - Tap "Switch player" → New → enter handle → confirm phrase shown
     once → enter game → confirm new profile is active in panel.
   - Tap "Switch player" → Restore → re-enter previous handle + wrong
     phrase → confirm "no save found" error → enter correct phrase →
     confirm restore.
   File any surprises as hot-fix branches off main.
2. **Decide next direction post-playtest** — three candidates, all
   architecturally ready:
   - **Bunny Hop ability** (cohort #9): first buyable. Spends gems
     from Treasure Box, owned forever. Needs price tuning.
   - **Damage-budget shield** (cohort #5): replaces the timed gold
     powerup. Buyable consumable stack. Needs balance pass.
   - **Polish pass on profile picker**: replace window.prompt with
     in-canvas input fields; show list of existing profile handles.
3. **Optional non-economy backlog** (still open from v0.1-demo):
   T051 narrator playtest sign-off; cross-browser matrix (T064a);
   real CC0 audio swap; adaptive narrator prototype.

Natural stopping points: after the v0.3 playtest, after the next
direction is chosen, after that direction's first PR ships.

## Stay-the-course sprint addendum (visual tone + identity, low drift)

Goal: keep the original 001 roadmap intact while introducing the reference
visual direction and a clearer unique value signal.

- **Work split: 80/20.**
  - 80%: planned roadmap execution (US3 T047 → T051).
  - 20%: low-risk polish/identity work that does not fork architecture.
- **Execution order for this sprint:**
  1. Land **US3 minimal** first (T047 narrator beat data, then T048/T049).
  2. Define **Art Direction v0.1** in existing docs/code comments only:
     limited palette, silhouette readability, 3 depth layers.
  3. Apply **Visual Pass 1** (small, reversible): background gradient,
     stronger silhouette contrast, 2-3 effects max.
  4. Prototype one differentiator behind a toggle: **adaptive narrator tone**
     reacting to cautious vs reckless play.
- **Guardrail:** no large content expansion (extra levels, bosses, heavy
  lore) until one polished level proves tone + narrator + one unique hook.
- **Decision gate after each playtest:** "Does this still feel like the
  original roadmap, only clearer and more distinctive?"

Natural stopping points: after T029/T030 (level data + registry), after
T032 (BootScene actually loads things), after T034 (hero can move on
the level), after T037 (US1 done, P1 MVP-floor demoable).

## Design ground rules (apply to every new piece of code or content)

These are the cross-cutting rules that haven't earned a dedicated
constitution principle but should be applied without re-asking:

- **Non-blocking degradation.** When something fails that the player
  didn't cause (storage refused a save, asset failed to load, network
  hiccup), the game MUST: (1) keep running, (2) show a non-blocking
  notice if the failure is player-visible, (3) log to console for
  diagnostics, (4) never retry in a tight loop. The first concrete
  example is `SaveQuotaExceededError` (Safari private mode); the same
  rule applies to any future I/O failure.
- **No hardcoded player-visible strings.** All UI text goes through
  `t("key")` from `src/i18n/index.ts`. Even if EN is the only locale,
  the seam stays.
- **No hardcoded colors.** All colors come from `PALETTE_HEX` /
  `PALETTE` in `src/config/palette.ts`. Exception: parse-time-only
  surfaces (index.html `<style>`, vite.config.ts manifest) keep the
  literal but ship with a comment naming the equivalent token.
- **No magic numbers in gameplay code.** All tuning lives in
  `src/config/*.ts`. Per-task playtest checklists feed the polish-phase
  re-tune (T060).
- **Services own all I/O.** Scenes never call `localStorage`, `fetch`,
  or asset URLs directly. Always through a service module.
- **Per-task commits with rationale.** Each commit explains the WHY,
  not just the what, in the body. Per-file scope where possible.

## Future roadmap (not in v0; doors are open)

These are explicitly OUT of scope for the 001 slice but mentioned
here so the architecture decisions don't accidentally close the door:

- **Multi-user profiles.** Each profile would have its own SaveState.
  Door open via the SaveService dependency-injection seam: extend the
  storage key from `carrot-code:v1:save` to `carrot-code:v1:save:<profileId>`
  and have SaveService take a `profileId` arg. Add a ProfileService for
  the picker UI. Estimated <1 day of work when needed.
- **User-selectable levels.** Player picks from a level list at the
  MenuScene. LevelRegistry (T030) is already the seam; what's missing
  is the MenuScene UI + unlock logic gated on
  `SaveState.completedLevelIds`. Per-level tuning stays in code (no
  runtime config tuning); a new level baseline = a redeploy.
- **Backend persistence (sync across devices).** Today SaveService is
  the authority; later it could become a write-back cache for a
  `RemoteSaveService`. The StorageLike interface is the seam. Likely
  triggered by "play on phone, continue on desktop" use case.
- **Difficulty settings.** Easy/Normal/Hard difficulty would layer on
  top of `src/config/hero.ts` via a small `DIFFICULTY_OVERRIDES` map.
  Post-v0; no playtest data justifies it until v0 ships.
- **Server-driven config / live-tune.** Explicit NON-goal. Per
  Constitution Principle XI we don't add network dependencies for
  things that work fine as static files.

## Open TODOs not blocking anything

These can stay open until they bite:

- **Node 20 in Actions runners** will be deprecated 2026-06-02. Bump to
  Node 22 in `.github/workflows/ci.yml` whenever the runner warning becomes
  an error. Currently informational only.
- **Phaser bundle size warning** in CI build output (1.3 MB). Address
  with code-splitting in the polish phase or when actual gameplay assets
  push us toward a payload budget concern.
- **README live demo line** points at the Azure SWA URL since spec 002
  shipped. Re-verify after every infra change.
- **CONTRIBUTING.md / CODE_OF_CONDUCT.md / issue templates** — not needed
  until the first stranger opens an issue or PR. See the
  2026-05-17-constitution-v1.1.0 journal entry for the Principle XII
  follow-up.
- **PWA icons missing** (404 on `/icons/icon-192.png`). The manifest
  declares them; the PNGs land in T052 (under `public/icons/`). Browser
  warning is informational; doesn't break install or play. If the
  warning becomes annoying before T052, comment out the icon block in
  [vite.config.ts](../../vite.config.ts) temporarily.
- **Constitution v1.1.1 ratified 2026-05-18.** Principle III now
  formally requires all player-visible text via `t()` and all colors
  via `PALETTE_HEX` / `PALETTE`. Parse-time-only surfaces (index.html,
  vite.config.ts) carry the literal with a `= PALETTE_HEX.<token>`
  comment so the cross-reference stays grep-able.

## How to pick up in a fresh chat

If you're a new agent reading this:

1. Read [.specify/memory/constitution.md](../../.specify/memory/constitution.md) (the rules; v1.1.1).
2. Read [specs/001-vertical-slice/spec.md](../../specs/001-vertical-slice/spec.md) (what we're building).
3. Read [specs/001-vertical-slice/plan.md](../../specs/001-vertical-slice/plan.md) (how we're building it; Constitution Check at the bottom).
4. Read [specs/001-vertical-slice/tasks.md](../../specs/001-vertical-slice/tasks.md) and find the first unchecked task.
5. Scan the most recent journal entry under [docs/learning/journal/](./journal/) for any open thread.
6. Confirm `npm run dev` works and CI is green on PR #1 before adding new code.

If you're a returning agent or a returning maintainer: this doc + the
latest journal entry should be enough. The slice scope hasn't changed
since 2026-05-14; only progress has.

## Conventions reminders (often-forgotten)

- **Per-task commits**, message prefixed `feat(setup): T0NN` or
  `feat(phase-2): T0NN`. Each commit body should explain *why*, not just
  what.
- **Never run `npm run format`** against the whole repo — it touches
  spec-kit-owned files and introduced mojibake once already. Use
  `npx prettier --write <path>` to format specific files. See the
  2026-05-18 journal (forthcoming) for the recovery story.
- **Stay on `001-vertical-slice`** until the slice ships. Merging to
  `main` requires CI green (now enforced).
- **Update this file** whenever something material changes — current task,
  branch name, open TODOs, what's on disk.
- **Notable spec-kit sessions get a journal entry** per Principle II.6.
  Trivial commits don't.
- **Test-first under CI-gate**: write tests first, observe RED locally,
  `git commit` the tests (don't push), write impl, observe GREEN, commit
  impl, push BOTH commits in one push. CI only sees the GREEN HEAD;
  history preserves the test-first ordering. See commit pair 6087c50 +
  e614673 for the canonical pattern.
- **PowerShell + apostrophes in `-m`**: don't. Use `git commit -F
  .commit-msg.tmp` (then `Remove-Item` it) for any message that has
  single quotes or nested `"`. PowerShell loses the rest of the chained
  command on a stray `'`.

## Memory / agent notes

The agent's persistent memory (across chats) records:

- `/memories/spec-kit.md` — transferable spec-kit setup gotchas.
- `/memories/public-repo-hygiene.md` — Principle XII as a transferable rule.
- `/memories/repo/carrot-code.md` — this project's locked decisions and
  current state. **This file should mirror the project state.** If they
  drift, the on-disk constitution + this handover are authoritative;
  memory is just a cache.
- `/memories/platform-reminders.md` — the platform-injected copyright
  reminder we've been silently ignoring all session is documented here.
  Future agents picking up the project should expect to see it and not
  derail.

### Project-specific subagents

- **`carrot-code-reviewer`** — independent ("judiciary") code/PR review
  pass codifying Constitution v1.1.1 + the design ground rules in this
  file as mechanical checks. Defined at
  [.github/agents/carrot-code-reviewer.agent.md](../../.github/agents/carrot-code-reviewer.agent.md).
  Read-only; reports findings at four severity levels (critical /
  high / medium / low); does not modify files.

  **When to invoke**: before merging any non-trivial PR, or whenever the
  maintainer wants an independent pair-of-eyes pass that wasn't
  authored by the same session that wrote the code. Three modes:
  - `mode: diff` + git-ref pair (e.g. `origin/main...HEAD`) — review
    a changeset
  - `mode: files` + a list of paths — review specific files
  - `mode: spec` + a `specs/NNN-*/` dir — review the spec/plan/tasks
    set as an internally consistent unit

  **Trigger phrases the orchestrating agent should recognise**:
  "review this PR", "run the reviewer agent", "independent check on
  the 00X spec", "pair of eyes on these changes". Surface as a
  `runSubagent` call with `agentName: "carrot-code-reviewer"`.

  **Use after 002 ships**, per the v1.1.2 amendment proposal:
  any plan with new infrastructure or new dependencies SHOULD invoke
  this reviewer (in addition to `/speckit.analyze`) before
  implementation begins.
