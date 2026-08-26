import { describe, it, expect, beforeEach, vi } from "vitest";
import { CommandPaletteComponent } from "../components/command-palette.js";
import { ReadingStateStore } from "../core/store.js";
import { DEMO_BOOKS, DEMO_HIGHLIGHTS } from "../core/adapters/demo-data.js";

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
    focus: vi.fn(),
    scrollIntoView: vi.fn(),
    addEventListener: vi.fn((event: string, handler: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    dispatchEvent: vi.fn((event: any) => {
      listeners[event.type]?.forEach((h) => h(event));
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
      const found = el.querySelectorAll(sel)[0];
      if (found) return found;
      // Auto create if searching for common selectors in tests
      const sub = createMockElement(sel.startsWith(".") ? "div" : sel);
      if (sel.startsWith(".")) sub.className = sel.slice(1);
      else if (sel.startsWith("#")) sub.id = sel.slice(1);
      children.push(sub);
      return sub;
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

describe("Spotlight Command Palette Component (⌘K)", () => {
  let palette: CommandPaletteComponent;
  const onSelectView = vi.fn();
  const onOpenAi = vi.fn();

  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn((tag: string) => createMockElement(tag)),
      getElementById: vi.fn(() => createMockElement("div")),
      body: createMockElement("body"),
    } as any;

    globalThis.window = {
      addEventListener: vi.fn(),
    } as any;

    const store = ReadingStateStore.getInstance();
    store.loadCustomData(DEMO_BOOKS, DEMO_HIGHLIGHTS, "custom_file");

    palette = new CommandPaletteComponent({
      onSelectView,
      onOpenAi,
    });
  });

  it("initializes CommandPalette and manages open/close lifecycle", () => {
    expect(palette).toBeDefined();

    palette.open();
    expect((palette as any).isOpen).toBe(true);
    expect((palette as any).container.style.display).toBe("flex");

    palette.close();
    expect((palette as any).isOpen).toBe(false);
    expect((palette as any).container.style.display).toBe("none");
  });

  it("filters commands, books and highlights by query", () => {
    palette.open();

    // Query for "Designing Data"
    (palette as any).filterItems("Designing");
    expect((palette as any).filteredItems.length).toBeGreaterThan(0);
    const hasBook = (palette as any).filteredItems.some((item: any) =>
      item.title.includes("Designing") || (item.subtitle && item.subtitle.includes("Designing"))
    );
    expect(hasBook).toBe(true);

    // Query for "AI"
    (palette as any).filterItems("AI");
    const hasAi = (palette as any).filteredItems.some((item: any) =>
      item.title.toLowerCase().includes("ai")
    );
    expect(hasAi).toBe(true);
  });

  it("executes action when item is selected", () => {
    palette.open();
    (palette as any).filterItems("AI");

    const aiItem = (palette as any).filteredItems.find((i: any) => i.id === "act-ai");
    expect(aiItem).toBeDefined();

    (palette as any).executeItem(aiItem);
    expect(onOpenAi).toHaveBeenCalled();
    expect((palette as any).isOpen).toBe(false);
  });
});
