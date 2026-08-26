import type { HighlightItem, BookItem } from "../types.js";

export interface ConceptCluster {
  conceptName: string;
  description: string;
  relatedBooks: string[];
  highlightIds: string[];
  keyQuotes: string[];
}

export interface ExecutiveSynthesis {
  title: string;
  summary: string;
  mentalModels: string[];
  actionableTakeaways: string[];
  sourceHighlightsCount: number;
}

export interface SocraticQuestion {
  id: string;
  question: string;
  idealAnswer: string;
  sourceHighlight: string;
  bookTitle: string;
}

export interface AIProviderConfig {
  provider: "heuristic" | "ollama" | "openrouter" | "gemini";
  apiKey?: string;
  endpoint?: string;
  modelName?: string;
}

export class AISynthesisEngine {
  private static storageKey = "hakim_ai_config";

  public static getSavedConfig(): AIProviderConfig {
    try {
      const saved = localStorage.getItem(AISynthesisEngine.storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore
    }
    return { provider: "heuristic", modelName: "local-heuristic" };
  }

  public static saveConfig(config: AIProviderConfig): void {
    try {
      localStorage.setItem(AISynthesisEngine.storageKey, JSON.stringify(config));
    } catch {
      // Ignore
    }
  }

  /**
   * Discovers thematic concept clusters across books using heuristic NLP semantic analysis or LLM.
   */
  public static async extractConceptClusters(
    highlights: HighlightItem[],
    books: BookItem[],
    config: AIProviderConfig = AISynthesisEngine.getSavedConfig()
  ): Promise<ConceptCluster[]> {
    if (highlights.length === 0) return [];

    // If external LLM is configured with an API key
    if (config.provider !== "heuristic" && config.apiKey && config.endpoint) {
      try {
        return await AISynthesisEngine.fetchLLMClusters(highlights, config);
      } catch (err) {
        console.warn("LLM clustering failed, falling back to local heuristic:", err);
      }
    }

    // High-speed deterministic client-side heuristic clustering
    return AISynthesisEngine.heuristicClusterExtraction(highlights, books);
  }

  /**
   * Generates an Executive Brief and actionable Mental Models from the active reading library.
   */
  public static async generateExecutiveSynthesis(
    highlights: HighlightItem[],
    focusTopic?: string,
    config: AIProviderConfig = AISynthesisEngine.getSavedConfig()
  ): Promise<ExecutiveSynthesis> {
    if (highlights.length === 0) {
      return {
        title: "No Highlights Selected",
        summary: "Please select or import highlights to generate an executive synthesis.",
        mentalModels: [],
        actionableTakeaways: [],
        sourceHighlightsCount: 0,
      };
    }

    if (config.provider !== "heuristic" && config.apiKey && config.endpoint) {
      try {
        return await AISynthesisEngine.fetchLLMSynthesis(highlights, focusTopic, config);
      } catch (err) {
        console.warn("LLM synthesis failed, falling back to heuristic:", err);
      }
    }

    return AISynthesisEngine.heuristicExecutiveSynthesis(highlights, focusTopic);
  }

  /**
   * Generates Socratic Active Recall questions from highlighted passages.
   */
  public static async generateSocraticQuestions(
    highlights: HighlightItem[],
    config: AIProviderConfig = AISynthesisEngine.getSavedConfig()
  ): Promise<SocraticQuestion[]> {
    if (highlights.length === 0) return [];

    return highlights.slice(0, 10).map((h, i) => {
      // Identify key insight or core sentence
      const cleanQuote = h.rawText.trim();
      const firstSentence = cleanQuote.split(".")[0] || cleanQuote;

      let question = `How does the principle of "${h.tags?.[0] || 'this concept'}" in "${h.bookTitle}" apply to high-leverage decision making?`;
      if (h.rawText.toLowerCase().includes("stoic") || h.rawText.toLowerCase().includes("discipline")) {
        question = `According to ${h.bookTitle}, what is the distinction between internal control and external events?`;
      } else if (h.rawText.toLowerCase().includes("system") || h.rawText.toLowerCase().includes("data")) {
        question = `What fundamental architectural trade-off is emphasized in "${h.bookTitle}" regarding this quote?`;
      }

      return {
        id: `q-${i}-${h.id}`,
        question,
        idealAnswer: h.interpretation || h.sourceNote || firstSentence,
        sourceHighlight: h.rawText,
        bookTitle: h.bookTitle,
      };
    });
  }

  // --- Local Heuristic Engines (Zero API Key / 100% Offline) ---

  private static heuristicClusterExtraction(highlights: HighlightItem[], books: BookItem[]): ConceptCluster[] {
    const topicMap = new Map<string, { highlightIds: string[]; quotes: string[]; bookTitles: Set<string> }>();

    // 1. Group by existing tags or extracted vocabulary
    highlights.forEach((h) => {
      const candidates = h.tags && h.tags.length > 0 ? h.tags : AISynthesisEngine.extractKeywords(h.rawText);

      candidates.forEach((tag) => {
        const normalized = tag.toLowerCase().trim();
        if (normalized.length < 3) return;

        if (!topicMap.has(normalized)) {
          topicMap.set(normalized, { highlightIds: [], quotes: [], bookTitles: new Set() });
        }

        const entry = topicMap.get(normalized)!;
        entry.highlightIds.push(h.id);
        entry.quotes.push(h.rawText);
        entry.bookTitles.add(h.bookTitle);
      });
    });

    // 2. Sort by multi-book connectivity and density
    const clusters: ConceptCluster[] = [];
    topicMap.forEach((data, topic) => {
      if (data.highlightIds.length >= 2 || data.bookTitles.size >= 1) {
        const titleFormatted = topic.charAt(0).toUpperCase() + topic.slice(1);
        clusters.push({
          conceptName: `#${titleFormatted}`,
          description: `Cross-cutting principle spanning ${data.bookTitles.size} books, connecting ${data.highlightIds.length} foundational passages.`,
          relatedBooks: Array.from(data.bookTitles),
          highlightIds: data.highlightIds,
          keyQuotes: data.quotes.slice(0, 3),
        });
      }
    });

    return clusters.sort((a, b) => b.highlightIds.length - a.highlightIds.length).slice(0, 8);
  }

  private static heuristicExecutiveSynthesis(highlights: HighlightItem[], focusTopic?: string): ExecutiveSynthesis {
    const bookTitles = Array.from(new Set(highlights.map((h) => h.bookTitle)));
    const title = focusTopic ? `Executive Brief: ${focusTopic}` : `Reading Intelligence Synthesis (${bookTitles.length} Books)`;

    const quotes = highlights.map((h) => h.rawText);
    const primaryQuote = quotes[0] || "";
    const secondaryQuote = quotes[1] || quotes[0] || "";

    const summary = `Synthesizing ${highlights.length} core passages across ${bookTitles.join(", ")}. A recurring dialectic emerges: durable outcomes require foundational discipline and system-level fault tolerance rather than ad-hoc intervention. As captured in the literature: "${primaryQuote.slice(0, 140)}..."`;

    const mentalModels = [
      "First-Principles Invariance: Distinguish immutable physical or algorithmic laws from transient user assumptions.",
      "Asymmetric Feedback Loops: Small habits and deterministic routines compound into resilient long-term architectures.",
      "Cognitive Provenance: Preserving raw source observations alongside evolving human reflections prevents semantic drift.",
    ];

    const actionableTakeaways = [
      `Structure recurring review intervals for key passages in ${bookTitles[0] || "your library"}.`,
      "Translate abstract philosophical insights into concrete operational heuristics.",
      "Anchor conceptual highlights into your Notion knowledge graph for permanent retrieval.",
    ];

    return {
      title,
      summary,
      mentalModels,
      actionableTakeaways,
      sourceHighlightsCount: highlights.length,
    };
  }

  private static extractKeywords(text: string): string[] {
    const stopwords = new Set([
      "the", "and", "that", "this", "with", "from", "have", "will", "what", "when", "where", "which",
      "about", "into", "their", "there", "would", "could", "should", "being", "these", "those",
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 4 && !stopwords.has(w));

    return Array.from(new Set(words)).slice(0, 3);
  }

  // --- External LLM API Connectors ---

  private static async fetchLLMClusters(highlights: HighlightItem[], config: AIProviderConfig): Promise<ConceptCluster[]> {
    const prompt = `Analyze these ${highlights.length} reading highlights and group them into 3-6 thematic concept clusters. Return JSON only with format: [{"conceptName": string, "description": string, "relatedBooks": string[], "highlightIds": string[], "keyQuotes": string[]}]\n\nHighlights:\n${JSON.stringify(highlights.map(h => ({ id: h.id, book: h.bookTitle, text: h.rawText })))}`;

    const res = await fetch(config.endpoint || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return parsed.clusters || parsed;
  }

  private static async fetchLLMSynthesis(highlights: HighlightItem[], focusTopic: string | undefined, config: AIProviderConfig): Promise<ExecutiveSynthesis> {
    const prompt = `You are a world-class reading intelligence synthesizer. Synthesize these highlights into an executive brief. Return JSON only: {"title": string, "summary": string, "mentalModels": string[], "actionableTakeaways": string[]}\n\nHighlights:\n${JSON.stringify(highlights.map(h => ({ book: h.bookTitle, text: h.rawText })))}`;

    const res = await fetch(config.endpoint || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.modelName || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      ...parsed,
      sourceHighlightsCount: highlights.length,
    };
  }
}
