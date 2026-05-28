// -----------------------------------------------------------------------------
// tests/unit/save-service.test.ts (v2)
//
// Re-baselined for v2 schema (2026-05-27). Covers:
//   - Original six v1 contract cases adapted for v2 (round-trip,
//     empty, malformed JSON, unknown version, dedupe-sort, quota).
//   - v2-specific: profile-scoped keys, gem cap enforcement,
//     abilities dedupe-sort, currentCarrots clamping.
//   - v1 → v2 auto-migration on construction.
// -----------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_SAVE_STATE, MAX_GEMS_PER_PROFILE } from "../../src/types/save-state.js";
import {
  LEGACY_PROFILE_KEY,
  LocalStorageSaveService,
  SaveQuotaExceededError,
  type SaveStateInput,
  type StorageLike,
} from "../../src/services/save-service.js";

const KEY_PREFIX = "carrot-code:v2:save:";
const V1_KEY = "carrot-code:v1:save";
const FIXED_NOW_ISO = "2026-05-27T12:00:00.000Z";
const PROFILE_A = "abcdef1234";
const PROFILE_B = "fedcba9876";

/** In-memory Storage fake. Implements only the subset SaveService uses. */
class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  public removeItem(key: string): void {
    this.data.delete(key);
  }

  public seed(key: string, value: string): void {
    this.data.set(key, value);
  }

  public has(key: string): boolean {
    return this.data.has(key);
  }
}

/** Storage fake whose setItem always throws, simulating quota exhaustion. */
class QuotaExceededStorage implements StorageLike {
  public getItem(_key: string): string | null {
    return null;
  }

  public setItem(_key: string, _value: string): void {
    const err = new Error("QuotaExceededError: simulated");
    err.name = "QuotaExceededError";
    throw err;
  }

  public removeItem(_key: string): void {
    /* no-op */
  }
}

