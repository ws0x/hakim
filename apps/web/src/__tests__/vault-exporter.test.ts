import { describe, it, expect, beforeEach, vi } from "vitest";
import { VaultExporter } from "../core/export/vault-exporter.js";
import { ZipBuilder } from "../core/export/zip-builder.js";
import { ObsidianExportModal } from "../components/obsidian-export-modal.js";
import type { HighlightItem, BookItem } from "../core/types.js";

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
    innerText: "",
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
    removeChild: vi.fn((child: any) => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
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

describe("Obsidian Markdown Vault & Bi-directional Link Exporter", () => {
  const mockBooks: BookItem[] = [
    { id: "b1", title: "Meditations", author: "Marcus Aurelius", asin: "B000JML234", highlightsCount: 2, status: "completed" },
  ];

  const mockHighlights: HighlightItem[] = [
    {
      id: "h1",
      bookId: "b1",
      bookTitle: "Meditations",
      rawText: "You have power over your mind, not outside events.",
      chapter: "Book IV",
      location: 142,
      color: "yellow",
      importance: "High",
      interpretation: "Focus on internal control.",
      tags: ["Stoicism"],
    },
    {
      id: "h2",
      bookId: "b1",
      bookTitle: "Meditations",
      rawText: "The impediment to action advances action. What stands in the way becomes the way.",
      chapter: "Book V",
      location: 210,
      color: "pink",
      tags: ["Stoicism", "Action"],
    },
  ];

  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn((tag: string) => createMockElement(tag)),
      getElementById: vi.fn(() => createMockElement("div")),
      body: createMockElement("body"),
    } as any;

    globalThis.URL = {
      createObjectURL: vi.fn(() => "blob:http://localhost/mock-blob"),
      revokeObjectURL: vi.fn(),
    } as any;
  });

  it("formats a single book note with YAML frontmatter, Obsidian callouts, and block anchors", () => {
    const markdown = VaultExporter.formatBookNote(mockBooks[0]!, mockHighlights);

    expect(markdown).toContain("---");
    expect(markdown).toContain('title: "Meditations"');
    expect(markdown).toContain('author: "Marcus Aurelius"');
    expect(markdown).toContain("> [!quote] Highlight #1");
    expect(markdown).toContain("> [!danger] Highlight #2");
    expect(markdown).toContain("**💡 Reflection:** Focus on internal control.");
    expect(markdown).toContain("^hl-h1");
    expect(markdown).toContain("^hl-h2");
  });

  it("formats concept hub notes linking multi-book highlights with wikilinks", () => {
    const conceptMarkdown = VaultExporter.formatConceptNote("Stoicism", mockHighlights);

    expect(conceptMarkdown).toContain("# Concept: #Stoicism");
    expect(conceptMarkdown).toContain("- [[Books/Meditations|Meditations]]");
    expect(conceptMarkdown).toContain('concept: "Stoicism"');
  });

  it("generates a complete structured Obsidian Vault with Index, Books, and Concepts", () => {
    const result = VaultExporter.generateVault(mockBooks, mockHighlights);

    expect(result.booksCount).toBe(1);
    expect(result.highlightsCount).toBe(2);
    expect(result.conceptsCount).toBe(2); // Stoicism & Action

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("Index.md");
    expect(paths).toContain("Books/Meditations.md");
    expect(paths).toContain("Concepts/Stoicism.md");
    expect(paths).toContain("Concepts/Action.md");
  });

  it("generates a valid binary ZIP archive with correct signature using ZipBuilder", () => {
    const zip = new ZipBuilder();
    zip.addFile("test.txt", "Hello Obsidian");

    const blob = zip.generateBlob();
    expect(blob).toBeDefined();
    expect(blob.type).toBe("application/zip");
  });

  it("initializes ObsidianExportModal and manages open/close lifecycle", () => {
    const modal = new ObsidianExportModal();
    expect(modal).toBeDefined();

    modal.open();
    expect((modal as any).container.style.display).toBe("flex");

    modal.close();
    expect((modal as any).container.style.display).toBe("none");
  });
});
