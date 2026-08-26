import { describe, it, expect, beforeEach, vi } from "vitest";
import { ActiveRecallComponent } from "../components/active-recall.js";
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
    textContent: "",
    style: { display: "block", width: "" },
    children,
    addEventListener: vi.fn((event: string, handler: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }),
    click: vi.fn(() => {
      listeners["click"]?.forEach((h) => h({ stopPropagation: vi.fn(), target: el }));
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
        } else if (sel.startsWith('[data-rate="') && node.getAttribute) {
          const match = sel.match(/\[data-rate="([^"]+)"\]/);
          if (match && node.getAttribute("data-rate") === match[1]) results.push(node);
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

describe("Active Recall Flashcard Deck & Spaced Repetition Engine", () => {
  let container: any;
  let component: ActiveRecallComponent;

  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn((tag: string) => createMockElement(tag)),
      body: createMockElement("body"),
    } as any;

    globalThis.window = {
      addEventListener: vi.fn(),
    } as any;

    container = createMockElement("div");
    component = new ActiveRecallComponent(container);
  });

  it("initializes flashcard deck with highlight items", () => {
    component.setDeck(DEMO_HIGHLIGHTS);

    expect((component as any).deck.length).toBe(DEMO_HIGHLIGHTS.length);
    expect((component as any).currentIndex).toBe(0);
    expect((component as any).isFlipped).toBe(false);
  });

  it("flips card state on flipCard trigger", () => {
    component.setDeck(DEMO_HIGHLIGHTS);
    expect((component as any).isFlipped).toBe(false);

    component.flipCard();
    expect((component as any).isFlipped).toBe(true);

    component.flipCard();
    expect((component as any).isFlipped).toBe(false);
  });

  it("rates card as mastered and advances deck index", () => {
    component.setDeck(DEMO_HIGHLIGHTS);

    component.rateCard("mastered");
    expect((component as any).currentIndex).toBe(1);
    expect((component as any).stats.mastered).toBe(1);
    expect((component as any).stats.reviewed).toBe(1);
  });

  it("re-queues card to end of deck when rated hard (Again)", () => {
    component.setDeck(DEMO_HIGHLIGHTS);
    const initialCount = (component as any).deck.length;

    component.rateCard("hard");
    expect((component as any).deck.length).toBe(initialCount + 1);
    expect((component as any).stats.hard).toBe(1);
  });

  it("renders summary screen when entire deck is reviewed and allows restart", () => {
    const miniDeck = [DEMO_HIGHLIGHTS[0]!, DEMO_HIGHLIGHTS[1]!];
    component.setDeck(miniDeck);

    component.rateCard("mastered");
    component.rateCard("mastered");

    expect((component as any).currentIndex).toBe(2);

    // Restart deck
    component.restart();
    expect((component as any).currentIndex).toBe(0);
    expect((component as any).stats.reviewed).toBe(0);
  });
});