describe("LocalStorageSaveService (v2)", () => {
  let storage: MemoryStorage;
  let warn: ReturnType<typeof vi.fn<(msg: string) => void>>;
  let service: LocalStorageSaveService;

  beforeEach(() => {
    storage = new MemoryStorage();
    warn = vi.fn<(msg: string) => void>();
    service = new LocalStorageSaveService({
      storage,
      logger: (msg: string) => {
        warn(msg);
      },
      clock: () => new Date(FIXED_NOW_ISO),
      skipLegacyMigration: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const minimalInput = (overrides: Partial<SaveStateInput> = {}): SaveStateInput => ({
    version: 2,
    profileHandle: "speedy",
    currentCarrots: 0,
    gems: 0,
    abilities: [],
    completedLevelIds: [],
    ...overrides,
  });

  // --- Case 1: round-trip --------------------------------------------------
  it("round-trips a valid v2 SaveStateInput through save → load", () => {
    const input = minimalInput({
      currentCarrots: 12,
      gems: 47,
      abilities: ["bunny-hop"],
      completedLevelIds: ["level-01"],
    });
    service.save(PROFILE_A, input);
    const loaded = service.load(PROFILE_A);

    expect(loaded.version).toBe(2);
    expect(loaded.profileHandle).toBe("speedy");
    expect(loaded.currentCarrots).toBe(12);
    expect(loaded.gems).toBe(47);
    expect(loaded.abilities).toEqual(["bunny-hop"]);
    expect(loaded.completedLevelIds).toEqual(["level-01"]);
    expect(loaded.lastPlayedAtIso).toBe(FIXED_NOW_ISO);
  });

  // --- Case 2: empty / first launch ---------------------------------------
  it("returns EMPTY_SAVE_STATE when storage has no key for the profile", () => {
    const loaded = service.load(PROFILE_A);
    expect(loaded).toEqual(EMPTY_SAVE_STATE);
    expect(warn).not.toHaveBeenCalled();
  });

  // --- Case 3: malformed JSON ---------------------------------------------
  it("returns EMPTY_SAVE_STATE and warns on malformed JSON in storage", () => {
    storage.seed(KEY_PREFIX + PROFILE_A, "{not json at all");
    const loaded = service.load(PROFILE_A);
    expect(loaded).toEqual(EMPTY_SAVE_STATE);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  // --- Case 4: unknown version --------------------------------------------
  it("returns EMPTY_SAVE_STATE and warns on unknown payload version", () => {
    storage.seed(
      KEY_PREFIX + PROFILE_A,
      JSON.stringify({
        version: 99,
        profileHandle: "x",
        currentCarrots: 0,
        gems: 0,
        abilities: [],
        completedLevelIds: [],
        lastPlayedAtIso: FIXED_NOW_ISO,
      }),
    );
    const loaded = service.load(PROFILE_A);
    expect(loaded).toEqual(EMPTY_SAVE_STATE);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  // --- Case 5: dedupe + sort (level ids AND abilities) --------------------
  it("dedupes and sorts completedLevelIds + abilities on write", () => {
    service.save(
      PROFILE_A,
      minimalInput({
        completedLevelIds: ["b", "a", "a", "c", "b"],
        abilities: ["bunny-hop", "shield", "bunny-hop"],
      }),
    );
    const loaded = service.load(PROFILE_A);
    expect(loaded.completedLevelIds).toEqual(["a", "b", "c"]);
    expect(loaded.abilities).toEqual(["bunny-hop", "shield"]);
  });

  // --- Case 6: quota exhaustion -------------------------------------------
  it("throws SaveQuotaExceededError when setItem throws", () => {
    const failing = new LocalStorageSaveService({
      storage: new QuotaExceededStorage(),
      logger: (msg: string) => {
        warn(msg);
      },
      clock: () => new Date(FIXED_NOW_ISO),
      skipLegacyMigration: true,
    });
    expect(() => {
      failing.save(PROFILE_A, minimalInput());
    }).toThrow(SaveQuotaExceededError);
  });

  // --- Bonus: clear --------------------------------------------------------
  it("clear() removes the storage key for that profile only", () => {
    service.save(PROFILE_A, minimalInput({ gems: 5 }));
    service.save(PROFILE_B, minimalInput({ gems: 10 }));
    service.clear(PROFILE_A);
    expect(service.load(PROFILE_A)).toEqual(EMPTY_SAVE_STATE);
    expect(service.load(PROFILE_B).gems).toBe(10);
  });

  // --- v2: gem cap enforcement --------------------------------------------
  it("clamps gems at MAX_GEMS_PER_PROFILE on save", () => {
    service.save(PROFILE_A, minimalInput({ gems: MAX_GEMS_PER_PROFILE + 1000 }));
    expect(service.load(PROFILE_A).gems).toBe(MAX_GEMS_PER_PROFILE);
  });

  it("rejects load of a payload with gems exceeding the cap", () => {
    storage.seed(
      KEY_PREFIX + PROFILE_A,
      JSON.stringify({
        version: 2,
        profileHandle: "x",
        currentCarrots: 0,
        gems: MAX_GEMS_PER_PROFILE + 1,
        abilities: [],
        completedLevelIds: [],
        lastPlayedAtIso: FIXED_NOW_ISO,
      }),
    );
    expect(service.load(PROFILE_A)).toEqual(EMPTY_SAVE_STATE);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  // --- v2: clamping non-integer / negative currentCarrots ----------------
  it("clamps negative currentCarrots to 0 on save", () => {
    service.save(PROFILE_A, minimalInput({ currentCarrots: -50 }));
    expect(service.load(PROFILE_A).currentCarrots).toBe(0);
  });

  it("floors non-integer currentCarrots on save", () => {
    service.save(PROFILE_A, minimalInput({ currentCarrots: 12.7 }));
    expect(service.load(PROFILE_A).currentCarrots).toBe(12);
  });

  // --- v2: profile isolation ----------------------------------------------
  it("isolates profiles in storage", () => {
    service.save(PROFILE_A, minimalInput({ gems: 100, profileHandle: "alice" }));
    service.save(PROFILE_B, minimalInput({ gems: 200, profileHandle: "bob" }));

    expect(service.load(PROFILE_A).profileHandle).toBe("alice");
    expect(service.load(PROFILE_A).gems).toBe(100);
    expect(service.load(PROFILE_B).profileHandle).toBe("bob");
    expect(service.load(PROFILE_B).gems).toBe(200);
  });

  it("uses distinct storage keys per profile", () => {
    service.save(PROFILE_A, minimalInput());
    expect(storage.has(KEY_PREFIX + PROFILE_A)).toBe(true);
    expect(storage.has(KEY_PREFIX + PROFILE_B)).toBe(false);
  });
});

describe("LocalStorageSaveService — v1 → v2 migration", () => {
  let storage: MemoryStorage;
  let warn: ReturnType<typeof vi.fn<(msg: string) => void>>;

  beforeEach(() => {
    storage = new MemoryStorage();
    warn = vi.fn<(msg: string) => void>();
  });

  const construct = (skip = false): LocalStorageSaveService =>
    new LocalStorageSaveService({
      storage,
      logger: (msg: string) => {
        warn(msg);
      },
      clock: () => new Date(FIXED_NOW_ISO),
      skipLegacyMigration: skip,
    });

  it("migrates a valid v1 save to v2 legacy slot on construction", () => {
    storage.seed(
      V1_KEY,
      JSON.stringify({
        version: 1,
        completedLevelIds: ["level-01"],
        lifetimeCarrots: 47,
        lastPlayedAtIso: "2026-05-20T00:00:00.000Z",
      }),
    );

    const svc = construct();
    const legacy = svc.load(LEGACY_PROFILE_KEY);

    expect(legacy.version).toBe(2);
    expect(legacy.profileHandle).toBe("guest");
    expect(legacy.gems).toBe(47);
    expect(legacy.currentCarrots).toBe(0);
    expect(legacy.abilities).toEqual([]);
    expect(legacy.completedLevelIds).toEqual(["level-01"]);
    expect(legacy.lastPlayedAtIso).toBe("2026-05-20T00:00:00.000Z");
  });

  it("is idempotent: a second construction does not re-migrate", () => {
    storage.seed(
      V1_KEY,
      JSON.stringify({
        version: 1,
        completedLevelIds: [],
        lifetimeCarrots: 100,
        lastPlayedAtIso: "2026-05-20T00:00:00.000Z",
      }),
    );

    construct(); // First construction migrates.
    // Modify the legacy save out-of-band to confirm second construction
    // does NOT overwrite it.
    const svc2 = construct();
    svc2.save(LEGACY_PROFILE_KEY, {
      version: 2,
      profileHandle: "guest",
      currentCarrots: 0,
      gems: 999,
      abilities: [],
      completedLevelIds: [],
    });
    construct(); // Third construction; would re-migrate if not idempotent.

    expect(svc2.load(LEGACY_PROFILE_KEY).gems).toBe(999);
  });

  it("does not migrate when v1 key is absent", () => {
    construct();
    expect(storage.has(KEY_PREFIX + LEGACY_PROFILE_KEY)).toBe(false);
  });

  it("does not migrate when skipLegacyMigration is true", () => {
    storage.seed(
      V1_KEY,
      JSON.stringify({
        version: 1,
        completedLevelIds: [],
        lifetimeCarrots: 50,
        lastPlayedAtIso: FIXED_NOW_ISO,
      }),
    );
    construct(true);
    expect(storage.has(KEY_PREFIX + LEGACY_PROFILE_KEY)).toBe(false);
  });

  it("logs + skips on malformed v1 JSON", () => {
    storage.seed(V1_KEY, "{not v1 json");
    construct();
    expect(warn).toHaveBeenCalled();
    expect(storage.has(KEY_PREFIX + LEGACY_PROFILE_KEY)).toBe(false);
  });

  it("logs + skips on v1 payload failing schema check", () => {
    storage.seed(
      V1_KEY,
      JSON.stringify({ version: 1, completedLevelIds: [], lifetimeCarrots: "not-a-number" }),
    );
    construct();
    expect(warn).toHaveBeenCalled();
    expect(storage.has(KEY_PREFIX + LEGACY_PROFILE_KEY)).toBe(false);
  });

  it("leaves the v1 key in place after successful migration", () => {
    storage.seed(
      V1_KEY,
      JSON.stringify({
        version: 1,
        completedLevelIds: [],
        lifetimeCarrots: 10,
        lastPlayedAtIso: FIXED_NOW_ISO,
      }),
    );
    construct();
    expect(storage.has(V1_KEY)).toBe(true);
  });

  it("does not migrate when the v2 legacy slot already has data", () => {
    storage.seed(
      V1_KEY,
      JSON.stringify({
        version: 1,
        completedLevelIds: [],
        lifetimeCarrots: 999,
        lastPlayedAtIso: FIXED_NOW_ISO,
      }),
    );
    storage.seed(
      KEY_PREFIX + LEGACY_PROFILE_KEY,
      JSON.stringify({
        version: 2,
        profileHandle: "guest",
        currentCarrots: 0,
        gems: 5, // pre-existing different value
        abilities: [],
        completedLevelIds: [],
        lastPlayedAtIso: FIXED_NOW_ISO,
      }),
    );

    const svc = construct();
    // Should be 5, not 999 — pre-existing v2 data wins.
    expect(svc.load(LEGACY_PROFILE_KEY).gems).toBe(5);
  });
});
