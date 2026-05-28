// -----------------------------------------------------------------------------
// carrot-code — ProfileService
//
// Local-only profile management. Generates a 4-word recovery phrase on
// new-profile creation, hashes (handle + phrase) into a storage key, and
// verifies the same combination on restore. Hash-as-key means a forgotten
// phrase yields a different key, yields no save found - the architecture
// itself enforces "if you lose the phrase, your treasure is gone."
//
// Threat model: kids forgetting their phrase. NOT adversarial - a
// determined attacker with DevTools could enumerate localStorage keys
// and find orphan blobs from forgotten phrases. That's fine for v0.x;
// when (if) we ever care about adversarial security, the hash function
// + entropy gets revisited.
//
// All hashing uses Web Crypto API (globalThis.crypto.subtle). Node 18+
// and all target browsers have it. No npm dependency.
//
// API is split into three layers:
//   1. Pure helpers (normalizeHandle, normalizePhrase, joinPhrase) -
//      no I/O, fully unit-testable.
//   2. generatePhrase - takes an optional RNG for deterministic tests.
//   3. hashHandleAndPhrase - async (Web Crypto). Awaited at call sites.
//
// See:
//   src/data/recovery-words.ts        - the 4 x 100 word lists
//   src/services/save-service.ts      - consumes the hash as part of
//                                       the storage key (v2 schema)
//   tests/unit/profile-service.test.ts
// -----------------------------------------------------------------------------

import {
  RECOVERY_ADJECTIVES,
  RECOVERY_ANIMALS,
  RECOVERY_NOUNS,
  RECOVERY_VERBS,
} from "../data/recovery-words.js";

/** A 4-word recovery phrase: [adjective, animal, verb, noun]. */
export type RecoveryPhrase = readonly [string, string, string, string];

/**
 * Pseudo-random number source. Default uses Math.random; tests inject
 * a deterministic source for reproducible tests.
 */
export type RngLike = () => number;

/** Max handle length. Keeps storage keys short; kid-typeable on a phone. */
export const HANDLE_MAX_LENGTH = 20;
/** Min handle length. */
export const HANDLE_MIN_LENGTH = 2;
/**
 * Allowed handle character class: lowercase letters + digits only.
 * Reject everything else - no spaces, no special chars, no unicode.
 * Storage-key safety + kid-typeable.
 */
const HANDLE_PATTERN = /^[a-z0-9]+$/;

/**
 * Normalize a user-entered handle to its canonical form.
 *
 * Lowercases + trims. Validates length + allowed character set. Throws
 * ProfileValidationError on invalid input - caller (MenuScene) is
 * expected to catch and surface a user-facing error.
 *
 * @param raw - User-typed handle.
 * @returns The canonical handle.
 * @throws {ProfileValidationError} On invalid input.
 */
export function normalizeHandle(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length < HANDLE_MIN_LENGTH) {
    throw new ProfileValidationError(
      `Handle must be at least ${HANDLE_MIN_LENGTH.toString()} characters`,
    );
  }
  if (trimmed.length > HANDLE_MAX_LENGTH) {
    throw new ProfileValidationError(
      `Handle must be at most ${HANDLE_MAX_LENGTH.toString()} characters`,
    );
  }
  if (!HANDLE_PATTERN.test(trimmed)) {
    throw new ProfileValidationError(
      "Handle may only contain lowercase letters and digits (no spaces or symbols)",
    );
  }
  return trimmed;
}

/**
 * Normalize a 4-word recovery phrase to its canonical form.
 *
 * Lowercases + trims each word. Validates exactly 4 words. Does NOT
 * validate that each word is in the wordbank - a player might type
 * a slightly mis-spelled phrase and we want the hash mismatch to
 * surface as "phrase doesn't match" rather than a structural error.
 *
 * @param words - The 4 words.
 * @returns The canonical phrase.
 * @throws {ProfileValidationError} If word count isn't exactly 4 or
 *   any word is empty after trimming.
 */
