import { describe, it, expect, beforeEach } from "vitest";
import { ReadingStateStore } from "../core/store.js";
import { GraphBuilder } from "../core/graph-builder.js";
import { FileImportAdapter } from "../core/adapters/file-adapter.js";

describe("Web Client Core State Store & Data Adapters", () => {
  let store: ReadingStateStore;

  beforeEach(() => {
    store = ReadingStateStore.getInstance();
    store.loadDemoData();
  });

  it("initializes with demo dataset and computed topological graph", () => {
    const state = store.getState();
    expect(state.books.length).toBe(5);
    expect(state.highlights.length).toBe(15);
    expect(state.graphData.nodes.length).toBeGreaterThan(15);
    expect(state.graphData.links.length).toBeGreaterThan(10);
  });

  it("filters highlights by book selection and updates graph topology", () => {
    store.selectBook("book-1"); // Designing Data-Intensive Applications
    const filtered = store.getFilteredHighlights();
    expect(filtered.length).toBe(4);
    expect(filtered.every((h) => h.bookId === "book-1")).toBe(true);

    const graph = store.getState().graphData;
    const highlightNodes = graph.nodes.filter((n) => n.type === "highlight");
    expect(highlightNodes.length).toBe(4);
  });

  it("filters highlights by text search query across quotes and notes", () => {
    store.setSearchQuery("reliability");
    const filtered = store.getFilteredHighlights();
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered[0]?.rawText.toLowerCase()).toContain("reliability");
  });

  it("toggles color filters dynamically", () => {
    store.toggleColorFilter("yellow"); // Remove yellow
    const filtered = store.getFilteredHighlights();
    expect(filtered.every((h) => h.color !== "yellow")).toBe(true);

    store.toggleColorFilter("yellow"); // Re-add yellow
    const refiltered = store.getFilteredHighlights();
    expect(refiltered.some((h) => h.color === "yellow")).toBe(true);
  });

  it("notifies reactive subscribers upon state mutation", () => {
    let callCount = 0;
    const unsubscribe = store.subscribe(() => {
      callCount++;
    });

    store.setView("cards");
    expect(callCount).toBe(2); // initial call + update call

    unsubscribe();
    store.setView("graph");
    expect(callCount).toBe(2); // No extra calls after unsubscribe
  });

  it("parses raw My Clippings.txt text in browser via FileImportAdapter", () => {
    const sampleClippings = `
Designing Data-Intensive Applications (Kleppmann, Martin)
- Your Highlight on Location 120 | Added on Tuesday, August 26, 2026 2:00:00 PM

Reliability means continuing to work correctly even when things go wrong.
==========
Atomic Habits (Clear, James)
- Your Highlight on Location 340 | Added on Tuesday, August 26, 2026 3:00:00 PM

You do not rise to the level of your goals. You fall to the level of your systems.
==========
    `;

    const result = FileImportAdapter.parseMyClippings(sampleClippings);
    expect(result.books.length).toBe(2);
    expect(result.highlights.length).toBe(2);
    expect(result.books[0]?.title).toBe("Designing Data-Intensive Applications");
    expect(result.books[0]?.author).toBe("Martin Kleppmann");
    expect(result.highlights[0]?.rawText).toContain("Reliability means continuing to work");
    expect(result.highlights[1]?.rawText).toContain("You fall to the level of your systems");
  });

  it("parses Readwise CSV files in browser via FileImportAdapter", () => {
    const sampleCsv = `"Highlight","Book Title","Book Author","Location","Color","Annotation"
"Reliability means continuing to work.","Designing Data-Intensive Applications","Martin Kleppmann","450","yellow","Core note"
"Small changes lead to remarkable results.","Atomic Habits","James Clear","120","pink","Habit loop"`;

    const result = FileImportAdapter.parseReadwiseCsv(sampleCsv);
    expect(result.books.length).toBe(2);
    expect(result.highlights.length).toBe(2);
    expect(result.books[0]?.title).toBe("Designing Data-Intensive Applications");
    expect(result.highlights[0]?.color).toBe("yellow");
    expect(result.highlights[0]?.sourceNote).toBe("Core note");
    expect(result.highlights[1]?.color).toBe("pink");
  });

  it("builds bidirectional graph links between books, highlights, and topic hubs", () => {
    const graph = GraphBuilder.buildGraph(store.getState().books, store.getState().highlights);
    const bookNodes = graph.nodes.filter((n) => n.type === "book");
    const topicNodes = graph.nodes.filter((n) => n.type === "topic");
    const highlightNodes = graph.nodes.filter((n) => n.type === "highlight");

    expect(bookNodes.length).toBe(5);
    expect(topicNodes.length).toBeGreaterThan(0);
    expect(highlightNodes.length).toBeGreaterThan(0);

    // Verify links exist
    const containsLinks = graph.links.filter((l) => l.type === "contains");
    const topicLinks = graph.links.filter((l) => l.type === "shares_topic");
    expect(containsLinks.length).toBeGreaterThan(10);
    expect(topicLinks.length).toBeGreaterThan(0);
  });
});
