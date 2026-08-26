import { describe, it, expect } from "vitest";
import { parseMyClippings } from "../clippings/clippings-parser.js";
import { parseKindleHtmlExport } from "../html/html-parser.js";
import { rawMyClippingsSample, rawKindleHtmlSample } from "@hakim/test-fixtures";

describe("Kindle Import Parsers", () => {
  describe("My Clippings.txt Parser", () => {
    it("parses multi-book English and Arabic clippings with highlights and notes", () => {
      const result = parseMyClippings(rawMyClippingsSample);

      expect(result.version).toBe("1.0");
      expect(result.sourceKind).toBe("my_clippings");
      expect(result.books.length).toBe(2);

      // Book 1: Designing Data-Intensive Applications
      const book1 = result.books.find((b) => b.sourceTitle.includes("Designing Data-Intensive Applications"));
      expect(book1).toBeDefined();
      expect(book1?.author).toBe("Martin Kleppmann");
      expect(book1?.annotations.length).toBe(1);
      expect(book1?.annotations[0]?.rawText).toContain("Reliability means making systems work correctly");
      expect(book1?.annotations[0]?.sourceNote).toBe("Fault tolerance vs failure prevention.");
      expect(book1?.annotations[0]?.locationStart).toBe(512);
      expect(book1?.annotations[0]?.locationEnd).toBe(514);

      // Book 2: Arabic book
      const book2 = result.books.find((b) => b.sourceTitle.includes("قواعد في تحصيل العلم"));
      expect(book2).toBeDefined();
      expect(book2?.author).toBe("عبد العزيز السدحان");
      expect(book2?.annotations[0]?.page).toBe(12);
      expect(book2?.annotations[0]?.locationStart).toBe(145);
      expect(book2?.annotations[0]?.rawText).toContain("العلم صيد والكتابة قيده");
    });
  });

  describe("Kindle HTML Export Parser", () => {
    it("parses Kindle HTML export with title, author, color, and location", () => {
      const result = parseKindleHtmlExport(rawKindleHtmlSample);

      expect(result.version).toBe("1.0");
      expect(result.sourceKind).toBe("kindle_html");
      expect(result.books.length).toBe(1);

      const book = result.books[0];
      expect(book?.sourceTitle).toBe("Staff Engineer: Leadership beyond the management track");
      expect(book?.author).toBe("Will Larson");
      expect(book?.annotations.length).toBe(1);
      expect(book?.annotations[0]?.color).toBe("yellow");
      expect(book?.annotations[0]?.locationStart).toBe(320);
      expect(book?.annotations[0]?.rawText).toContain("Staff engineers must focus on setting technical direction");
    });
  });
});
