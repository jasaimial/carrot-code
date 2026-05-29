// -----------------------------------------------------------------------------
// carrot-code — SaveService (v2: profile-scoped, Treasure Box economy)
//
// The serializable-state seam (Constitution Principle XI). Every read or
// write of player progress goes through this module — scenes never touch
// `localStorage` directly.
//
// v2 changes from v1 (2026-05-27):
//   - Storage keys are now profile-scoped: `carrot-code:v2:save:<profileKey>`
//     where `<profileKey>` is either the hex hash from ProfileService
//     (real player profiles) or the LEGACY_PROFILE_KEY sentinel (v1
//     migration data).
//   - load() / save() / clear() take `profileKey` as first arg. Allows
//     one SaveService instance to serve multiple profiles.
//   - One-time v1→v2 migration on construction: if `carrot-code:v1:save`
//     exists, its data is copied (with field mapping) to the v2 key for
//     the legacy profile. The v1 key is left in place for safety.
//   - SaveState gained `gems`, `abilities`, `currentCarrots`,
//     `profileHandle` fields; `lifetimeCarrots` removed (migrated to
//     gems).
//
// Implementation notes (unchanged from v1):
//   - StorageLike + clock + logger DI. Node-testable without jsdom.
//   - Schema validation in `isSaveStateShape`. Bad payload → fall back
//     to EMPTY_SAVE_STATE and log. Never throws on load().
//   - save() is the only operation that throws (SaveQuotaExceededError).
//   - `lastPlayedAtIso` stamped by the service on every save.
//
// See:
//   src/types/save-state.ts                    — v2 schema definition
//   src/services/profile-service.ts            — profileKey generator
//   tests/unit/save-service.test.ts            — v2 contract tests
//   specs/001-vertical-slice/contracts/save-state.md
//   .specify/memory/constitution.md            — Principles VI + XI
// -----------------------------------------------------------------------------

import {
  EMPTY_SAVE_STATE,
  MAX_GEMS_PER_PROFILE,
  type SaveState,
  type SaveStateV1,
} from "../types/save-state.js";

/** Storage-key prefix for v2 per-profile save slots. */
const STORAGE_KEY_PREFIX_V2 = "carrot-code:v2:save:";
/** Storage key for the legacy v1 single-slot save (read-only at runtime now). */
const LEGACY_V1_KEY = "carrot-code:v1:save";

/**
 * Sentinel profile key used as the destination for migrated v1 data.
 * Cannot collide with any real ProfileService-generated key because real
 * keys are 64-char hex hashes; this sentinel starts with `_` which is
 * outside the hex alphabet.
 */
export const LEGACY_PROFILE_KEY = "_legacy";

/**
 * Sentinel profile key used for guest sessions. Same anti-collision
 * property as LEGACY_PROFILE_KEY (leading underscore). Writes to this
 * key work normally during the session, but StartScene clears it on
 * every session start so guest progress never persists across launches.
 *
 * UI surfaces should filter both sentinel keys out of the user-facing
 * "existing profiles" list — they are infrastructure, not real players.
 */
export const GUEST_PROFILE_KEY = "_guest";

/** Current supported in-payload schema version. */
const CURRENT_SCHEMA_VERSION = 2;

/**
 * The subset of the WebStorage interface SaveService actually uses.
 * Decoupling from the global `Storage` type lets tests inject an
 * in-memory fake without jsdom.
 */
export interface StorageLike {
  /** Return the string previously stored at `key`, or `null` if absent. */
  getItem(key: string): string | null;
  /** Persist `value` under `key`. May throw on quota / disabled-storage. */
  setItem(key: string, value: string): void;
  /** Remove the entry at `key`. No-op if absent. */
  removeItem(key: string): void;
}

/**
 * Input accepted by {@link SaveService.save}. Identical to {@link SaveState}
 * except `lastPlayedAtIso` is stripped — SaveService stamps that field
 * itself from the injected clock.
 */
export type SaveStateInput = Omit<SaveState, "lastPlayedAtIso">;

/**
 * The save-state read/write contract every scene depends on (v2 API).
 *
 * Every method takes `profileKey` as its first argument. Use the hash
 * from ProfileService for a real profile, or {@link LEGACY_PROFILE_KEY}
 * to read/write migrated v1 data.
 */
