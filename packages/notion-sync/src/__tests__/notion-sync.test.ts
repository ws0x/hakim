import { describe, it, expect, vi } from "vitest";
import { NotionProvisioner, type NotionClientInterface } from "../provisioner.js";
import { NotionReconciler } from "../reconciliation.js";
import type { Book, Annotation, AnnotationUserState } from "@hakim/domain";

describe("Notion Reading OS Sync Engine", () => {
  it("provisions all 7 databases idempotently", async () => {
    const createdDbMap = new Map<string, unknown>();

    const mockClient: NotionClientInterface = {
      databases: {
        create: vi.fn().mockImplementation(async ({ title }) => {
          const dbId = `db_${Math.random().toString(36).substring(7)}`;
          createdDbMap.set(dbId, title);
          return { id: dbId };
        }),
        retrieve: vi.fn().mockImplementation(async ({ database_id }) => {
          if (createdDbMap.has(database_id)) {
            return { id: database_id, title: [{ plain_text: "Existing" }] };
          }
          throw new Error("Not found");
        }),
      },
    };

    const provisioner = new NotionProvisioner(mockClient);

    // First Run: create all 7
    const result1 = await provisioner.provisionAll("parent_page_123");
    expect(result1.createdCount).toBe(7);
    expect(result1.existingCount).toBe(0);
    expect(Object.keys(result1.databases).length).toBe(7);

    // Second Run with previous mapping: 0 created, 7 existing
    const result2 = await provisioner.provisionAll("parent_page_123", result1.databases);
    expect(result2.createdCount).toBe(0);
    expect(result2.existingCount).toBe(7);
  });

  it("maps Book and Highlight entities into Notion properties with proper types", () => {
    const book: Book = {
      id: "b-001",
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

    const annot: Annotation = {
      id: "a-001",
      bookId: "b-001",
      sourceKind: "kindle_cloud",
      type: "highlight",
      rawText: "Focus on high-leverage activities that produce outsized value per unit time.",
      normalizedText: "Focus on high-leverage activities that produce outsized value per unit time.",
      locationStart: 120,
      locationEnd: 125,
      page: 14,
      color: "yellow",
      firstImportedAt: "2026-08-26T00:00:00.000Z",
      lastSeenAt: "2026-08-26T00:00:00.000Z",
      sourceState: "active",
      contentLimitState: "normal",
      rawPayloadHash: "h123",
    };

    const userState: AnnotationUserState = {
      annotationId: "a-001",
      processStatus: "processed",
      importance: "essential",
      personalInterpretation: "Core productivity mental model.",
      agreement: "agree",
      userTags: ["productivity"],
      userLockedFields: [],
    };

    const bookProps = NotionReconciler.mapBookToNotionProperties(book);
    expect(bookProps["Title"]).toEqual({ title: [{ text: { content: "The Effective Engineer" } }] });
    expect(bookProps["ASIN"]).toEqual({ rich_text: [{ text: { content: "B005DOK8TK" } }] });

    const highlightProps = NotionReconciler.mapHighlightToNotionProperties(annot, userState);
    expect(highlightProps["Location"]).toEqual({ number: 120 });
    expect(highlightProps["Color"]).toEqual({ select: { name: "yellow" } });
    expect(highlightProps["Process Status"]).toEqual({ select: { name: "Processed" } });
    expect(highlightProps["Importance"]).toEqual({ select: { name: "Essential" } });
    expect(highlightProps["My Interpretation"]).toEqual({
      rich_text: [{ text: { content: "Core productivity mental model." } }],
    });
  });
});
