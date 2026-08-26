import { describe, it, expect } from "vitest";
import { formatBookMarkdown } from "../formatter.js";
import type { Book, Annotation, AnnotationUserState } from "@hakim/domain";

describe("Obsidian & Markdown Exporter", () => {
  const mockBook: Book = {
    id: "00000000-0000-0000-0000-000000000001",
    sourceBookKey: "amzn:B005DOK8TK",
    asin: "B005DOK8TK",
    sourceTitle: "The Effective Engineer",
    displayTitle: "The Effective Engineer",
    author: "Edmond Lau",
    sourceKinds: ["kindle_cloud"],
    sourceState: "active",
    firstSeenAt: "2026-08-26T00:00:00.000Z",
    lastSeenAt: "2026-08-26T00:00:00.000Z",
  };

  const mockAnnotation: Annotation = {
    id: "10000000-0000-0000-0000-000000000001",
    bookId: mockBook.id,
    sourceKind: "kindle_cloud",
    type: "highlight",
    rawText: "Focus on high-leverage activities that produce outsized value per unit time.",
    normalizedText: "Focus on high-leverage activities that produce outsized value per unit time.",
    locationStart: 120,
    locationEnd: 125,
    page: 14,
    color: "yellow",
    annotatedAt: "2026-08-20T14:30:00.000Z",
    firstImportedAt: "2026-08-26T00:00:00.000Z",
    lastSeenAt: "2026-08-26T00:00:00.000Z",
    sourceState: "active",
    contentLimitState: "normal",
    rawPayloadHash: "hash12345678",
  };

  const mockUserState: AnnotationUserState = {
    annotationId: mockAnnotation.id,
    processStatus: "processed",
    importance: "essential",
    personalInterpretation: "Key engineering principle for technical leadership.",
    agreement: "agree",
    userTags: ["leadership", "productivity"],
    userLockedFields: [],
  };

  it("formats valid YAML frontmatter, title, and highlights", () => {
    const md = formatBookMarkdown({
      book: mockBook,
      annotations: [{ annotation: mockAnnotation, userState: mockUserState }],
    });

    expect(md).toContain("---");
    expect(md).toContain('title: "The Effective Engineer"');
    expect(md).toContain('author: "Edmond Lau"');
    expect(md).toContain('asin: "B005DOK8TK"');
    expect(md).toContain("# The Effective Engineer");
    expect(md).toContain("> Focus on high-leverage activities that produce outsized value per unit time.");
    expect(md).toContain("Location 120 | Page 14 | Color: yellow");
    expect(md).toContain("**My Understanding:** Key engineering principle for technical leadership.");
    expect(md).toContain("**Importance:** `ESSENTIAL`");
  });
});
