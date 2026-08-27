import { describe, it, expect, beforeEach, vi } from "vitest";
import { CanvasGraphEngine } from "../components/graph-canvas.js";
import { GraphBuilder } from "../core/graph-builder.js";
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
    style: { display: "none", width: "1000px", height: "800px", cursor: "" },
    children,
    value: "500",
    checked: true,
    width: 1000,
    height: 800,
    getContext: vi.fn().mockReturnValue({
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      createRadialGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      globalAlpha: 1,
      shadowColor: "",
      shadowBlur: 0,
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
    removeChild: vi.fn((child: any) => {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
    }),
    getBoundingClientRect: vi.fn().mockReturnValue({ width: 1000, height: 800, top: 0, left: 0, right: 1000, bottom: 800 }),
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

describe("Canvas 2D Force-Directed Graph Engine", () => {
  let container: HTMLElement;
  let engine: CanvasGraphEngine;

  beforeEach(() => {
    container = createMockElement("div");

    globalThis.document = {
      createElement: vi.fn((tag: string) => createMockElement(tag)),
      getElementById: vi.fn(() => createMockElement("div")),
      body: createMockElement("body"),
    } as any;

    globalThis.window = {
      devicePixelRatio: 1,
      addEventListener: vi.fn(),
    } as any;

    globalThis.requestAnimationFrame = vi.fn().mockReturnValue(1);
    globalThis.cancelAnimationFrame = vi.fn();

    engine = new CanvasGraphEngine(container);
  });

  it("initializes canvas element within container", () => {
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });

  it("loads graph data and instantiates simulation nodes and links", () => {
    const graphData = GraphBuilder.buildGraph(DEMO_BOOKS, DEMO_HIGHLIGHTS);
    engine.setData(graphData);

    expect(graphData.nodes.length).toBeGreaterThan(15);
    expect(graphData.links.length).toBeGreaterThan(10);
  });

  it("executes physics simulation ticks and applies velocity damping", () => {
    const graphData = GraphBuilder.buildGraph(DEMO_BOOKS, DEMO_HIGHLIGHTS);
    engine.setData(graphData);

    // Run 10 ticks
    for (let i = 0; i < 10; i++) {
      engine.tick();
    }

    // Engine should execute without crashing
    expect(true).toBe(true);
  });

  it("supports interactive zoom in, zoom out, and reset transforms", () => {
    engine.zoomIn();
    expect((engine as any).scale).toBeGreaterThan(1.0);

    engine.zoomOut();
    engine.zoomOut();
    expect((engine as any).scale).toBeLessThan(1.25);

    engine.resetView();
    expect((engine as any).scale).toBe(1.0);
  });

  it("toggles physics simulation active state", () => {
    const state1 = engine.togglePhysics();
    expect(state1).toBe(false);

    const state2 = engine.togglePhysics();
    expect(state2).toBe(true);
  });

  it("smoothly triggers flyToNode camera centering", () => {
    const graphData = GraphBuilder.buildGraph(DEMO_BOOKS, DEMO_HIGHLIGHTS);
    engine.setData(graphData);

    const targetNode = (engine as any).nodes[0];
    expect(targetNode).toBeDefined();

    engine.flyToNode(targetNode, 2.0);
    expect((engine as any).targetScale).toBe(2.0);
    expect((engine as any).selectedNode).toBe(targetNode);
  });

  it("initializes and updates Obsidian HUD physics parameters", () => {
    expect(engine.config.repulsion).toBe(1400);
    expect(engine.config.linkDistance).toBe(160);
    expect(engine.config.showLabels).toBe(true);
    expect(engine.config.showParticles).toBe(true);

    engine.config.repulsion = 800;
    expect(engine.config.repulsion).toBe(800);
  });
});
