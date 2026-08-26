import type { BookItem, HighlightItem } from "../types.js";
import { ZipBuilder } from "./zip-builder.js";

export interface VaultFile {
  path: string;
  content: string;
}

export interface VaultExportResult {
  files: VaultFile[];
  booksCount: number;
  highlightsCount: number;
  conceptsCount: number;
  zipBuilder: ZipBuilder;
}

export class VaultExporter {
  /**
   * Generates a complete Obsidian-compatible Markdown Knowledge Base.
   */
  public static generateVault(books: BookItem[], highlights: HighlightItem[]): VaultExportResult {
    const files: VaultFile[] = [];
    const zip = new ZipBuilder();

    // 1. Generate Index / Dashboard Note
    const indexContent = VaultExporter.formatIndexNote(books, highlights);
    files.push({ path: "Index.md", content: indexContent });
    zip.addFile("Index.md", indexContent);

    // 2. Generate Book Notes under Books/
    for (const book of books) {
      const bookHighlights = highlights.filter((h) => h.bookId === book.id || h.bookTitle === book.title);
      const safeTitle = VaultExporter.sanitizeFileName(book.title);
      const bookContent = VaultExporter.formatBookNote(book, bookHighlights);
      const bookPath = `Books/${safeTitle}.md`;

      files.push({ path: bookPath, content: bookContent });
      zip.addFile(bookPath, bookContent);
    }

    // 3. Generate Concept Hub Notes under Concepts/
    const tagMap = new Map<string, HighlightItem[]>();
    for (const h of highlights) {
      for (const tag of h.tags || []) {
        const cleanTag = tag.trim();
        if (!cleanTag) continue;
        if (!tagMap.has(cleanTag)) tagMap.set(cleanTag, []);
        tagMap.get(cleanTag)!.push(h);
      }
    }

    let conceptsCount = 0;
    tagMap.forEach((hlList, tag) => {
      conceptsCount++;
      const safeTag = VaultExporter.sanitizeFileName(tag);
      const conceptContent = VaultExporter.formatConceptNote(tag, hlList);
      const conceptPath = `Concepts/${safeTag}.md`;

      files.push({ path: conceptPath, content: conceptContent });
      zip.addFile(conceptPath, conceptContent);
    });

    return {
      files,
      booksCount: books.length,
      highlightsCount: highlights.length,
      conceptsCount,
      zipBuilder: zip,
    };
  }

  /**
   * Formats a single book as an Obsidian markdown document with YAML frontmatter.
   */
  public static formatBookNote(book: BookItem, bookHighlights: HighlightItem[]): string {
    const lines: string[] = [];

    // YAML Frontmatter
    lines.push("---");
    lines.push(`title: ${JSON.stringify(book.title)}`);
    lines.push(`author: ${JSON.stringify(book.author)}`);
    if (book.asin) lines.push(`asin: ${JSON.stringify(book.asin)}`);
    lines.push(`status: ${book.status || 'reading'}`);
    lines.push(`highlights_count: ${bookHighlights.length}`);
    lines.push("tags:");
    lines.push("  - type/book");
    lines.push("  - reading-intelligence");
    lines.push("---");
    lines.push("");

    // Book Header
    lines.push(`# ${book.title}`);
    lines.push(`**Author:** [[${book.author}]]`);
    lines.push(`**Status:** \`${(book.status || 'reading').toUpperCase()}\``);
    lines.push(`**Total Highlights:** ${bookHighlights.length}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Table of Contents / Highlights Section
    lines.push("## 📖 Highlights & Annotations");
    lines.push("");

    if (bookHighlights.length === 0) {
      lines.push("*No highlights captured for this book yet.*");
      return lines.join("\n");
    }

    // Sort by location
    const sorted = [...bookHighlights].sort((a, b) => (a.location || 0) - (b.location || 0));

    for (let i = 0; i < sorted.length; i++) {
      const h = sorted[i]!;
      const calloutType = h.color === "pink" ? "danger" : h.color === "blue" ? "info" : h.color === "orange" ? "warning" : "quote";

      // Chapter header if changed
      if (h.chapter) {
        lines.push(`### ${h.chapter}`);
        lines.push("");
      }

      // Obsidian Callout
      lines.push(`> [!${calloutType}] Highlight #${i + 1}`);
      lines.push(`> ${h.rawText}`);
      
      const meta: string[] = [];
      if (h.location) meta.push(`Loc ${h.location}`);
      if (h.color) meta.push(`Color: ${h.color}`);
      if (h.importance) meta.push(`Importance: ${h.importance}`);
      if (meta.length > 0) {
        lines.push(`>`);
        lines.push(`> — *${meta.join(" • ")}*`);
      }

      // Note & Interpretation
      if (h.sourceNote) {
        lines.push("");
        lines.push(`> [!note] Personal Note`);
        lines.push(`> ${h.sourceNote}`);
      }

      if (h.interpretation) {
        lines.push("");
        lines.push(`**💡 Reflection:** ${h.interpretation}`);
      }

      // Concept Wikilinks
      if (h.tags && h.tags.length > 0) {
        lines.push("");
        lines.push(`**Concepts:** ${h.tags.map((t) => `[[Concepts/${t}|#${t}]]`).join(" ")}`);
      }

      lines.push(`^hl-${h.id}`);
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Formats a Concept hub note connecting multi-book highlights.
   */
  public static formatConceptNote(tag: string, highlights: HighlightItem[]): string {
    const lines: string[] = [];
    const relatedBooks = Array.from(new Set(highlights.map((h) => h.bookTitle)));

    lines.push("---");
    lines.push(`concept: ${JSON.stringify(tag)}`);
    lines.push(`highlights_count: ${highlights.length}`);
    lines.push("tags:");
    lines.push("  - type/concept");
    lines.push("---");
    lines.push("");

    lines.push(`# Concept: #${tag}`);
    lines.push(`Cross-cutting reading intelligence concept spanning **${relatedBooks.length} books**.`);
    lines.push("");
    lines.push("## 📚 Linked Books");
    for (const b of relatedBooks) {
      lines.push(`- [[Books/${b}|${b}]]`);
    }
    lines.push("");
    lines.push("## 💬 Key Highlights");
    for (const h of highlights) {
      lines.push(`> "${h.rawText}"`);
      lines.push(`— [[Books/${h.bookTitle}|${h.bookTitle}]] (Loc ${h.location || 'N/A'})`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Formats the root Index dashboard for Obsidian.
   */
  private static formatIndexNote(books: BookItem[], highlights: HighlightItem[]): string {
    const lines: string[] = [];

    lines.push("---");
    lines.push("title: \"Hakim Reading OS Dashboard\"");
    lines.push("tags:");
    lines.push("  - dashboard");
    lines.push("---");
    lines.push("");

    lines.push("# 🏛️ Hakim Personal Reading Intelligence Vault");
    lines.push("");
    lines.push(`Welcome to your local-first reading vault. Generated on **${new Date().toLocaleDateString()}**.`);
    lines.push("");
    lines.push("### 📊 Library Statistics");
    lines.push(`- **Total Books:** ${books.length}`);
    lines.push(`- **Total Highlights:** ${highlights.length}`);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## 📚 Books Library");
    for (const b of books) {
      const count = highlights.filter((h) => h.bookId === b.id || h.bookTitle === b.title).length;
      lines.push(`- [[Books/${b.title}|${b.title}]] by *${b.author}* (${count} notes)`);
    }
    lines.push("");
    lines.push("---");
    lines.push("*Exported automatically from [Hakim](https://github.com/ws0x/hakim).*");

    return lines.join("\n");
  }

  private static sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, "_").trim();
  }
}