export interface SaveService {
  /** Read the current SaveState for the given profile. Never throws. */
  load(profileKey: string): SaveState;
  /**
   * Persist `state` for the given profile. `lastPlayedAtIso` is stamped
   * by the service from the injected clock.
   */
  save(profileKey: string, state: SaveStateInput): void;
  /** Wipe the save slot for the given profile. */
  clear(profileKey: string): void;
  /**
   * Enumerate all profile keys that currently have a save slot in storage.
   * Used by MenuScene to list existing profiles. Returns hash strings;
   * may include {@link LEGACY_PROFILE_KEY}.
   */
  listProfileKeys(): readonly string[];
}

/**
 * Thrown by `save()` when the underlying storage refuses the write
 * (quota exhaustion, private-browsing mode, storage disabled by policy,
 * etc.). Distinct from any other error so callers can present a
 * targeted "couldn't save your progress" notice without swallowing
 * unrelated bugs.
 */
export class SaveQuotaExceededError extends Error {
  /**
   * @param cause - The original error from `Storage.setItem`, preserved
   *   for diagnostics. Optional because some test fakes throw plain Errors.
   */
  public constructor(cause?: unknown) {
    super("Save failed: storage quota exceeded or storage unavailable");
    this.name = "SaveQuotaExceededError";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

/** Constructor options for {@link LocalStorageSaveService}. */
export interface LocalStorageSaveServiceOptions {
  /** Storage backend. Defaults to `globalThis.localStorage` (browser only). */
  readonly storage?: StorageLike;
  /** Warn-level logger called on malformed / unknown payloads. Default `console.warn`. */
  readonly logger?: (message: string) => void;
  /** Clock used to stamp `lastPlayedAtIso` on save. Default `() => new Date()`. */
  readonly clock?: () => Date;
  /**
   * Skip the v1→v2 auto-migration on construction. Default `false`.
   * Tests that don't want migration to fire (e.g. inspecting the empty-
   * storage case) set this true.
   */
  readonly skipLegacyMigration?: boolean;
}

/**
 * The production SaveService. Reads and writes per-profile JSON payloads
 * to the configured `StorageLike`. Safe to construct without arguments
 * in the browser; pass an in-memory storage + fixed clock in tests.
 *
 * Runs a one-time v1→v2 migration on construction unless suppressed.
 */
export class LocalStorageSaveService implements SaveService {
  private readonly storage: StorageLike;
  private readonly logger: (message: string) => void;
  private readonly clock: () => Date;

  /**
   * Build a SaveService.
   *
   * @param options - Optional dependency injection. In production all
   *   defaults are correct; tests override `storage` + `clock`.
   */
  public constructor(options: LocalStorageSaveServiceOptions = {}) {
    let resolvedStorage: StorageLike | undefined = options.storage;
    if (resolvedStorage === undefined) {
      const maybeLocalStorage = (globalThis as { localStorage?: StorageLike }).localStorage;
      if (maybeLocalStorage !== undefined) {
        resolvedStorage = maybeLocalStorage;
      }
    }
    if (resolvedStorage === undefined) {
      throw new Error(
        "LocalStorageSaveService: no storage provided and no global localStorage available",
      );
    }

    this.storage = resolvedStorage;
    this.logger =
      options.logger ??
      ((msg: string): void => {
        console.warn(msg);
      });
    this.clock = options.clock ?? ((): Date => new Date());

    if (options.skipLegacyMigration !== true) {
      this.maybeMigrateLegacy();
    }
  }

  /** @inheritdoc */
  public load(profileKey: string): SaveState {
    const key = storageKeyFor(profileKey);
    let raw: string | null;
    try {
      raw = this.storage.getItem(key);
    } catch (err) {
      this.logger(
        `SaveService.load: storage read failed for profile ${profileKey}, ` +
          `returning EMPTY_SAVE_STATE: ${String(err)}`,
      );
      return EMPTY_SAVE_STATE;
    }
    if (raw === null) {
      return EMPTY_SAVE_STATE;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger(
        `SaveService.load: malformed JSON for profile ${profileKey}, ` +
          `returning EMPTY_SAVE_STATE: ${String(err)}`,
      );
      return EMPTY_SAVE_STATE;
    }

    if (!isSaveStateShape(parsed)) {
      this.logger(
        `SaveService.load: payload failed schema check for profile ${profileKey} ` +
          "(wrong version or shape), returning EMPTY_SAVE_STATE",
      );
      return EMPTY_SAVE_STATE;
    }

    return parsed;
  }

  /** @inheritdoc */
  public save(profileKey: string, state: SaveStateInput): void {
    const normalized: SaveState = {
      version: CURRENT_SCHEMA_VERSION,
      profileHandle: state.profileHandle,
      currentCarrots: clampNonNegativeInt(state.currentCarrots),
      gems: clampGems(state.gems),
      abilities: dedupeSort(state.abilities),
      completedLevelIds: dedupeSort(state.completedLevelIds),
      lastPlayedAtIso: this.clock().toISOString(),
    };
    try {
      this.storage.setItem(storageKeyFor(profileKey), JSON.stringify(normalized));
    } catch (err) {
      throw new SaveQuotaExceededError(err);
    }
  }

  /** @inheritdoc */
  public clear(profileKey: string): void {
    this.storage.removeItem(storageKeyFor(profileKey));
  }

  /** @inheritdoc */
  public listProfileKeys(): readonly string[] {
    // StorageLike doesn't include `key()` / `length` to keep the interface
    // minimal. Reach for the global `localStorage` if it's actually the
    // backend; tests that pass a fake will get an empty list (or the fake
    // can implement its own enumeration by carrying a key list).
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    // The double check (undefined OR not-our-storage) is intentional:
    // we only want to enumerate when we're sure the underlying backend
    // is the global localStorage that has the key()/length API.
    if (ls === undefined || ls !== this.storage) {
      return [];
    }
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i);
      if (k?.startsWith(STORAGE_KEY_PREFIX_V2) === true) {
        keys.push(k.slice(STORAGE_KEY_PREFIX_V2.length));
      }
    }
    return Object.freeze(keys);
  }

