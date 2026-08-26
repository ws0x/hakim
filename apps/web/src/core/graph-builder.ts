import type { BookItem, HighlightItem, GraphData, GraphNode, GraphLink } from "./types.js";

export class GraphBuilder {
  private static COLOR_PALETTE = {
    book: "#818cf8",
    topic: "#38bdf8",
    author: "#c084fc",
    yellowHighlight: "#fcd34d",
    blueHighlight: "#67e8f9",
    pinkHighlight: "#fda4af",
    orangeHighlight: "#fdba74",
  };

  /**
   * Transforms books and highlights into a force-directed topological network.
   */
  public static buildGraph(
    books: BookItem[],
    highlights: HighlightItem[],
    filteredHighlightIds?: Set<string>
  ): GraphData {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeSet = new Set<string>();

    const topicCounts = new Map<string, number>();

    // 1. Create Book Nodes
    for (let i = 0; i < books.length; i++) {
      const b = books[i]!;
      nodes.push({
        id: b.id,
        label: b.title,
        type: "book",
        group: 1,
        size: Math.max(16, Math.min(32, 14 + b.highlightsCount * 2)),
        color: this.COLOR_PALETTE.book,
        bookTitle: b.title,
      });
      nodeSet.add(b.id);

      // Extract book topics
      if (b.tags) {
        for (const tag of b.tags) {
          topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
        }
      }
    }

    // 2. Create Topic Hub Nodes (if topic is shared across multiple items)
    for (const [topic, count] of topicCounts.entries()) {
      const topicId = `topic-${topic.toLowerCase().replace(/\s+/g, "-")}`;
      nodes.push({
        id: topicId,
        label: `#${topic}`,
        type: "topic",
        group: 2,
        size: Math.max(12, Math.min(24, 10 + count * 3)),
        color: this.COLOR_PALETTE.topic,
      });
      nodeSet.add(topicId);

      // Link books to their topics
      for (const b of books) {
        if (b.tags?.includes(topic)) {
          links.push({
            source: b.id,
            target: topicId,
            type: "shares_topic",
            strength: 0.7,
          });
        }
      }
    }

    // 3. Create Highlight Nodes & Connect to Books and Topics
    for (const h of highlights) {
      if (filteredHighlightIds && !filteredHighlightIds.has(h.id)) {
        continue;
      }

      let hlColor = this.COLOR_PALETTE.yellowHighlight;
      if (h.color === "blue") hlColor = this.COLOR_PALETTE.blueHighlight;
      else if (h.color === "pink") hlColor = this.COLOR_PALETTE.pinkHighlight;
      else if (h.color === "orange") hlColor = this.COLOR_PALETTE.orangeHighlight;

      const locSnippet = h.location !== undefined ? `Loc ${h.location}` : "Note";
      const snippet = h.rawText.substring(0, 36) + (h.rawText.length > 36 ? "..." : "");

      nodes.push({
        id: h.id,
        label: `${locSnippet}: ${snippet}`,
        type: "highlight",
        group: 3,
        size: h.importance === "Essential" ? 10 : 7,
        color: hlColor,
        bookId: h.bookId,
        bookTitle: h.bookTitle,
        rawText: h.rawText,
        note: h.sourceNote,
        location: h.location,
        importance: h.importance,
      });
      nodeSet.add(h.id);

      // Link Highlight to its Parent Book
      if (nodeSet.has(h.bookId)) {
        links.push({
          source: h.bookId,
          target: h.id,
          type: "contains",
          strength: 0.9,
        });
      }

      // Link Highlight to matching Topic Hubs
      if (h.tags) {
        for (const tag of h.tags) {
          const topicId = `topic-${tag.toLowerCase().replace(/\s+/g, "-")}`;
          if (nodeSet.has(topicId)) {
            links.push({
              source: h.id,
              target: topicId,
              type: "shares_topic",
              strength: 0.4,
            });
          }
        }
      }
    }

    return { nodes, links };
  }
}
