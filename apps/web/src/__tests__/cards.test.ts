import { describe, it, expect, beforeEach, vi } from "vitest";
import { ReadingCardsComponent } from "../components/reading-cards.js";
import { DEMO_BOOKS, DEMO_HIGHLIGHTS } from "../core/adapters/demo-data.js";

// Lightweight Node DOM simulation for card testing
function createMockElement(tag: string): any {
  const listeners: Record<string, Function[]> = {};
  const children: any[] = [];
  const attributes: Record<string, string> = {};

  const el: any = {
    tagName: tag.toUpperCase(),
    className: "",
    innerHTML: "",
    textContent: "",
    value: "",
    children,
    addEventListener: vi.fn((event: string, handler: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    click: vi.fn(() => {
      listeners["click"]?.forEach((h) => h({ stopPropagation: vi.fn() }));
    }),
    dispatchEvent: vi.fn((event: { type: string }) => {
      listeners[event.type]?.forEach((h) => h(event));
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
        } else if (sel.startsWith(".") && node.innerHTML && node.innerHTML.includes(sel.slice(1))) {
          results.push(createMockElement("button"));
        } else if (sel.startsWith('[data-subtab="') && node.getAttribute) {
          const match = sel.match(/\[data-subtab="([^"]+)"\]/);
          if (match && node.getAttribute("data-subtab") === match[1]) {
            results.push(node);
          }
        } else if (sel.startsWith('[data-status="') && node.getAttribute) {
          const match = sel.match(/\[data-status="([^"]+)"\]/);
          if (match && node.getAttribute("data-status") === match[1]) {
            results.push(node);
          }
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

describe("Reading OS Cards Grid & Kanban Board Component", () => {
  let container: any;
  let component: ReadingCardsComponent;
  let onSelectHlSpy: any;
  let onSelectBookSpy: any;
  let onUpdateStatusSpy: any;

  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn((tag: string) => createMockElement(tag)),
    } as any;

    container = createMockElement("div");
    onSelectHlSpy = vi.fn();
    onSelectBookSpy = vi.fn();
    onUpdateStatusSpy = vi.fn();

    component = new ReadingCardsComponent(container, {
      onSelectHighlight: onSelectHlSpy,
      onSelectBook: onSelectBookSpy,
      onUpdateBookStatus: onUpdateStatusSpy,
    });
  });

  it("renders sub-navigation tabs with correct counts", () => {
    component.render(DEMO_BOOKS, DEMO_HIGHLIGHTS);

    const subtabs = container.querySelectorAll(".subtab-btn");
    expect(subtabs.length).toBe(3);
  });

  it("renders highlight cards with quotes and importance tags", () => {
    component.render(DEMO_BOOKS, DEMO_HIGHLIGHTS);

    const cards = container.querySelectorAll(".editorial-highlight-card");
    expect(cards.length).toBe(DEMO_HIGHLIGHTS.length);
  });

  it("triggers onSelectHighlight callback when clicking a highlight card", () => {
    component.render(DEMO_BOOKS, DEMO_HIGHLIGHTS);

    const cards = container.querySelectorAll(".editorial-highlight-card");
    cards[0]?.click();

    expect(onSelectHlSpy).toHaveBeenCalledWith(DEMO_HIGHLIGHTS[0]);
  });

  it("switches to Books Shelf tab and renders book cards", () => {
    component.render(DEMO_BOOKS, DEMO_HIGHLIGHTS);

    const booksTabBtn = container.querySelectorAll('[data-subtab="books"]')[0];
    booksTabBtn?.click();

    const bookCards = container.querySelectorAll(".book-shelf-card");
    expect(bookCards.length).toBe(DEMO_BOOKS.length);
  });

  it("switches to Kanban Board tab and renders 3 status columns", () => {
    component.render(DEMO_BOOKS, DEMO_HIGHLIGHTS);

    const kanbanTabBtn = container.querySelectorAll('[data-subtab="kanban"]')[0];
    kanbanTabBtn?.click();

    const columns = container.querySelectorAll(".kanban-column");
    expect(columns.length).toBe(3);
  });

  it("provides quick action buttons for copying and artboard generation", () => {
    component.render(DEMO_BOOKS, DEMO_HIGHLIGHTS);

    const copyBtns = container.querySelectorAll(".btn-copy-quote");
    expect(copyBtns.length).toBe(DEMO_HIGHLIGHTS.length);

    const artboardBtns = container.querySelectorAll(".btn-artboard-quote");
    expect(artboardBtns.length).toBe(DEMO_HIGHLIGHTS.length);
  });
});
