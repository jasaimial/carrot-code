// -----------------------------------------------------------------------------
// carrot-code — AssetService data-driven test sweep (Layer 1)
//
// Iterates KennyAssetService.assets and verifies, for every declaration:
//
//   1. The declared URL points at a file that actually exists under
//      public/ (catches typos, deleted assets, renamed packs).
//   2. The declared approxBytes is roughly correct (within 10%) so the
//      eventual asset-budget verifier (T059) reasons about real sizes.
//   3. Asset keys are unique within the service (urlOf() would silently
//      return the first match on a duplicate; the test makes "first wins"
//      an explicit invariant rather than a latent footgun).
//
// Adding a new asset earns this coverage automatically.
//
// See:
//   src/services/asset-service.ts
//   .specify/memory/constitution.md  — Principles X + XI
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { statSync } from "node:fs";
import { resolve } from "node:path";

import { KennyAssetService } from "../../src/services/asset-service.js";

const service = new KennyAssetService();
const publicDir = resolve(__dirname, "..", "..", "public");

describe("KennyAssetService declarations", () => {
  it("declares at least one asset (sanity check)", () => {
    expect(service.assets.length).toBeGreaterThan(0);
  });

  it("each declared url resolves to a real file on disk under public/", () => {
    for (const decl of service.assets) {
      const absPath = resolve(publicDir, decl.url);
      // statSync throws if the path does not exist; expect.fail would
      // hide the actual ENOENT — let it propagate so the failing path
      // appears in the test output.
      expect(() => statSync(absPath), `asset url not found: ${decl.url}`).not.toThrow();
    }
  });

  it("declared approxBytes is within 10% of the file's real size", () => {
    for (const decl of service.assets) {
      const absPath = resolve(publicDir, decl.url);
      const realSize = statSync(absPath).size;
      const drift = Math.abs(realSize - decl.approxBytes) / realSize;
      expect(
        drift,
        `${decl.key} approxBytes=${String(decl.approxBytes)} real=${String(realSize)}`,
      ).toBeLessThan(0.1);
    }
  });

  it("asset keys are unique (urlOf() is unambiguous)", () => {
    const keys = service.assets.map((a) => a.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});

describe("KennyAssetService.urlOf", () => {
  it("returns the declared url for a known key", () => {
    const first = service.assets[0];
    expect(first, "asset list is empty").toBeDefined();
    if (first === undefined) {
      return;
    }
    expect(service.urlOf(first.key)).toBe(first.url);
  });

  it("throws for an unknown key", () => {
    expect(() => service.urlOf("not-a-real-key")).toThrow(/not-a-real-key/);
  });
});
