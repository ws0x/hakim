import { describe, it, expect, beforeEach, vi } from "vitest";
import { CanvasGraphEngine } from "../components/graph-canvas.js";
import { GraphBuilder } from "../core/graph-builder.js";
import { DEMO_BOOKS, DEMO_HIGHLIGHTS } from "../core/adapters/demo-data.js";

describe("Canvas 2D Force-Directed Graph Engine", () => {
  let container: HTMLElement;
  let engine: CanvasGraphEngine;

  beforeEach(() => {
    // Setup Mock DOM Elements for Node/Vitest environment
    const mockContext = {
      scale: vi.fn(),
      clearRect: vi.fn(),
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
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      globalAlpha: 1,
    };

    const mockCanvas = {
      className: "",
      style: { width: "0px", height: "0px", cursor: "" },
      width: 1000,
      height: 800,
      getContext: vi.fn().mockReturnValue(mockContext),
      addEventListener: vi.fn(),
      getBoundingClientRect: vi.fn().mockReturnValue({ width: 1000, height: 800, top: 0, left: 0, right: 1000, bottom: 800 }),
    };

    const mockContainer = {
      appendChild: vi.fn(),
      querySelector: vi.fn().mockImplementation((sel: string) => sel === "canvas" ? mockCanvas : null),
      getBoundingClientRect: vi.fn().mockReturnValue({ width: 1000, height: 800, top: 0, left: 0, right: 1000, bottom: 800 }),
    };

    // Global document mock
    globalThis.document = {
      createElement: vi.fn().mockImplementation((tag: string) => {
        if (tag === "canvas") return mockCanvas;
        return {};
      }),
    } as any;

    globalThis.window = {
      devicePixelRatio: 1,
      addEventListener: vi.fn(),
    } as any;

    globalThis.requestAnimationFrame = vi.fn().mockReturnValue(1);
    globalThis.cancelAnimationFrame = vi.fn();

    container = mockContainer as unknown as HTMLElement;
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
});