  /**
   * One-time v1→v2 migration. If a v1 save exists AND no v2 legacy save
   * has been written yet, copy the v1 data forward under the legacy
   * profile key. v1 key is left untouched (so a downgrade still works).
   *
   * Idempotent: safe to call multiple times; bails fast when v2 legacy
   * key already exists.
   *
   * All failures are non-fatal — logged + swallowed. The game must boot
   * even if migration trips over a bad v1 payload.
   */
  private maybeMigrateLegacy(): void {
    let v2Exists: string | null;
    try {
      v2Exists = this.storage.getItem(storageKeyFor(LEGACY_PROFILE_KEY));
    } catch {
      return;
    }
    if (v2Exists !== null) {
      return;
    }

    let v1Raw: string | null;
    try {
      v1Raw = this.storage.getItem(LEGACY_V1_KEY);
    } catch {
      return;
    }
    if (v1Raw === null) {
      return;
    }

    let v1Parsed: unknown;
    try {
      v1Parsed = JSON.parse(v1Raw);
    } catch (err) {
      this.logger(
        `SaveService.migrate: v1 payload was malformed, skipping migration: ${String(err)}`,
      );
      return;
    }

    if (!isV1Shape(v1Parsed)) {
      this.logger("SaveService.migrate: v1 payload failed schema check, skipping migration");
      return;
    }

    const migrated: SaveState = {
      version: CURRENT_SCHEMA_VERSION,
      profileHandle: "guest",
      currentCarrots: 0,
      gems: clampGems(v1Parsed.lifetimeCarrots),
      abilities: Object.freeze<string[]>([]),
      completedLevelIds: dedupeSort(v1Parsed.completedLevelIds),
      lastPlayedAtIso: v1Parsed.lastPlayedAtIso,
    };
    try {
      this.storage.setItem(storageKeyFor(LEGACY_PROFILE_KEY), JSON.stringify(migrated));
      this.logger(
        `SaveService.migrate: copied v1 save → v2 legacy profile (gems: ${migrated.gems.toString()})`,
      );
    } catch (err) {
      this.logger(`SaveService.migrate: failed to write v2 legacy save: ${String(err)}`);
    }
  }
}

