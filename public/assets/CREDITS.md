# Asset credits

This file records the provenance of every third-party asset shipped under `public/assets/`, per **Constitution Principle VII** (asset license clean + reproducible). All assets used by `carrot-code` MUST be either:

- **CC0 / public domain** (no attribution legally required, but recorded here for reproducibility), or
- **Original work** authored for this repo (note the author + date below).

If you're auditing licenses, this file is the source of truth. If a pack listed here ever has its license changed upstream, the version recorded here is the one we shipped under the CC0 terms that were in effect at download time — keep a local copy of the upstream license file (`LICENSE.txt` or `License.txt` from the pack) alongside the asset to prove it.

---

## Asset organization convention

To keep multiple upstream packs from colliding by filename and to make pack provenance grep-able from any asset path:

- **One subdirectory per upstream pack.** Pack subdirectory is named `<upstream>-<pack-slug>`, kebab-case, no spaces. Examples:
  - `public/assets/tilemaps/kenney-pixel-platformer/`
  - `public/assets/tilemaps/kenney-pixel-platformer-industrial-expansion/`
  - `public/assets/sprites/kenney-pixel-platformer/`
- **Original assets** (none yet) live under `public/assets/<category>/original/`.
- **Phaser asset keys are namespaced by pack** in `KennyAssetService.assets`. Format: `<category>-<pack-slug>-<asset-name>`. Examples:
  - `tiles-pixel-platformer-base`
  - `tiles-pixel-platformer-industrial`
  - `hero-pixel-platformer-character-a`
- **Each pack subdirectory ships the upstream `License.txt` or `LICENSE.txt`** verbatim. Do not edit, rename, or compress these files. They are the proof-on-disk for the license fields recorded below.
- **Mixing packs in a single level is supported.** A Tiled `.tmj` can reference multiple tilesets, Phaser's tilemap loader handles multi-tileset maps natively, and `src/services/level-loader.ts` does not restrict tileset count. To add an expansion pack to an existing level, declare its tileset in `KennyAssetService.assets`, add it to the Tiled map's tileset list, and reference its tiles from the existing `terrain` layer.

