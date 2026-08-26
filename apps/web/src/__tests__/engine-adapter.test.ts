import { describe, it, expect, beforeEach, vi } from "vitest";
import { EngineClientAdapter } from "../core/adapters/engine-adapter.js";
import { EngineBridgeModal } from "../components/engine-bridge-modal.js";

// Helper for Mock DOM
function createMockElement(tag: string): any {
  const listeners: Record<string, Function[]> = {};
  const children: any[] = [];
  const attributes: Record<string, string> = {};
  const classList = new Set<string>();

  const el: any = {
    tagName: tag.toUpperCase(),
    className: "",
    classList: {
      add: (cls: string) => classList.add(cls),
      remove: (cls: string) => classList.delete(cls),
      contains: (cls: string) => classList.has(cls),
    },
    innerHTML: "",
    textContent: "",
    style: { display: "none" },
    children,
    value: "",
    addEventListener: vi.fn((event: string, handler: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    click: vi.fn(() => {
      listeners["click"]?.forEach((h) => h({ target: el }));
    }),
    appendChild: vi.fn((child: any) => {
      children.push(child);
      return child;
    }),
    getAttribute: vi.fn((attr: string) => attributes[attr] || null),
    setAttribute: vi.fn((attr: string, val: string) => {
      attributes[attr] = val;
    }),
    querySelector: vi.fn((sel: string) => {
      return el.querySelectorAll(sel)[0] || null;
    }),
    querySelectorAll: vi.fn((sel: string) => {
      const results: any[] = [];
      function search(node: any) {
        if (sel.startsWith(".") && node.className && node.className.includes(sel.slice(1))) {
          results.push(node);
        } else if (sel.startsWith("#") && node.id === sel.slice(1)) {
          results.push(node);
        }
        if (node.children) {
          node.children.forEach(search);
        }
      }
      search(el);
      return results;
    }),
  };

  return el;
}

describe("Local SQLite Engine Client Adapter & Bridge", () => {
  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn((tag: string) => createMockElement(tag)),
      getElementById: vi.fn(() => createMockElement("button")),
      body: createMockElement("body"),
    } as any;

    globalThis.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
  });

  it("checks engine health status via REST API", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "healthy",
        version: "1.3.0",
        library: { books: 5, annotations: 42 },
      }),
    });

    const result = await EngineClientAdapter.checkHealth();
    expect(result.healthy).toBe(true);
    expect(result.version).toBe("1.3.0");
    expect(result.booksCount).toBe(5);
    expect(result.annotCount).toBe(42);
  });

  it("handles engine unreachable error gracefully", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await EngineClientAdapter.checkHealth();
    expect(result.healthy).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("verifies pairing token against engine /api/v1/pair", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await EngineClientAdapter.verifyPairing("valid_token_123");
    expect(result.success).toBe(true);
  });

  it("fetches full library snapshot with Bearer authentication", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        books: [{ id: "b1", title: "Meditations", author: "Marcus Aurelius", highlightsCount: 10, status: "reading" }],
        highlights: [{ id: "h1", bookId: "b1", bookTitle: "Meditations", rawText: "Quote", color: "yellow" }],
      }),
    });

    const result = await EngineClientAdapter.fetchLibrary("valid_token_123");
    expect(result.books.length).toBe(1);
    expect(result.highlights.length).toBe(1);
    expect(result.books[0]?.title).toBe("Meditations");
  });

  it("initializes EngineBridgeModal and manages open/close lifecycle", () => {
    const modal = new EngineBridgeModal();
    expect(modal).toBeDefined();

    modal.open();
    expect((modal as any).container.style.display).toBe("flex");

    modal.close();
    expect((modal as any).container.style.display).toBe("none");
  });
});
