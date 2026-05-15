# Feature Specification: Vertical Slice

**Feature Branch**: `001-vertical-slice`

**Created**: 2026-05-14

**Status**: Draft

**Input**: User description: "One level. Hero with run + jump. One enemy. One collectible (carrot). One power-up. One narrator-style dialog beat. Working in browser + iOS standalone home-screen install. Free of known correctness bugs. Deployed publicly."

## User Scenarios & Testing *(mandatory)*

This is the project's MVP per Constitution Principle V: *one* polished level
shipped end-to-end before *any* breadth work begins. Each user story below
is an independently demonstrable slice that builds on the previous one.
"Demonstrable" here means a player can sit down at the build, do the thing,
and judge it on its own — not "the code compiles."

### User Story 1 — Play through a level (Priority: P1)

A first-time player opens the game URL, sees the level, and can run, jump,
and reach the end of the level using their own input.

**Why this priority**: Without this, nothing else matters. A platformer that
can't be played-through is a tech demo, not a game. Every later story
assumes this loop works.

**Independent Test**: Open the deployed URL on a desktop browser. Use
keyboard. Reach the right edge of the level (level-end trigger) starting
from the left edge (spawn). The game responds to input without visible
lag, the hero animates while moving, and the level visibly "ends" in some
unambiguous way (text, sound, scene change — not just running off-screen).

**Acceptance Scenarios**:

1. **Given** the player has just loaded the game on desktop, **When** they
   press the assigned right-direction key, **Then** the hero moves right
   at a consistent speed and a "running" animation plays.
2. **Given** the hero is on the ground, **When** the player presses the
   assigned jump key, **Then** the hero leaves the ground, follows a
   plausible jump arc, and lands back on the ground.
3. **Given** the hero is mid-jump, **When** the player releases the jump
   key early, **Then** the jump is shorter than if held to apex (variable-
   height jump, modern-platformer expectation).
4. **Given** the hero is positioned at the level-end trigger, **When**
   contact occurs, **Then** the player sees an unambiguous "level
   complete" outcome and is given a way to play again.
5. **Given** the player is on a touchscreen (mobile browser), **When** they
   load the same URL, **Then** they see touch controls (movement +
   jump) overlaid on the play area, and movement/jump produce the same
   results as on desktop.

---

### User Story 2 — Face stakes and gather rewards (Priority: P2)

The level contains an enemy that threatens the hero, a collectible (carrot)
the player can pick up, and a power-up that briefly changes the player's
state. The level becomes a *game*, not a navigation puzzle.

**Why this priority**: Story 1 produces a movement demo. Story 2 produces
the smallest thing that feels like a game — risk, reward, choice.

**Independent Test**: Play the level. Encounter the enemy and observe a
threat (the hero loses a life or restarts). Pick up at least one carrot
and observe a HUD count update. Pick up the power-up and observe a visible
state change on the hero plus a duration; while the power-up is active,
observe that the enemy threat behaves differently (per the resolved
clarification on enemy defeat).

**Acceptance Scenarios**:

1. **Given** the hero contacts the enemy without an active power-up,
   **When** the contact occurs, **Then** the hero loses a life (HUD
   updates), is briefly invulnerable, and respawns at the level start (or
   loses the run if no lives remain — see Story 1 acceptance #4 for
   level-restart UX).
2. **Given** the hero is overlapping a carrot, **When** contact occurs,
   **Then** the carrot disappears from the level, the on-screen carrot
   count increases by one, and the carrot does not re-appear during the
   same play-through unless the player respawns at the start.
3. **Given** the hero is overlapping the power-up, **When** contact
   occurs, **Then** the power-up disappears, the hero displays a visible
   "powered" state (color shift, glow, or animation overlay), and a timer
   indicator is visible to the player.
4. **Given** the power-up is active, **When** the timer reaches zero,
   **Then** the hero returns to normal state and the timer indicator
   disappears; if the player picks up the power-up again, the timer is
   replaced by a fresh-duration timer (refresh, not stack).
5. **Given** the hero has an active power-up, **When** the hero contacts
   the enemy, **Then** the hero passes through the enemy harmlessly with
   no life lost; the enemy continues its normal behaviour unaffected
   (the enemy cannot be defeated in this slice).
