// -----------------------------------------------------------------------------
// tests/unit/recovery-words.test.ts
//
// Sanity tests for the word bank. These are quick checks that the data
// is shaped how the consumer (ProfileService) expects, not exhaustive
// content review (the content review is "the maintainer's eyeball pass").
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  RECOVERY_ADJECTIVES,
  RECOVERY_ANIMALS,
  RECOVERY_NOUNS,
  RECOVERY_VERBS,
} from "../../src/data/recovery-words.js";

const EXPECTED_SIZE = 100;

describe("recovery-words", () => {
  const categories = [
    ["adjectives", RECOVERY_ADJECTIVES],
    ["animals", RECOVERY_ANIMALS],
    ["verbs", RECOVERY_VERBS],
    ["nouns", RECOVERY_NOUNS],
  ] as const;

  for (const [name, list] of categories) {
    it(`${name}: contains ${EXPECTED_SIZE.toString()} entries`, () => {
      expect(list).toHaveLength(EXPECTED_SIZE);
    });

    it(`${name}: every entry is a non-empty lowercase single-word string`, () => {
      for (const word of list) {
        expect(typeof word).toBe("string");
        expect(word.length).toBeGreaterThan(0);
        expect(word).toBe(word.toLowerCase());
        // No spaces, hyphens, or apostrophes - single token only.
        expect(word).toMatch(/^[a-z]+$/);
      }
    });

    it(`${name}: has no duplicate entries`, () => {
      const set = new Set(list);
      expect(set.size).toBe(list.length);
    });

    it(`${name}: is frozen (immutable)`, () => {
      expect(Object.isFrozen(list)).toBe(true);
    });
  }
});
