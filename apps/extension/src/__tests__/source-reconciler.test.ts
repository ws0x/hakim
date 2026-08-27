import { describe, expect, it } from "vitest";
import type { LocalAnnotationRecord, RawImportBook } from "@hakim/domain";
import { reconcileSourceSnapshot } from "../storage/source-reconciler.js";

const rawBook: RawImportBook = {
  sourceBookKey: "amzn:B001TEST01",
  asin: "B001TEST01",
  sourceTitle: "A Test Book",
  author: "Writer, Example",
  annotations: [
    {
      type: "highlight",
      rawText: "Original exact quote.",
      locationStart: 100,
      locationEnd: 105,
      color: "yellow",
      contentLimitState: "normal",
    },
  ],
};

describe("source snapshot reconciliation", () => {
  it("updates an expanded highlight without changing identity", () => {
    const first = reconcileSourceSnapshot({
      rawBooks: [rawBook],
      existingBooks: [],
      existingAnnotations: [],
      existingUserStates: [],
      completeness: "complete",
      amazonRegion: "com",
      now: "2026-08-27T10:00:00.000Z",
    });
    const expanded: RawImportBook = {
      ...rawBook,
      annotations: [{ ...rawBook.annotations[0]!, rawText: "Original exact quote. Expanded later.", locationEnd: 110 }],
    };
    const second = reconcileSourceSnapshot({
      rawBooks: [expanded],
      existingBooks: first.books,
      existingAnnotations: first.annotations,
      existingUserStates: first.userStates,
      completeness: "complete",
      amazonRegion: "com",
      now: "2026-08-27T11:00:00.000Z",
    });

    expect(second.annotations).toHaveLength(1);
    expect(second.annotations[0]?.id).toBe(first.annotations[0]?.id);
    expect(second.annotations[0]?.rawText).toBe("Original exact quote. Expanded later.");
    expect(second.createdAnnotations).toBe(0);
  });

  it("requires two complete snapshots before confirming a missing annotation", () => {
    const existing = reconcileSourceSnapshot({
      rawBooks: [rawBook],
      existingBooks: [],
      existingAnnotations: [],
      existingUserStates: [],
      completeness: "complete",
      amazonRegion: "com",
      now: "2026-08-27T10:00:00.000Z",
    }).annotations[0] as LocalAnnotationRecord;

    const partial = reconcileSourceSnapshot({
      rawBooks: [], existingBooks: [], existingAnnotations: [existing], existingUserStates: [],
      completeness: "partial", amazonRegion: "com", now: "2026-08-27T11:00:00.000Z",
    }).annotations[0]!;
    const firstComplete = reconcileSourceSnapshot({
      rawBooks: [], existingBooks: [], existingAnnotations: [partial], existingUserStates: [],
      completeness: "complete", amazonRegion: "com", now: "2026-08-27T12:00:00.000Z",
    }).annotations[0]!;
    const secondComplete = reconcileSourceSnapshot({
      rawBooks: [], existingBooks: [], existingAnnotations: [firstComplete], existingUserStates: [],
      completeness: "complete", amazonRegion: "com", now: "2026-08-27T13:00:00.000Z",
    }).annotations[0]!;

    expect(partial.sourceState).toBe("active");
    expect(firstComplete.sourceState).toBe("source_missing");
    expect(secondComplete.sourceState).toBe("confirmed_missing");
  });
});
