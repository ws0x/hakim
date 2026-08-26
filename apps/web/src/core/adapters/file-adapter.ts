import type { BookItem, HighlightItem, AnnotationColor } from "../types.js";
import { normalizeTitle, normalizeAuthor, normalizeText } from "@hakim/domain";

export class FileImportAdapter {
  /**
   * Parses raw `My Clippings.txt` text uploaded directly in the browser.
   */
  public static parseMyClippings(rawContent: string): { books: BookItem[]; highlights: HighlightItem[] } {
    const rawEntries = rawContent.split(/==========/);
    const booksMap = new Map<string, BookItem>();
    const highlights: HighlightItem[] = [];

    for (let i = 0; i < rawEntries.length; i++) {
      const entry = rawEntries[i]?.trim();
      if (!entry) continue;

      const lines = entry.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 3) continue;

      // Line 1: Title and Author -> "Title (Author Name)"
      const headerLine = lines[0]!;
      const authorMatch = headerLine.match(/\(([^)]+)\)$/);
      let rawTitle = headerLine;
      let rawAuthor = "Unknown Author";

      if (authorMatch && authorMatch[1]) {
        rawAuthor = authorMatch[1].trim();
        rawTitle = headerLine.substring(0, headerLine.lastIndexOf("(")).trim();
      }

      const title = normalizeTitle(rawTitle);
      const author = normalizeAuthor(rawAuthor);
      const bookKey = `${title}:::${author}`;

      let book = booksMap.get(bookKey);
      if (!book) {
        book = {
          id: `book-${booksMap.size + 1}`,
          title,
          author,
          highlightsCount: 0,
          status: "reading",
        };
        booksMap.set(bookKey, book);
      }

      // Line 2: Metadata (Location, Color, Date)
      const metaLine = lines[1]!;
      let location: number | undefined;
      const locMatch = metaLine.match(/Location\s+(\d+)/i) || metaLine.match(/page\s+(\d+)/i);
      if (locMatch && locMatch[1]) {
        location = parseInt(locMatch[1], 10);
      }

      let color: AnnotationColor = "yellow";
      if (/yellow/i.test(metaLine)) color = "yellow";
      else if (/blue/i.test(metaLine)) color = "blue";
      else if (/pink/i.test(metaLine)) color = "pink";
      else if (/orange/i.test(metaLine)) color = "orange";

      // Line 3+: Highlight body
      const rawText = lines.slice(2).join(" ");
      if (!rawText) continue;

      book.highlightsCount++;

      highlights.push({
        id: `hl-import-${highlights.length + 1}`,
        bookId: book.id,
        bookTitle: book.title,
        rawText: normalizeText(rawText),
        location,
        color,
        importance: "Medium",
        status: "Inbox",
      });
    }

    return {
      books: Array.from(booksMap.values()),
      highlights,
    };
  }

  /**
   * Parses exported Hakim JSON snapshot format.
   */
  public static parseJsonSnapshot(jsonString: string): { books: BookItem[]; highlights: HighlightItem[] } {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.books) && Array.isArray(data.highlights)) {
        return {
          books: data.books,
          highlights: data.highlights,
        };
      }
      throw new Error("Invalid Hakim JSON snapshot structure.");
    } catch (err: unknown) {
      throw new Error(`Failed to parse JSON file: ${err instanceof Error ? err.message : "Invalid JSON"}`);
    }
  }
}