6. **Given** the hero loses all lives, **When** the last life is lost,
   **Then** the player sees a "game over" outcome and is given a way to
   restart the level from the beginning.

---

### User Story 3 — Hear the narrator (Priority: P3)

At a defined moment in the level, a narrator dialog box appears with a
short message that establishes the project's meta-narrator personality
(the "voice on the handheld console" framing — original characters and
language, no copyrighted IP per Constitution Principle I).

**Why this priority**: Without this, the slice is a competent generic
platformer. The narrator is the *one* element that distinguishes this
project from any other 2D platformer tutorial. Worth shipping in the slice
even though it's the smallest piece of code, because it sets the tone the
whole project is built around.

**Independent Test**: Trigger the narrator beat (per the resolved
assumption on trigger location). Observe a dialog box that does not
require the player to read code, that has a clear way to dismiss, and that
remains accessible (re-triggerable on a fresh play-through, ignorable for
players who just want to play). The dialog content is original prose with
no copyrighted phrasing.

**Acceptance Scenarios**:

1. **Given** the player has just spawned at the start of the level for the
   first time in this session, **When** they take their first action,
   **Then** within a few seconds a narrator dialog box appears with a
   short, original tutorial-flavored message.
2. **Given** the narrator dialog is visible, **When** the player presses
   the assigned advance/dismiss input (or taps the dialog on touch),
   **Then** the dialog disappears and the player can continue without
   visual obstruction.
3. **Given** the narrator dialog is visible, **When** several seconds pass
   with no input, **Then** the dialog auto-advances or persists per the
   chosen UX (documented assumption), and in no case does it block input
   indefinitely with no visible way to dismiss.
4. **Given** the player has dismissed the dialog and continues the level,
   **When** they reach the end and choose to replay, **Then** the dialog
   re-appears at the same trigger on the new play-through (it is part of
   the level, not a one-time event).

---

### User Story 4 — Install and play like a real app (Priority: P4)

The player visits the deployed URL on a phone or desktop browser, installs
the game using the platform's native install mechanism, launches it from
the home screen / app launcher, and plays — including offline. To a
casual user, the installed result is indistinguishable from a native app.

**Why this priority**: Per Constitution Principle V, this is the
*definition* of "shipped" for this project, not a stretch goal. P4 only
because it depends on the gameplay being there to install. Without it,
the slice is not done.

**Independent Test**: Visit the deployed URL on each of: latest Chromium
on desktop, latest Chrome on Android, current-generation Safari on iOS.
Use the platform's install path (PWA install prompt on Chromium / Android;
"Add to Home Screen" on iOS). Launch the game from the resulting icon.
Confirm: opens with no visible browser chrome, custom icon and splash,
plays normally, plays normally **with airplane mode on**.

**Acceptance Scenarios**:

1. **Given** a player visits the deployed URL on desktop Chromium or Edge,
   **When** the install prompt appears (or they invoke install from the
   browser menu), **Then** installing produces a standalone app window
   with a custom icon, no browser address bar, and a usable game.
2. **Given** a player visits the deployed URL on Android Chrome, **When**
   they install via the "Add to Home Screen" prompt, **Then** the home-
   screen icon launches into a chromeless standalone window and the game
   is fully playable.
3. **Given** a player visits the deployed URL on iOS Safari, **When** they
   tap Share → Add to Home Screen, **Then** the resulting home-screen
   icon launches the game in standalone mode (no Safari address bar or
   bottom toolbar leaking through), shows a custom splash image during
   load, and the game is fully playable. To a casual observer, the result
   is indistinguishable from a native iOS app.
4. **Given** a player has installed the game on any supported platform,
   **When** they launch it with no network connectivity (airplane mode),
   **Then** the game loads and is fully playable using only locally cached
   assets.
5. **Given** a player has installed the game and played once, **When**
   they re-launch days later, **Then** the install still works (no expired
   cache, no required re-fetch), and any previously saved progress (per
   Story 2 — last-completed level, total carrots) is preserved.

---

### Edge Cases

- **Player presses jump while already mid-air.** The jump input is ignored
  during the airborne phase (no double-jump in this slice). Holding the
  key does not buffer a second jump.