/** Compose the storage key for a profile. */
function storageKeyFor(profileKey: string): string {
  return STORAGE_KEY_PREFIX_V2 + profileKey;
}

/**
 * Type-guard for the persisted v2 payload. A payload that fails this guard
 * is treated as missing data and the loader falls back to EMPTY_SAVE_STATE.
 */
function isSaveStateShape(v: unknown): v is SaveState {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const o = v as Record<string, unknown>;
  if (o["version"] !== CURRENT_SCHEMA_VERSION) {
    return false;
  }
  if (typeof o["profileHandle"] !== "string" || o["profileHandle"] === "") {
    return false;
  }
  if (!isNonNegativeInt(o["currentCarrots"])) {
    return false;
  }
  const gems = o["gems"];
  if (!isNonNegativeInt(gems) || (gems as number) > MAX_GEMS_PER_PROFILE) {
    return false;
  }
  const abilities = o["abilities"];
  if (!Array.isArray(abilities) || !abilities.every((x) => typeof x === "string")) {
    return false;
  }
  const ids = o["completedLevelIds"];
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
    return false;
  }
  if (typeof o["lastPlayedAtIso"] !== "string") {
    return false;
  }
  return true;
}

/** Type-guard for a v1 payload (migration path only). */
// eslint-disable-next-line @typescript-eslint/no-deprecated
function isV1Shape(v: unknown): v is SaveStateV1 {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const o = v as Record<string, unknown>;
  if (o["version"] !== 1) {
    return false;
  }
  const ids = o["completedLevelIds"];
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
    return false;
  }
  if (!isNonNegativeInt(o["lifetimeCarrots"])) {
    return false;
  }
  if (typeof o["lastPlayedAtIso"] !== "string") {
    return false;
  }
  return true;
}

/** True iff `v` is a non-negative integer. */
function isNonNegativeInt(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/** Coerce a numeric value to a non-negative integer (floor + clamp at 0). */
function clampNonNegativeInt(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.floor(n));
}

/** Coerce a numeric value to a valid gem count: int, [0, MAX_GEMS_PER_PROFILE]. */
function clampGems(n: number): number {
  return Math.min(MAX_GEMS_PER_PROFILE, clampNonNegativeInt(n));
}

/**
 * Return a frozen, sorted, deduplicated copy of `items`. Used by `save()`
 * for both `completedLevelIds` and `abilities` to enforce deterministic
 * round-trip + idempotency.
 */
function dedupeSort(items: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(items)].sort((a, b) => a.localeCompare(b)));
}
// -----------------------------------------------------------------------------
// carrot-code — SaveService (T020)
//
// The serializable-state seam (Constitution Principle XI). Every read or
// write of player progress goes through this module — scenes never touch
// `localStorage` directly.
//
// Implementation notes:
//   - The service takes a `StorageLike` dependency (subset of WebStorage)
//     and a `clock: () => Date`. This makes it node-testable without
//     jsdom, makes timestamps deterministic in tests, and makes "switch
//     to IndexedDB or a custom backend" a one-line change later.
//   - Schema validation lives in `isSaveStateShape`. Unknown / malformed
//     payloads ALWAYS fall back to EMPTY_SAVE_STATE and emit one warning.
//     The service never throws on `load()` — the game must boot even with
//     a corrupted save.
//   - `save()` is the only place that throws: SaveQuotaExceededError if
//     the underlying storage refuses the write (quota / private mode /
//     disabled storage). Callers in scenes are expected to catch and
//     present a non-blocking "couldn't save" notice.
//   - `lastPlayedAtIso` is stamped by the service on every save (per
//     data-model.md: "ISO 8601, written by SaveService"). Whatever the
//     caller passes in for that field is ignored — the service owns it.
//
// Tests: tests/unit/save-service.test.ts (T019, six contract cases plus
// a bonus clear()).
//
// See:
//   specs/001-vertical-slice/contracts/save-state.md
//   specs/001-vertical-slice/contracts/services.md
//   .specify/memory/constitution.md  — Principles VI + XI
// -----------------------------------------------------------------------------
