import { describe, expect, it, vi } from "vitest";
import { NotionApiClient, NotionApiError } from "../client.js";
import { mapHighlightSourceProperties, toRichText } from "../projection.js";
import type { LocalAnnotationRecord } from "@hakim/domain";

describe("Notion 2025 client", () => {
  it("uses the 2025 API version and respects Retry-After", async () => {
    const sleeps: number[] = [];
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "rate_limited", message: "slow down" }), {
        status: 429,
        headers: { "Retry-After": "2", "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "Hakim" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    const client = new NotionApiClient("secret", {
      fetchFn,
      sleep: async (milliseconds) => { sleeps.push(milliseconds); },
      now: () => 1_000,
      random: () => 0,
    });

    await expect(client.testConnection()).resolves.toEqual({ name: "Hakim" });
    expect(sleeps).toContain(2_000);
    expect(fetchFn.mock.calls[0]?.[1]?.headers).toMatchObject({ "Notion-Version": "2025-09-03" });
  });

  it("fails closed after a non-retryable query error", async () => {
    const client = new NotionApiClient("secret", {
      fetchFn: async () => new Response(JSON.stringify({ code: "object_not_found", message: "missing" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
      sleep: async () => undefined,
    });

    await expect(client.queryAllPages("missing")).rejects.toBeInstanceOf(NotionApiError);
  });
});

describe("Notion projection", () => {
  it("chunks long rich text without loss", () => {
    const value = "x".repeat(4_501);
    const chunks = toRichText(value);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((item) => item.text.content).join("")).toBe(value);
  });

  it("clears removed source-owned values explicitly", () => {
    const annotation: LocalAnnotationRecord = {
      id: "11111111-1111-4111-8111-111111111111",
      identityVersion: 2,
      identityStrategy: "location_anchor",
      legacyIds: [],
      consecutiveCompleteMisses: 0,
      bookId: "22222222-2222-4222-8222-222222222222",
      sourceKind: "kindle_cloud",
      type: "highlight",
      rawText: "Quote",
      normalizedText: "Quote",
      locationStart: 10,
      color: "yellow",
      firstImportedAt: "2026-08-27T10:00:00.000Z",
      lastSeenAt: "2026-08-27T10:00:00.000Z",
      sourceState: "active",
      contentLimitState: "normal",
      rawPayloadHash: "12345678",
    };
    const properties = mapHighlightSourceProperties(
      annotation,
      "notion-book-page",
      "Book",
      "2026-08-27T10:00:00.000Z",
    );

    expect(properties["Kindle Note"]).toEqual({ rich_text: [] });
    expect(properties["Page"]).toEqual({ number: null });
  });
});
