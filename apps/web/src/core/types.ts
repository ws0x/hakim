export type AnnotationColor = "yellow" | "blue" | "pink" | "orange" | "default";

export interface BookItem {
  id: string;
  asin?: string;
  title: string;
  author: string;
  coverUrl?: string;
  lastAnnotatedAt?: string;
  highlightsCount: number;
  tags?: string[];
  status?: "reading" | "completed" | "want_to_read";
}

export interface HighlightItem {
  id: string;
  bookId: string;
  bookTitle: string;
  rawText: string;
  sourceNote?: string;
  location?: number;
  page?: number;
  chapter?: string;
  color: AnnotationColor;
  importance?: "Low" | "Medium" | "High" | "Essential";
  status?: "Inbox" | "Processed" | "Discarded";
  interpretation?: string;
  tags?: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: "book" | "highlight" | "topic" | "author";
  group: number;
  size: number;
  color: string;
  bookId?: string;
  bookTitle?: string;
  rawText?: string;
  note?: string;
  location?: number;
  importance?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  type: "contains" | "references" | "authored_by" | "shares_topic";
  strength: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ActiveFilters {
  searchQuery: string;
  selectedBookId: string | null;
  selectedColors: Set<AnnotationColor>;
  selectedImportance: Set<string>;
  selectedTopics: Set<string>;
}
