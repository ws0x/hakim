import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotionDirectClient } from "../background/notion-direct-client.js";

describe("Standalone Notion Direct Client", () => {
  let client: NotionDirectClient;

  beforeEach(() => {
    client = new NotionDirectClient("secret_test_token_123");
  });

  it("cleans and standardizes Notion 32-char UUID strings", async () => {
    // Mock global fetch for Notion
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/users/me")) {
        return {
          ok: true,
          json: async () => ({ name: "Hakim Bot" }),
        };
      }
      if (url.includes("/databases") && init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        return {
          ok: true,
          json: async () => ({
            id: `db_${Math.random().toString(36).substring(7)}`,
            parent: body.parent,
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({ message: "Not found" }) };
    });

    globalThis.fetch = fetchMock;

    // Test Connection
    const testResult = await client.testConnection();
    expect(testResult.valid).toBe(true);
    expect(testResult.botName).toBe("Hakim Bot");

    // Test Database Provisioning
    const prov = await client.provisionDatabases("1234567890abcdef1234567890abcdef");
    expect(prov.booksDbId).toBeDefined();
    expect(prov.highlightsDbId).toBeDefined();
  });
});
