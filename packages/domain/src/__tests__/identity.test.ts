import { describe, it, expect } from "vitest";
import {
  generateBookId,
  generateAnnotationId,
  normalizeTitle,
  normalizeAuthor,
  normalizeText,
  decodeHtmlEntities,
  ImportEnvelopeSchema,
} from "../index.js";

describe("Domain Normalization & Identity Engine", () => {
  describe("Text Normalization & HTML Entity Decoding", () => {
    it("decodes HTML entities in Arabic and multilingual text", () => {
      const input = "مشكلته مع الناس هي عجزه عن &laquo;تخييب العشم&raquo; فيه.. &amp; &quot;quote&quot; &#39;single&#39;";
      const output = normalizeText(input);
      expect(output).toBe("مشكلته مع الناس هي عجزه عن «تخييب العشم» فيه.. & \"quote\" 'single'");
    });

    it("decodes decimal and hex numeric entities", () => {
      expect(decodeHtmlEntities("Copyright &#169; 2026 &#x2014; Hakim")).toBe("Copyright © 2026 — Hakim");
    });

    it("normalizes quotes, dashes, and extra whitespaces", () => {
      const input = "  “Leading   and    trailing—dashes with ‘curly’ quotes.”  ";
      const output = normalizeText(input);
      expect(output).toBe('"Leading and trailing-dashes with \'curly\' quotes."');
    });

    it("strips zero-width and directional formatting characters", () => {
      const input = "Hidden\u200BZero\u200DWidth\uFEFFChars";
      const output = normalizeText(input);
      expect(output).toBe("HiddenZeroWidthChars");
    });

    it("cleans subtitle edition clutter from book titles", () => {
      expect(normalizeTitle("The Effective Engineer (Kindle Edition)")).toBe("The Effective Engineer");
      expect(normalizeTitle("صيد الخاطر (Arabic Edition)")).toBe("صيد الخاطر");
    });

    it("normalizes author names in Lastname, Firstname format", () => {
      expect(normalizeAuthor("Lau, Edmond")).toBe("Edmond Lau");
      expect(normalizeAuthor("Martin Kleppmann")).toBe("Martin Kleppmann");
    });
  });

  describe("Deterministic Book Identity", () => {
    it("generates deterministic Book IDs based on ASIN", () => {
      const bookA = generateBookId({ asin: "B005DOK8TK", title: "The Effective Engineer", region: "us" });
      const bookB = generateBookId({ asin: "b005dok8tk", title: "The Effective Engineer (Different Case)", region: "us" });
      expect(bookA.id).toBe(bookB.id);
      expect(bookA.stableKey).toBe("asin:us:B005DOK8TK");
    });

    it("generates stable Book IDs for books without ASIN using normalized Title and Author", () => {
      const bookA = generateBookId({ title: "Thinking in Systems (Kindle Edition)", author: "Meadows, Donella" });
      const bookB = generateBookId({ title: "Thinking in Systems", author: "Donella Meadows" });
      expect(bookA.id).toBe(bookB.id);
    });
  });

  describe("Deterministic Annotation Identity & Invariants", () => {
    const bookId = "00000000-0000-0000-0000-000000000001";

    it("INVARIANT: identical quote text at two different locations produces TWO DISTINCT annotation IDs", () => {
      const text = "The system always seeks balance.";
      const annot1 = generateAnnotationId({
        bookId,
        rawText: text,
        locationStart: 145,
        locationEnd: 148,
      });

      const annot2 = generateAnnotationId({
        bookId,
        rawText: text,
        locationStart: 890,
        locationEnd: 893,
      });

      expect(annot1.id).not.toBe(annot2.id);
      expect(annot1.stableKey).not.toBe(annot2.stableKey);
    });

    it("is completely idempotent when re-importing the exact same highlight", () => {
      const params = {
        bookId,
        rawText: "Focus on high-leverage activities.",
        locationStart: 120,
        locationEnd: 125,
      };

      const run1 = generateAnnotationId(params);
      const run2 = generateAnnotationId(params);
      expect(run1.id).toBe(run2.id);
      expect(run1.stableKey).toBe(run2.stableKey);
    });
  });

  describe("Schema Validation", () => {
    it("rejects invalid payloads with missing required fields", () => {
      const invalid = {
        version: "1.0",
        sourceKind: "invalid_kind",
        importedAt: "invalid-date",
        books: [],
      };
      const result = ImportEnvelopeSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
