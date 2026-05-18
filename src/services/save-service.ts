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

import { EMPTY_SAVE_STATE, type SaveState } from "../types/save-state.js";

/** Single localStorage key for the save payload. `:v1:` is the storage-key version. */
const STORAGE_KEY = "carrot-code:v1:save";

/** Current supported in-payload schema version. */
const CURRENT_SCHEMA_VERSION = 1;

/**
 * The subset of the WebStorage interface SaveService actually uses.
 * Decoupling from the global `Storage` type lets tests inject an
 * in-memory fake without jsdom, and lets future backends (IndexedDB
 * wrappers, custom remote storage) implement the same minimal surface.
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
 * The save-state read/write contract every scene depends on. See
 * contracts/services.md for the public-API surface.
 */
export interface SaveService {
  /** Read the current SaveState. Never throws; returns EMPTY_SAVE_STATE on failure. */
  load(): SaveState;
  /** Persist `state`. Stamps `lastPlayedAtIso` from the injected clock. */
  save(state: SaveState): void;
  /** Wipe the save slot. */
  clear(): void;
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
      // Standard ES2022 Error.cause; declared explicitly for TS strictness.
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
}

/**
 * The production SaveService. Reads and writes a single JSON payload to
 * the configured `StorageLike` under `carrot-code:v1:save`. Safe to
 * construct without arguments in the browser; pass an in-memory storage
 * + fixed clock in tests.
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
    // Resolve the storage backend. In a browser, fall back to the global
    // `localStorage` if the caller didn't pass one. On a non-browser host
    // (e.g. a Node test that forgot to inject a fake) bail loudly rather
    // than silently no-op every read and write.
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
  }

  /** @inheritdoc */
  public load(): SaveState {
    let raw: string | null;
    try {
      raw = this.storage.getItem(STORAGE_KEY);
    } catch (err) {
      this.logger(
        `SaveService.load: storage read failed, returning EMPTY_SAVE_STATE: ${String(err)}`,
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
        `SaveService.load: malformed JSON in storage, returning EMPTY_SAVE_STATE: ${String(err)}`,
      );
      return EMPTY_SAVE_STATE;
    }

    if (!isSaveStateShape(parsed)) {
      this.logger(
        "SaveService.load: payload failed schema check (wrong version or shape), returning EMPTY_SAVE_STATE",
      );
      return EMPTY_SAVE_STATE;
    }

    return parsed;
  }

  /** @inheritdoc */
  public save(state: SaveState): void {
    const normalized: SaveState = {
      version: CURRENT_SCHEMA_VERSION,
      completedLevelIds: dedupeSort(state.completedLevelIds),
      lifetimeCarrots: state.lifetimeCarrots,
      lastPlayedAtIso: this.clock().toISOString(),
    };
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (err) {
      throw new SaveQuotaExceededError(err);
    }
  }

  /** @inheritdoc */
  public clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }
}

/**
 * Type-guard for the persisted payload. A payload that fails this guard
 * is treated as missing data and the loader falls back to
 * EMPTY_SAVE_STATE.
 *
 * @param v - Anything that came out of `JSON.parse`.
 * @returns `true` only if every field is present and well-typed AND
 *   `version === CURRENT_SCHEMA_VERSION`.
 */
function isSaveStateShape(v: unknown): v is SaveState {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const o = v as Record<string, unknown>;
  if (o["version"] !== CURRENT_SCHEMA_VERSION) {
    return false;
  }
  const ids = o["completedLevelIds"];
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === "string")) {
    return false;
  }
  const carrots = o["lifetimeCarrots"];
  if (typeof carrots !== "number" || !Number.isInteger(carrots) || carrots < 0) {
    return false;
  }
  if (typeof o["lastPlayedAtIso"] !== "string") {
    return false;
  }
  return true;
}

/**
 * Return a frozen, sorted, deduplicated copy of `ids`. Pure helper —
 * used by `save()` to enforce the contract's "deterministic round-trip"
 * invariant.
 *
 * @param ids - The level-id list as provided by the caller.
 * @returns A new readonly array; the input is not mutated.
 */
function dedupeSort(ids: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(ids)].sort((a, b) => a.localeCompare(b)));
}