- **Player walks off the edge of a platform without jumping.** A short
  "coyote time" window allows the jump key to still trigger a jump for a
  fraction of a second after leaving the ground (modern platformer feel,
  documented as assumption).
- **Player buffers a jump just before landing.** A jump pressed within a
  short window before landing fires immediately on landing (input
  buffering, documented as assumption).
- **Power-up active when hit by enemy.** The hero passes through the
  enemy harmlessly; no life lost, no power-up consumption (the timer
  continues normally). The enemy is unaffected.
- **Player tries to install the PWA twice on the same device.** The
  browser handles the duplicate; the game does not require any in-game
  reaction.
- **iOS standalone launches but offline assets are missing.** A clear
  error screen explains that the game needs an initial online launch
  before offline play is available, rather than a blank or broken state.
- **Player rotates the device.** On mobile, the game either supports both
  orientations or locks to one and explains why (documented assumption:
  landscape-locked on phones, free-form on tablets/desktop).
- **Player taps narrator dialog while it is animating in.** The dialog
  reaches its final visible state before accepting dismiss input (no
  partial-state dismiss).
- **Player reaches the level end while a power-up is active.** The level
  completes normally; the power-up has no impact on the end-of-level
  outcome.
- **Browser denies offline cache (private mode, storage full).** The game
  works in online mode; install option may be hidden or surface a clear
  explanation rather than failing silently.
- **Player loads the URL on an unsupported browser (e.g., very old
  iOS).** The page surfaces a clear "your browser is not supported,
  please use [list]" message rather than rendering a broken game.

## Requirements *(mandatory)*

### Functional Requirements

**Hero & input**

- **FR-001**: System MUST render a player-controlled hero character in
  the level at the spawn point.
- **FR-002**: Players MUST be able to move the hero left and right
  horizontally using a primary input (keyboard on desktop, on-screen
  touch controls on touchscreens).
- **FR-003**: Players MUST be able to make the hero jump using a primary
  input. The jump MUST have variable height based on how long the input
  is held.
- **FR-004**: System MUST apply gravity so the hero returns to the ground
  after every jump.
- **FR-005**: The hero MUST NOT pass through ground tiles, walls, or
  level boundaries.
- **FR-006**: System MUST provide on-screen touch controls when the player
  is on a touchscreen device, sized and positioned to be usable one-
  handed on a typical phone in landscape orientation.

**Level**

- **FR-007**: System MUST render exactly one level as the entire game
  world for v0.
- **FR-008**: The level MUST contain a defined start point (where the
  hero spawns) and a defined end point (a trigger that completes the
  level).
- **FR-009**: The level MUST contain at least one elevated platform
  reachable only by jumping, so the jump mechanic is meaningfully used.
- **FR-010**: System MUST detect when the hero contacts the level-end
  trigger and surface a "level complete" outcome to the player.

**Enemy**

- **FR-011**: The level MUST contain exactly one enemy in v0.
- **FR-012**: The enemy MUST exhibit a visible behaviour pattern (patrol,
  hover, or similar — defined per resolved clarification) so the player
  can learn to avoid or defeat it.
- **FR-013**: System MUST detect contact between the hero and the enemy.
- **FR-014**: When the hero contacts the enemy without an active power-up,
  the hero MUST lose one life (avoidance-only enemy model — the enemy
  cannot be defeated by stomping, projectile, or any other means in this
  slice).

**Carrot collectible**

- **FR-015**: The level MUST contain at least three carrot collectibles
  placed at varied positions (some easy, some requiring jumps).
- **FR-016**: When the hero contacts a carrot, the carrot MUST disappear
  for the remainder of the play-through and a visible carrot count MUST
  increase by one.
- **FR-017**: All carrots MUST reappear when the player restarts the
  level (whether by death or by replay).

**Power-up**

- **FR-018**: The level MUST contain exactly one power-up pickup in v0.
- **FR-019**: When the hero contacts the power-up, the power-up MUST
  disappear and the hero MUST enter a visibly distinct "powered" state
  for a fixed duration with a visible timer indicator.
- **FR-020**: While powered, the hero MUST be able to contact the enemy
  without losing a life and without consuming the powered state (the
  power-up grants brief invincibility / pass-through against the enemy;
  it does NOT enable defeating the enemy).
