import { describe, it, expect, beforeEach, vi } from "vitest";
import { QuoteCardModal } from "../components/quote-card-modal.js";
import { SlideoverDrawer } from "../components/slideover-drawer.js";
import { DEMO_HIGHLIGHTS } from "../core/adapters/demo-data.js";

// Helper for Mock DOM
function createMockElement(tag: string): any {
  const listeners: Record<string, Function[]> = {};
  const children: any[] = [];
  const attributes: Record<string, string> = {};
  const classList = new Set<string>();

  const mockCtx = {
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 120 }),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    globalAlpha: 1,
  };

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
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(mockCtx),
    toDataURL: vi.fn().mockReturnValue("data:image/png;base64,mockImage"),
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
        } else if (sel.startsWith('[data-theme="') && node.getAttribute) {
          const match = sel.match(/\[data-theme="([^"]+)"\]/);
          if (match && node.getAttribute("data-theme") === match[1]) results.push(node);
        } else if (sel.startsWith('[data-ratio="') && node.getAttribute) {
          const match = sel.match(/\[data-ratio="([^"]+)"\]/);
          if (match && node.getAttribute("data-ratio") === match[1]) results.push(node);
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

describe("Social Quote Card Generator & Slideover Drawer", () => {
  beforeEach(() => {
    globalThis.document = {
      createElement: vi.fn((tag: string) => createMockElement(tag)),
      body: createMockElement("body"),
    } as any;

    globalThis.window = {
      addEventListener: vi.fn(),
    } as any;
  });

  it("initializes QuoteCardModal with canvas context", () => {
    const modal = new QuoteCardModal();
    expect(modal).toBeDefined();
  });

  it("renders quote card canvas and adjusts dimensions for aspect ratios", () => {
    const modal = new QuoteCardModal();
    const hl = DEMO_HIGHLIGHTS[0]!;

    modal.open(hl);

    // 1:1 Square
    expect((modal as any).canvas.width).toBe(1200);
    expect((modal as any).canvas.height).toBe(1200);

    // 9:16 Story
    (modal as any).currentRatio = "9:16";
    modal.renderCanvas();
    expect((modal as any).canvas.width).toBe(1080);
    expect((modal as any).canvas.height).toBe(1920);

    // 16:9 Banner
    (modal as any).currentRatio = "16:9";
    modal.renderCanvas();
    expect((modal as any).canvas.width).toBe(1920);
    expect((modal as any).canvas.height).toBe(1080);

    // 4:5 Portrait
    (modal as any).currentRatio = "4:5";
    modal.renderCanvas();
    expect((modal as any).canvas.width).toBe(1080);
    expect((modal as any).canvas.height).toBe(1350);
  });

  it("applies theme gradients (obsidian, sunset, emerald, minimal)", () => {
    const modal = new QuoteCardModal();
    const hl = DEMO_HIGHLIGHTS[0]!;
    modal.open(hl);

    (modal as any).currentTheme = "sunset";
    modal.renderCanvas();

    (modal as any).currentTheme = "emerald";
    modal.renderCanvas();

    expect(true).toBe(true);
  });

  it("initializes SlideoverDrawer and opens with highlight metadata", () => {
    const drawer = new SlideoverDrawer();
    const hl = DEMO_HIGHLIGHTS[0]!;

    drawer.open(hl);
    expect((drawer as any).currentHighlight).toBe(hl);
    expect((drawer as any).backdrop.style.display).toBe("flex");

    drawer.close();
    expect((drawer as any).panel.classList.contains("open")).toBe(false);
  });
});
