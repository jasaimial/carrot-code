// -----------------------------------------------------------------------------
// tests/unit/profile-service.test.ts
//
// Unit tests for the ProfileService pure helpers + the hash function.
// Hash tests use the real Web Crypto API available in Node 20+; no
// jsdom or polyfill needed.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  generatePhrase,
  hashHandleAndPhrase,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  joinPhrase,
  normalizeHandle,
  normalizePhrase,
  ProfileValidationError,
  type RecoveryPhrase,
} from "../../src/services/profile-service.js";

describe("normalizeHandle", () => {
  it("lowercases + trims valid input", () => {
    expect(normalizeHandle("  Speedy  ")).toBe("speedy");
    expect(normalizeHandle("PLAYER1")).toBe("player1");
    expect(normalizeHandle("alice")).toBe("alice");
  });

  it("rejects too-short handle", () => {
    expect(() => normalizeHandle("a")).toThrow(ProfileValidationError);
    expect(() => normalizeHandle("")).toThrow(ProfileValidationError);
    expect(() => normalizeHandle("  ")).toThrow(ProfileValidationError);
  });

  it("rejects too-long handle", () => {
    const overlong = "a".repeat(HANDLE_MAX_LENGTH + 1);
    expect(() => normalizeHandle(overlong)).toThrow(ProfileValidationError);
  });

  it("accepts handles at the length boundaries", () => {
    expect(normalizeHandle("a".repeat(HANDLE_MIN_LENGTH))).toHaveLength(HANDLE_MIN_LENGTH);
    expect(normalizeHandle("a".repeat(HANDLE_MAX_LENGTH))).toHaveLength(HANDLE_MAX_LENGTH);
  });

  it("rejects handles with disallowed characters", () => {
    expect(() => normalizeHandle("alice bob")).toThrow(ProfileValidationError);
    expect(() => normalizeHandle("alice-bob")).toThrow(ProfileValidationError);
    expect(() => normalizeHandle("alice!")).toThrow(ProfileValidationError);
    expect(() => normalizeHandle("alice.bob")).toThrow(ProfileValidationError);
    expect(() => normalizeHandle("élise")).toThrow(ProfileValidationError);
  });

  it("accepts handles with digits", () => {
    expect(normalizeHandle("player1")).toBe("player1");
    expect(normalizeHandle("alice42")).toBe("alice42");
    expect(normalizeHandle("99")).toBe("99");
  });
});

describe("normalizePhrase", () => {
  it("lowercases + trims a valid 4-word phrase", () => {
    expect(normalizePhrase(["Blue", " Hamster ", "LOVES", "Reading"])).toEqual([
      "blue",
      "hamster",
      "loves",
      "reading",
    ]);
  });

  it("rejects phrase with wrong word count", () => {
    expect(() => normalizePhrase(["one", "two", "three"])).toThrow(ProfileValidationError);
    expect(() => normalizePhrase(["a", "b", "c", "d", "e"])).toThrow(ProfileValidationError);
    expect(() => normalizePhrase([])).toThrow(ProfileValidationError);
  });

  it("rejects phrase with empty words", () => {
    expect(() => normalizePhrase(["blue", "", "loves", "reading"])).toThrow(ProfileValidationError);
    expect(() => normalizePhrase(["blue", "hamster", "  ", "reading"])).toThrow(
      ProfileValidationError,
    );
  });
});

describe("joinPhrase", () => {
  it("joins with single space", () => {
    expect(joinPhrase(["blue", "hamster", "loves", "reading"])).toBe("blue hamster loves reading");
  });
});

describe("generatePhrase", () => {
  it("returns exactly 4 words", () => {
    const phrase = generatePhrase();
    expect(phrase).toHaveLength(4);
  });

  it("each word is non-empty lowercase", () => {
    const phrase = generatePhrase();
    for (const word of phrase) {
      expect(word.length).toBeGreaterThan(0);
      expect(word).toBe(word.toLowerCase());
    }
  });

  it("is deterministic with a fixed RNG", () => {
    // Fixed RNG always returns 0 -> always picks index 0 from each list.
    const fixedRng = (): number => 0;
    const a = generatePhrase(fixedRng);
    const b = generatePhrase(fixedRng);
    expect(a).toEqual(b);
  });

  it("produces different phrases across calls with Math.random", () => {
    // 100^4 = 100M combinations; 10 calls collision probability is
    // vanishingly small. If this ever flakes, replace Math.random with
    // a counted RNG.
    const phrases = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      phrases.add(joinPhrase(generatePhrase()));
    }
    expect(phrases.size).toBeGreaterThan(1);
  });

  it("handles edge-case RNG returning ~1.0 without overflowing", () => {
    const nearOneRng = (): number => 0.9999999;
    const phrase = generatePhrase(nearOneRng);
    expect(phrase).toHaveLength(4);
  });
});

describe("hashHandleAndPhrase", () => {
  const phrase: RecoveryPhrase = ["blue", "hamster", "loves", "reading"];

  it("returns a 64-char lowercase hex string (SHA-256)", async () => {
    const hash = await hashHandleAndPhrase("alice", phrase);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", async () => {
    const h1 = await hashHandleAndPhrase("alice", phrase);
    const h2 = await hashHandleAndPhrase("alice", phrase);
    expect(h1).toBe(h2);
  });

  it("differs for different handle", async () => {
    const h1 = await hashHandleAndPhrase("alice", phrase);
    const h2 = await hashHandleAndPhrase("bob", phrase);
    expect(h1).not.toBe(h2);
  });

  it("differs for different phrase", async () => {
    const phrase2: RecoveryPhrase = ["blue", "hamster", "loves", "books"];
    const h1 = await hashHandleAndPhrase("alice", phrase);
    const h2 = await hashHandleAndPhrase("alice", phrase2);
    expect(h1).not.toBe(h2);
  });

  it("is collision-resistant against boundary shifts", async () => {
    // Without the colon separator, these would hash identically.
    const h1 = await hashHandleAndPhrase("abc", ["d", "ef", "gh", "ij"]);
    const h2 = await hashHandleAndPhrase("abcdef", ["g", "h", "i", "j"]);
    expect(h1).not.toBe(h2);
  });
});
