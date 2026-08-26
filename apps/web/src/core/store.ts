import type { BookItem, HighlightItem, ActiveFilters, GraphData, AnnotationColor } from "./types.js";
import { DEMO_BOOKS, DEMO_HIGHLIGHTS } from "./adapters/demo-data.js";
import { GraphBuilder } from "./graph-builder.js";

export type StateListener = (state: ReadingState) => void;

export interface ReadingState {
  books: BookItem[];
  highlights: HighlightItem[];
  filters: ActiveFilters;
  graphData: GraphData;
  activeView: "graph" | "cards" | "flashcards";
  selectedHighlight: HighlightItem | null;
  isLoading: boolean;
  activeDataset: "demo" | "custom_file" | "notion";
}

export class ReadingStateStore {
  private static instance: ReadingStateStore;
  private listeners: Set<StateListener> = new Set();

  private state: ReadingState = {
    books: DEMO_BOOKS,
    highlights: DEMO_HIGHLIGHTS,
    filters: {
      searchQuery: "",
      selectedBookId: null,
      selectedColors: new Set<AnnotationColor>(["yellow", "blue", "pink", "orange"]),
      selectedImportance: new Set<string>(["Essential", "High", "Medium", "Low"]),
      selectedTopics: new Set<string>(),
    },
    graphData: { nodes: [], links: [] },
    activeView: "graph",
    selectedHighlight: null,
    isLoading: false,
    activeDataset: "demo",
  };

  private constructor() {
    this.recomputeGraph();
  }

  public static getInstance(): ReadingStateStore {
    if (!ReadingStateStore.instance) {
      ReadingStateStore.instance = new ReadingStateStore();
    }
    return ReadingStateStore.instance;
  }

  public getState(): ReadingState {
    return this.state;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public setView(view: "graph" | "cards" | "flashcards"): void {
    this.state.activeView = view;
    this.notify();
  }

  public selectHighlight(highlight: HighlightItem | null): void {
    this.state.selectedHighlight = highlight;
    this.notify();
  }

  public setSearchQuery(query: string): void {
    this.state.filters.searchQuery = query.toLowerCase().trim();
    this.recomputeGraph();
    this.notify();
  }

  public selectBook(bookId: string | null): void {
    this.state.filters.selectedBookId = bookId;
    this.recomputeGraph();
    this.notify();
  }

  public toggleColorFilter(color: AnnotationColor): void {
    if (this.state.filters.selectedColors.has(color)) {
      this.state.filters.selectedColors.delete(color);
    } else {
      this.state.filters.selectedColors.add(color);
    }
    this.recomputeGraph();
    this.notify();
  }

  public loadCustomData(books: BookItem[], highlights: HighlightItem[], source: "custom_file" | "notion"): void {
    this.state.books = books;
    this.state.highlights = highlights;
    this.state.activeDataset = source;
    this.state.filters.selectedBookId = null;
    this.state.filters.searchQuery = "";
    this.recomputeGraph();
    this.notify();
  }

  public updateBookStatus(bookId: string, status: "reading" | "completed" | "want_to_read"): void {
    const book = this.state.books.find((b) => b.id === bookId);
    if (book) {
      book.status = status;
      this.notify();
    }
  }

  public updateHighlightInterpretation(highlightId: string, interpretation: string): void {
    const hl = this.state.highlights.find((h) => h.id === highlightId);
    if (hl) {
      hl.interpretation = interpretation;
      this.notify();
    }
  }

  public loadDemoData(): void {
    this.state.books = DEMO_BOOKS;
    this.state.highlights = DEMO_HIGHLIGHTS;
    this.state.activeDataset = "demo";
    this.state.filters.selectedBookId = null;
    this.state.filters.searchQuery = "";
    this.recomputeGraph();
    this.notify();
  }

  public getFilteredHighlights(): HighlightItem[] {
    const { searchQuery, selectedBookId, selectedColors, selectedImportance } = this.state.filters;

    return this.state.highlights.filter((h) => {
      // Book filter
      if (selectedBookId && h.bookId !== selectedBookId) {
        return false;
      }

      // Color filter
      if (selectedColors.size > 0 && !selectedColors.has(h.color)) {
        return false;
      }

      // Importance filter
      if (h.importance && selectedImportance.size > 0 && !selectedImportance.has(h.importance)) {
        return false;
      }

      // Search query
      if (searchQuery) {
        const textMatch = h.rawText.toLowerCase().includes(searchQuery);
        const bookMatch = h.bookTitle.toLowerCase().includes(searchQuery);
        const noteMatch = h.sourceNote?.toLowerCase().includes(searchQuery);
        const tagMatch = h.tags?.some((t) => t.toLowerCase().includes(searchQuery));
        if (!textMatch && !bookMatch && !noteMatch && !tagMatch) {
          return false;
        }
      }

      return true;
    });
  }

  private recomputeGraph(): void {
    const filtered = this.getFilteredHighlights();
    const filteredIds = new Set(filtered.map((h) => h.id));
    this.state.graphData = GraphBuilder.buildGraph(this.state.books, this.state.highlights, filteredIds);
  }
}