export function normalizePhrase(words: readonly string[]): RecoveryPhrase {
  if (words.length !== 4) {
    throw new ProfileValidationError("Recovery phrase must be exactly 4 words");
  }
  const normalized = words.map((w) => w.trim().toLowerCase());
  for (const w of normalized) {
    if (w.length === 0) {
      throw new ProfileValidationError("Recovery phrase words cannot be empty");
    }
  }
  return [normalized[0] ?? "", normalized[1] ?? "", normalized[2] ?? "", normalized[3] ?? ""];
}

/** Join a phrase into its single-string canonical form (space-separated). */
export function joinPhrase(phrase: RecoveryPhrase): string {
  return phrase.join(" ");
}

/**
 * Generate a fresh random recovery phrase. Picks one word from each of
 * the four word categories.
 *
 * @param rng - Optional pseudo-random source for deterministic tests.
 *   Defaults to Math.random.
 * @returns The generated phrase.
 */
export function generatePhrase(rng: RngLike = Math.random): RecoveryPhrase {
  return [
    pickFrom(RECOVERY_ADJECTIVES, rng),
    pickFrom(RECOVERY_ANIMALS, rng),
    pickFrom(RECOVERY_VERBS, rng),
    pickFrom(RECOVERY_NOUNS, rng),
  ];
}

/** Pick one element from a non-empty array using the given RNG. */
function pickFrom(arr: readonly string[], rng: RngLike): string {
  if (arr.length === 0) {
    throw new Error("ProfileService: word bank category is empty");
  }
  const idx = Math.floor(rng() * arr.length);
  // Defensive clamp in case the RNG returns 1.0 (rare; some impls).
  const safeIdx = Math.min(idx, arr.length - 1);
  return arr[safeIdx] ?? arr[0] ?? "";
}

/**
 * The Web Crypto subset ProfileService needs. Decoupling from the
 * global `Crypto` lets tests inject a fake. Production calls pass
 * globalThis.crypto.subtle.
 */
export interface SubtleCryptoLike {
  /** Compute a digest of the given data. Matches SubtleCrypto.digest. */
  digest(algorithm: string, data: ArrayBuffer | ArrayBufferView): Promise<ArrayBuffer>;
}

/**
 * Compute the storage key for a (handle, phrase) pair.
 *
 * Hash input format: `handle + ":" + joinedPhrase`. The colon separator
 * prevents handle/phrase boundary collisions
 * (e.g. handle=`"abc"` phrase=`"defghi"` vs handle=`"abcdef"` phrase=`"ghi"`).
 *
 * @param handle - Canonical handle (already passed through normalizeHandle).
 * @param phrase - Canonical phrase (already passed through normalizePhrase).
 * @param subtle - Optional Web Crypto subtle. Defaults to globalThis.crypto.subtle.
 * @returns Hex-encoded SHA-256 of the canonical input string.
 */
export async function hashHandleAndPhrase(
  handle: string,
  phrase: RecoveryPhrase,
  subtle?: SubtleCryptoLike,
): Promise<string> {
  const subtleImpl =
    subtle ?? (globalThis.crypto as { subtle?: SubtleCryptoLike } | undefined)?.subtle;
  if (subtleImpl === undefined) {
    throw new Error(
      "ProfileService: Web Crypto API (globalThis.crypto.subtle) is unavailable in this environment",
    );
  }
  const input = `${handle}:${joinPhrase(phrase)}`;
  const bytes = new TextEncoder().encode(input);
  const digestBuffer = await subtleImpl.digest("SHA-256", bytes);
  return bufferToHex(digestBuffer);
}

/** Hex-encode an ArrayBuffer. Lowercase, no separator. */
function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Thrown by handle / phrase normalization on invalid input. Distinct
 * class so the MenuScene UI can catch + surface a user-friendly error
 * without swallowing unrelated bugs.
 */
export class ProfileValidationError extends Error {
  /**
   * @param message - User-facing reason the input was rejected.
   */
  public constructor(message: string) {
    super(message);
    this.name = "ProfileValidationError";
  }
}
