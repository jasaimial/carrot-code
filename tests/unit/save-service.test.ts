// -----------------------------------------------------------------------------
// carrot-code — SaveService tests (T019)
//
// These tests are written BEFORE the implementation, per Constitution
// Principle VI (Tested Where It Matters). On the T019 commit, every test
// here is expected to FAIL — the SaveService module does not exist yet.
// On the T020 commit, the implementation lands and all tests turn green.
//
// Coverage maps 1:1 to the six cases listed in
//   specs/001-vertical-slice/contracts/save-state.md#test-coverage
//
// Test environment: `node` (Vitest default). We never touch a real
// `localStorage`; instead `LocalStorageSaveService` takes a `StorageLike`
// dependency that the tests fill with an in-memory fake. This means:
//   - No jsdom tax.
//   - The REAL service code path (JSON.parse, version check, dedupe-sort)
//     is exercised, not a parallel "MemorySaveService" that would silently
//     bypass it.
//
// See:
//   specs/001-vertical-slice/contracts/save-state.md
//   .specify/memory/constitution.md  — Principle VI
// -----------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_SAVE_STATE, type SaveState } from "../../src/types/save-state.js";
import {
  LocalStorageSaveService,
  SaveQuotaExceededError,
  type StorageLike,
} from "../../src/services/save-service.js";

const STORAGE_KEY = "carrot-code:v1:save";
const FIXED_NOW_ISO = "2026-05-18T12:00:00.000Z";

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

  /** Test helper: pre-seed storage with a raw string (e.g., malformed JSON). */
  public seed(key: string, value: string): void {
    this.data.set(key, value);
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
    // no-op
  }
}

describe("LocalStorageSaveService", () => {
  let storage: MemoryStorage;
  let warn: ReturnType<typeof vi.fn>;
  let service: LocalStorageSaveService;

  beforeEach(() => {
    storage = new MemoryStorage();
    warn = vi.fn();
    service = new LocalStorageSaveService({
      storage,
      logger: warn,
      clock: () => new Date(FIXED_NOW_ISO),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Case 1: round-trip --------------------------------------------------
  it("round-trips a valid SaveState through save → load", () => {
    const state: SaveState = {
      version: 1,
      completedLevelIds: ["level-01"],
      lifetimeCarrots: 47,
      lastPlayedAtIso: "2026-05-14T22:30:00.000Z",
    };
    service.save(state);
    const loaded = service.load();
    expect(loaded.version).toBe(1);
    expect(loaded.completedLevelIds).toEqual(["level-01"]);
    expect(loaded.lifetimeCarrots).toBe(47);
    // lastPlayedAtIso is stamped by the service from the injected clock,
    // overriding whatever the caller passed in (data-model.md: "written by
    // SaveService").
    expect(loaded.lastPlayedAtIso).toBe(FIXED_NOW_ISO);
  });

  // --- Case 2: empty / first launch ---------------------------------------
  it("returns EMPTY_SAVE_STATE when storage has no key", () => {
    const loaded = service.load();
    expect(loaded).toEqual(EMPTY_SAVE_STATE);
    expect(warn).not.toHaveBeenCalled();
  });

  // --- Case 3: malformed JSON ---------------------------------------------
  it("returns EMPTY_SAVE_STATE and warns on malformed JSON in storage", () => {
    storage.seed(STORAGE_KEY, "{not json at all");
    const loaded = service.load();
    expect(loaded).toEqual(EMPTY_SAVE_STATE);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  // --- Case 4: unknown version --------------------------------------------
  it("returns EMPTY_SAVE_STATE and warns on unknown payload version", () => {
    storage.seed(
      STORAGE_KEY,
      JSON.stringify({
        version: 99,
        completedLevelIds: ["level-01"],
        lifetimeCarrots: 5,
        lastPlayedAtIso: FIXED_NOW_ISO,
      }),
    );
    const loaded = service.load();
    expect(loaded).toEqual(EMPTY_SAVE_STATE);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  // --- Case 5: dedupe + sort ----------------------------------------------
  it("dedupes and sorts completedLevelIds on write", () => {
    service.save({
      version: 1,
      completedLevelIds: ["b", "a", "a", "c", "b"],
      lifetimeCarrots: 0,
      lastPlayedAtIso: FIXED_NOW_ISO,
    });
    const loaded = service.load();
    expect(loaded.completedLevelIds).toEqual(["a", "b", "c"]);
  });

  // --- Case 6: quota exhaustion -------------------------------------------
  it("throws SaveQuotaExceededError when setItem throws", () => {
    const failing = new LocalStorageSaveService({
      storage: new QuotaExceededStorage(),
      logger: warn,
      clock: () => new Date(FIXED_NOW_ISO),
    });
    expect(() =>
      failing.save({
        version: 1,
        completedLevelIds: [],
        lifetimeCarrots: 0,
        lastPlayedAtIso: FIXED_NOW_ISO,
      }),
    ).toThrow(SaveQuotaExceededError);
  });

  // --- Bonus: clear --------------------------------------------------------
  it("clear() removes the storage key", () => {
    service.save({
      version: 1,
      completedLevelIds: ["level-01"],
      lifetimeCarrots: 1,
      lastPlayedAtIso: FIXED_NOW_ISO,
    });
    service.clear();
    expect(service.load()).toEqual(EMPTY_SAVE_STATE);
  });
});