- **FR-021**: When the powered duration expires, the hero MUST return to
  normal state with no residual effects.

**Lives, death, restart**

- **FR-022**: The hero MUST start each level with a small fixed number
  of lives (default: 3, displayed as hearts in the HUD).
- **FR-023**: When the hero loses a life, system MUST grant a brief
  invulnerability window during respawn so the player cannot lose
  multiple lives in immediate succession from the same hazard.
- **FR-024**: When the hero loses the last life, system MUST surface a
  "game over" outcome and offer a way to restart the level from the
  beginning.
- **FR-025**: System MUST NOT permanently penalize the player for losing
  — restart from a "game over" state MUST be possible without re-loading
  the page.

**Narrator**

- **FR-026**: The level MUST contain exactly one narrator dialog beat in
  v0.
- **FR-027**: System MUST display the narrator dialog at a defined trigger
  (default assumption: shortly after spawn, tutorial-style).
- **FR-028**: The narrator dialog MUST be dismissable by an explicit
  player input (key, button, or tap), and MUST NOT block input
  indefinitely without a visible dismiss affordance.
- **FR-029**: All narrator content MUST be original prose; no character
  names, catchphrases, or stylistic mimicry of copyrighted properties
  per Constitution Principle I.

**HUD**

- **FR-030**: System MUST display, at all times during gameplay, the
  hero's remaining lives, the current carrot count, and the power-up
  timer (when active).
- **FR-031**: HUD elements MUST remain readable on the smallest target
  device (a 2022-era mid-range phone in landscape).

**PWA & install**

- **FR-032**: The deployed game MUST be installable as a PWA on desktop
  Chromium-based browsers via the standard install prompt or browser
  menu.
- **FR-033**: The deployed game MUST be installable on Android Chrome via
  the standard "Add to Home Screen" prompt.
- **FR-034**: The deployed game MUST be installable on iOS Safari via
  Share → "Add to Home Screen", and MUST launch in standalone mode (no
  browser chrome, no Safari toolbars) from the resulting home-screen
  icon.
- **FR-035**: The installed game MUST display a custom app icon and a
  custom splash screen on each supported platform.
- **FR-036**: Once the game has been loaded online at least once, the
  game MUST be fully playable offline (airplane mode) on every supported
  platform.
- **FR-037**: System MUST persist player progress (last-completed level
  state, total carrots collected) between sessions on the same device.

**Deployment**

- **FR-038**: The game MUST be deployed to a public HTTPS URL accessible
  without authentication.
- **FR-039**: The deployed build MUST be free of known correctness bugs
  before being declared "shipped" (per Constitution Principle V).

**Browser support**

- **FR-040**: System MUST run on the latest two major versions of
  Chromium-based browsers (Chrome, Edge), Firefox, and Safari, on
  desktop and mobile per the constitution's browser baseline.
- **FR-041**: When loaded on an unsupported browser, system MUST surface
  a clear "browser not supported" message rather than render a broken
  state.

**Accessibility (minimum bar)**

- **FR-042**: System MUST allow the player to play the game through a
  full level using only the keyboard, and through a full level using
  only touch input — no mixed-input requirement.
