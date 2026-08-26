import { describe, it, expect, beforeEach, vi } from "vitest";
import { AISynthesisEngine } from "../core/ai/ai-engine.js";
import { AISynthesisModal } from "../components/ai-synthesis-modal.js";
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

describe("In-Browser AI Reading Synthesis & Concept Clustering Engine", () => {
  const mockBooks: BookItem[] = [
    { id: "b1", title: "Meditations", author: "Marcus Aurelius", highlightsCount: 2, status: "completed" },
    { id: "b2", title: "Letters from a Stoic", author: "Seneca", highlightsCount: 2, status: "reading" },
  ];

  const mockHighlights: HighlightItem[] = [
    {
      id: "h1",
      bookId: "b1",
      bookTitle: "Meditations",
      rawText: "You have power over your mind, not outside events. Realize this, and you will find strength.",
      tags: ["Stoicism", "Mindset"],
      color: "yellow",
      importance: "High",
    },
    {
      id: "h2",
      bookId: "b2",
      bookTitle: "Letters from a Stoic",
      rawText: "We suffer more often in imagination than in reality. Discipline your mind.",
      tags: ["Stoicism", "Discipline"],
      color: "pink",
      importance: "High",
    },
  ];

  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn((tag: string) => createMockElement(tag)),
      getElementById: vi.fn(() => createMockElement("div")),
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

  it("extracts multi-book thematic concept clusters", async () => {
    const clusters = await AISynthesisEngine.extractConceptClusters(mockHighlights, mockBooks);
    expect(clusters.length).toBeGreaterThan(0);

    const stoicismCluster = clusters.find((c) => c.conceptName.toLowerCase().includes("stoicism"));
    expect(stoicismCluster).toBeDefined();
    expect(stoicismCluster?.relatedBooks.length).toBe(2);
    expect(stoicismCluster?.highlightIds.length).toBe(2);
  });

  it("generates an executive synthesis brief with mental models and actionable takeaways", async () => {
    const synthesis = await AISynthesisEngine.generateExecutiveSynthesis(mockHighlights);
    expect(synthesis.title).toContain("Reading Intelligence Synthesis");
    expect(synthesis.summary.length).toBeGreaterThan(50);
    expect(synthesis.mentalModels.length).toBeGreaterThan(0);
    expect(synthesis.actionableTakeaways.length).toBeGreaterThan(0);
  });

  it("generates Socratic active recall questions from highlighted quotes", async () => {
    const questions = await AISynthesisEngine.generateSocraticQuestions(mockHighlights);
    expect(questions.length).toBe(2);
    expect(questions[0]?.question).toContain("Meditations");
    expect(questions[0]?.bookTitle).toBe("Meditations");
  });

  it("manages AISynthesisModal lifecycle and tab switching", async () => {
    const modal = new AISynthesisModal();
    expect(modal).toBeDefined();

    modal.open();
    expect((modal as any).container.style.display).toBe("flex");

    modal.close();
    expect((modal as any).container.style.display).toBe("none");
  });
});