This convention exists so that adding [Pixel Platformer — Industrial Expansion](https://kenney.nl/assets/pixel-platformer-industrial-expansion) (or any other future pack) is a directory + a couple of declarations, not a refactor.

---

## Tilesets

### Pixel Platformer — base tiles (level-01)

- **Source:** <https://kenney.nl/assets/pixel-platformer>
- **Pack name:** Pixel Platformer
- **Pack version:** 1.2 (upstream creation date 2023-10-07, per `License.txt`)
- **Pack slug (this repo):** `kenney-pixel-platformer`
- **Download date:** 2026-05-18 (downloaded by `jasaimial`)
- **Author:** Kenney Vleugels (Kenney.nl)
- **License:** CC0 1.0 Universal (Public Domain)
- **License URL:** <https://creativecommons.org/publicdomain/zero/1.0/>
- **Tile size:** 18 × 18 px (180 tiles total — 20 columns × 9 rows; no spacing in the packed sheet)
- **Files in this repo:**
  - `public/assets/tilemaps/kenney-pixel-platformer/tilemap_packed.png` (the tileset image; we ship the _packed_ variant — no margin/spacing — to match Kenney's own example `.tsx` tileset definition and keep Phaser+Tiled config trivial)
  - `public/assets/tilemaps/kenney-pixel-platformer/License.txt` (verbatim upstream license)
  - `src/data/levels/level-01.tmj` (references the tileset above)
- **Modifications from upstream:** none

<!-- Future expansion (uncomment + fill in if Pixel Platformer — Industrial
     Expansion is added):

### Pixel Platformer — Industrial Expansion

- **Source:** https://kenney.nl/assets/pixel-platformer-industrial-expansion
- **Pack name:** Pixel Platformer — Industrial Expansion
- **Pack slug (this repo):** `kenney-pixel-platformer-industrial-expansion`
- **Version / download date:** YYYY-MM-DD
- **Author:** Kenney Vleugels (Kenney.nl)
- **License:** CC0 1.0 Universal (Public Domain)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Tile size:** 18 × 18 px (matches base pack — designed to composite)
- **Files in this repo:**
  - public/assets/tilemaps/kenney-pixel-platformer-industrial-expansion/<filename>
  - public/assets/tilemaps/kenney-pixel-platformer-industrial-expansion/License.txt
- **Used by levels:** <e.g. level-04 onwards>
- **Modifications from upstream:** none
-->

---

## Sprites

### Hero (carrot)

- **Source:** <https://kenney.nl/assets/pixel-platformer> (character sprites bundled with the base pack)
- **Pack name:** Pixel Platformer
- **Pack version:** 1.2 (upstream creation date 2023-10-07)
- **Pack slug (this repo):** `kenney-pixel-platformer`
- **Download date:** 2026-05-18 (downloaded by `jasaimial`)
- **Author:** Kenney Vleugels (Kenney.nl)
- **License:** CC0 1.0 Universal (Public Domain)
- **License URL:** <https://creativecommons.org/publicdomain/zero/1.0/>
- **Files in this repo:**
  - `public/assets/sprites/kenney-pixel-platformer/tilemap-characters_packed.png`
  - `public/assets/sprites/kenney-pixel-platformer/License.txt` (verbatim upstream license; intentionally duplicated from the tilemaps subdirectory so each pack subdirectory is self-contained per the **Asset organization convention** above)
- **Frame layout:** 24 × 24 px tiles, 9 columns × 3 rows = 27 character sprites total. Each cell is a _different_ character (not animation frames of one character). The Pixel Platformer pack ships static-pose characters only — no built-in idle/run/jump animation strip. We will simulate movement in v0 by toggling a small set of frames (chosen below); proper sprite-sheet animations land later with a custom carrot recolor.
- **Selected hero frame for v0:** **Frame 0** — the top-left character on `tilemap-characters_packed.png` (column 0, row 0, 0-based). Chosen as a neutral placeholder; swap by changing the `frame` field on the corresponding `AssetDeclaration` in `src/services/asset-service.ts` and updating this line.
- **Carrot substitution plan:** the base Pixel Platformer pack does not include a carrot character. Initial v0 uses one of the included character sprites as a placeholder (recorded above). A custom carrot recolor / sprite-edit (per Constitution Principle I — original IP) lands in a later iteration; that work will get its own entry under **Original assets** below.
- **Modifications from upstream:** none (v0 placeholder uses upstream sprite as-is; replaced by original carrot art in a later task)

### Enemies

<TODO: add per-enemy-sprite blocks here as US2 work introduces them.
Template:>

<!--
### <Enemy name>

- **Source:** ...
- **Pack name:** ...
- **Version / download date:** ...
- **Author:** ...
- **License:** ...
- **Files in this repo:** ...
- **Modifications:** ...
-->

### Powerups / collectibles

<TODO: carrot collectible sprite, invincibility powerup sprite — same
template as above. US1 adds the carrot collectible; US2/US3 add the
powerup.>

---

## Audio

<TODO: SFX + music. Spec doesn't require audio in v0; this section
exists as a placeholder for when it lands.>

---

## Fonts

<TODO: only if we ship a custom bitmap font. The default Phaser text
rendering uses system fonts, which don't need attribution.>

---

## Original assets

Assets authored specifically for this repo. None yet — all v0 assets are
sourced from Kenney.nl. When this changes, list per-asset with author +
date.

---

## How to add a new asset to this file

1. Download the asset from its upstream source.
2. Place the file under the correct subdirectory of `public/assets/`.
3. Add a block to the appropriate section above with **all** the fields
   filled in (no `<TODO>` placeholders left in committed files).
4. Update `src/services/asset-service.ts` `KennyAssetService.assets`
   array with the matching `AssetDeclaration`.
5. Commit asset + this file + the AssetService update **together** in a
   single commit so provenance never drifts.
