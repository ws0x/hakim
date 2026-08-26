import { describe, it, expect, beforeEach, vi } from "vitest";
import { SlideoverDrawer } from "../components/slideover-drawer.js";
import { DEMO_HIGHLIGHTS } from "../core/adapters/demo-data.js";

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
    getContext: vi.fn().mockReturnValue({
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    }),
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
        } else if (node.tagName && node.tagName.toLowerCase() === sel.toLowerCase()) {
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

describe("Slideover Detail Drawer with Academic Citations", () => {
  let drawer: SlideoverDrawer;

  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn((tag: string) => createMockElement(tag)),
      getElementById: vi.fn(() => createMockElement("div")),
      body: createMockElement("body"),
    } as any;

    globalThis.window = {
      addEventListener: vi.fn(),
    } as any;

    drawer = new SlideoverDrawer();
  });

  it("initializes SlideoverDrawer and opens with highlight data", () => {
    expect(drawer).toBeDefined();

    drawer.open(DEMO_HIGHLIGHTS[0]!);
    expect((drawer as any).currentHighlight).toEqual(DEMO_HIGHLIGHTS[0]);
    expect((drawer as any).backdrop.style.display).toBe("flex");

    drawer.close();
    expect((drawer as any).panel.classList.contains("open")).toBe(false);
  });

  it("formats citations in Obsidian, APA, MLA, and Chicago styles", () => {
    const hl = DEMO_HIGHLIGHTS[0]!;

    const obsidianCite = (drawer as any).generateCitation(hl, "obsidian");
    expect(obsidianCite).toContain("[[Books/");
    expect(obsidianCite).toContain(`^hl-${hl.id}`);

    const apaCite = (drawer as any).generateCitation(hl, "apa");
    expect(apaCite).toContain(hl.bookTitle);

    const mlaCite = (drawer as any).generateCitation(hl, "mla");
    expect(mlaCite).toContain("Kindle ed.");

    const chicagoCite = (drawer as any).generateCitation(hl, "chicago");
    expect(chicagoCite).toContain(hl.bookTitle);
  });
});
