import { describe, it, expect } from "vitest";
import { ImportEnvelopeSchema, generateAnnotationId } from "@hakim/domain";
import {
  englishCloudEnvelope,
  arabicCloudEnvelope,
  duplicateQuoteDifferentLocations,
  clippingLimitEnvelope,
  rawMyClippingsSample,
  rawKindleHtmlSample,
} from "../index.js";

describe("Golden Fixtures Evaluation Suite", () => {
  it("validates English Cloud Envelope against Zod Schema", () => {
    const parsed = ImportEnvelopeSchema.parse(englishCloudEnvelope);
    expect(parsed.books.length).toBe(1);
    expect(parsed.books[0]?.annotations.length).toBe(2);
    expect(parsed.books[0]?.annotations[0]?.rawText).toContain("Focus on high-leverage activities");
  });

  it("validates Arabic Cloud Envelope against Zod Schema", () => {
    const parsed = ImportEnvelopeSchema.parse(arabicCloudEnvelope);
    expect(parsed.books.length).toBe(1);
    expect(parsed.books[0]?.sourceTitle).toBe("صيد الخاطر (طبعة كيندل)");
    expect(parsed.books[0]?.annotations[0]?.rawText).toContain("العاقل من حاسب نفسه");
  });

  it("validates Publisher Clipping Limit Envelope", () => {
    const parsed = ImportEnvelopeSchema.parse(clippingLimitEnvelope);
    expect(parsed.books[0]?.annotations[0]?.contentLimitState).toBe("publisher_clipped");
  });

  it("proves duplicate quote text at different locations produces distinct IDs", () => {
    const parsed = ImportEnvelopeSchema.parse(duplicateQuoteDifferentLocations);
    const book = parsed.books[0]!;
    const annot1 = generateAnnotationId({
      bookId: "b-01",
      rawText: book.annotations[0]!.rawText,
      locationStart: book.annotations[0]!.locationStart,
    });
    const annot2 = generateAnnotationId({
      bookId: "b-01",
      rawText: book.annotations[1]!.rawText,
      locationStart: book.annotations[1]!.locationStart,
    });

    expect(annot1.id).not.toBe(annot2.id);
    expect(annot1.stableKey).not.toBe(annot2.stableKey);
  });

  it("has non-empty raw My Clippings and HTML sample data", () => {
    expect(rawMyClippingsSample.length).toBeGreaterThan(50);
    expect(rawKindleHtmlSample.length).toBeGreaterThan(50);
  });
});