- **FR-043**: HUD text MUST meet basic legibility standards (high contrast
  against background; minimum size readable on a phone at arm's length).

### Key Entities

- **Hero**: the player-controlled character. Has a position, velocity,
  state (idle / running / jumping / falling / powered / hurt), and a
  remaining-lives count. State is per-play-through (resets on level
  restart).
- **Enemy**: a single hostile entity with a position and a patrol
  behaviour. Contact with the un-powered hero costs the hero a life;
  contact with the powered hero is harmless. The enemy itself has no
  defeat condition in this slice (avoidance-only). State is
  per-play-through.
- **Carrot**: a collectible with a position. Either present or
  collected-this-play-through. Resets on level restart.
- **Power-up**: a single pickup with a position and a triggered effect on
  the hero (visible state + timer). Either present or consumed-this-
  play-through. Resets on level restart.
- **Narrator beat**: a single dialog event with a trigger condition, a
  text payload, and a dismiss state.
- **Level**: a defined playable area with a spawn point, an end-trigger,
  ground/walls, the placements of all of the above entities, and a name
  / identifier suitable for save data.
- **Save state**: per-device persistent record of completed levels and
  total carrots collected across all sessions. Stored locally; no
  server-side state in v0.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time player who has never seen the game can complete
  the level on their first attempt within 3 minutes of loading the URL,
  using only on-screen affordances (no out-of-game instructions).
- **SC-002**: From first visiting the URL to launching the installed game
  from the home screen on iOS, the player completes the install in under
  90 seconds with no instructions beyond what the game itself surfaces.
- **SC-003**: When launched from the home screen on iOS or Android, no
  player notices browser chrome (address bar, bottom toolbar, etc.). The
  installed result is indistinguishable from a native app to a casual
  user.
- **SC-004**: With airplane mode on, an installed copy of the game loads
  to a playable state within 5 seconds on the baseline mobile target.
- **SC-005**: The game feels smooth — players do not perceive frame drops,
  stutter, or input lag on any baseline-target device under normal
  gameplay (no enemies stacked beyond design, no concurrent power-ups
  beyond design).
- **SC-006**: Across at least 5 first-time playtests, the slice is
  considered "ready to share" by the playtester (qualitative thumbs-up,
  not "needs work").
- **SC-007**: Zero known correctness bugs at the time of declaring the
  slice shipped (per Constitution Principle V's definition of "shipped").

## Assumptions

These are the defaults applied where the user description left detail
unspecified. Each is reasonable for the slice; each can be revisited via
spec amendment.

- **Engine, language, build, deploy targets, testing framework, and
  asset-license baseline** are inherited from the constitution's
  Technology & Asset Constraints section, not re-litigated here.
- **Lives model**: 3 hearts per attempt; lose all → game over → restart
  level. (Standard 8-bit-platformer convention. Could be amended to
  unlimited-respawn or checkpoint-based later.)
- **Movement feel**: includes coyote time (~100 ms grace after walking
  off a ledge) and jump input buffering (~100 ms before landing).
  Modern-platformer expectations; both are cheap to implement and the
  game feels off without them.
- **Power-up effect**: brief invincibility (~5–8 seconds, exact value to
  be tuned and recorded in `src/config/`) that lets the hero pass
  through the enemy harmlessly. The visible "powered" state is a sprite
  color/glow shift, not a costume change in v0. Per Q1 (resolved as
  avoidance-only), the power-up does NOT enable the hero to defeat the
  enemy — the enemy persists and resumes threatening the hero when the
  timer expires.
- **Narrator trigger**: appears shortly after spawn (~2 seconds), serving
  as a tutorial-flavored welcome line. Re-fires on every fresh play-
  through.
- **Narrator dismiss**: requires an explicit player input (no auto-
  advance after timeout); the input prompt is visible on the dialog.
- **Touch controls**: on phones, landscape-locked; layout is a
  left-thumb d-pad (left/right) and a right-thumb jump button. Tablets
  and desktop respect device orientation.
- **Save scope**: stores last-completed level identifier and lifetime
  carrot total. No mid-level save (level is short enough to replay).
- **No audio is required for v0 to be considered "shipped"** — but if
  audio is included, it MUST be CC0 per Principle VII and MUST be
  toggleable (or muted by default, depending on browser autoplay
  policies).
- **No accounts, online leaderboards, multiplayer, or analytics** —
  explicit exclusions per Constitution Principle XI. The slice is
  single-player local with no telemetry.
- **One level only** — explicit exclusion per Constitution Principle V.
  Adding level 2 is a separate spec, not an extension of this one.
- **Asset baseline**: Kenney.nl CC0 placeholders for sprites, tiles, and
  optional audio per Constitution Principle VII. Custom or AI-assisted
  art is a parallel later track that swaps assets without code changes.

## Dependencies

- Working spec-kit installation (already in place, per the project's
  bootstrap journal entry).
- Free CC0 placeholder assets from kenney.nl. No account required;
  redistributable.
- A free Netlify or GitHub Pages account for the public deploy target.
- A test iPhone and a test Android device — or trusted equivalents — to
  validate the install and offline acceptance scenarios. (Browser dev
  tools simulate but do not certify.)
