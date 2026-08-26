import type { Book, Annotation, AnnotationUserState } from "@hakim/domain";

export interface BookExportPayload {
  book: Book;
  annotations: Array<{
    annotation: Annotation;
    userState?: AnnotationUserState;
  }>;
}

export function formatBookMarkdown(payload: BookExportPayload): string {
  const { book, annotations } = payload;

  const lines: string[] = [];

  // 1. YAML Frontmatter
  lines.push("---");
  lines.push(`title: ${JSON.stringify(book.displayTitle)}`);
  lines.push(`author: ${JSON.stringify(book.author)}`);
  if (book.asin) lines.push(`asin: ${JSON.stringify(book.asin)}`);
  lines.push(`source_state: ${book.sourceState}`);
  if (book.lastAnnotatedAt) lines.push(`last_annotated: ${JSON.stringify(book.lastAnnotatedAt)}`);
  lines.push("tags:");
  lines.push("  - books");
  lines.push("  - reading-intelligence");
  lines.push("---");
  lines.push("");

  // 2. Header
  lines.push(`# ${book.displayTitle}`);
  lines.push(`*Author: ${book.author}*`);
  if (book.sourceUrl) lines.push(`[Open in Kindle Notebook](${book.sourceUrl})`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // 3. Highlights Section
  lines.push("## Highlights & Notes");
  lines.push("");

  if (annotations.length === 0) {
    lines.push("*No annotations found.*");
    return lines.join("\n");
  }

  // Sort by location
  const sorted = [...annotations].sort((a, b) => {
    const locA = a.annotation.locationStart ?? 0;
    const locB = b.annotation.locationStart ?? 0;
    return locA - locB;
  });

  for (const item of sorted) {
    const annot = item.annotation;
    const userState = item.userState;

    if (annot.chapter) {
      lines.push(`### ${annot.chapter}`);
      lines.push("");
    }

    // Quote
    lines.push(`> ${annot.rawText}`);
    
    // Metadata footer
    const metaParts: string[] = [];
    if (annot.locationStart !== undefined) metaParts.push(`Location ${annot.locationStart}`);
    if (annot.page !== undefined) metaParts.push(`Page ${annot.page}`);
    if (annot.color) metaParts.push(`Color: ${annot.color}`);
    if (annot.annotatedAt) metaParts.push(`Date: ${new Date(annot.annotatedAt).toLocaleDateString()}`);

    if (metaParts.length > 0) {
      lines.push(`— *${metaParts.join(" | ")}*`);
    }

    // Kindle Note if present
    if (annot.sourceNote) {
      lines.push("");
      lines.push(`> **Kindle Note:** ${annot.sourceNote}`);
    }

    // User Interpretation & Reflections (from Notion/Hakim user state)
    if (userState?.personalInterpretation) {
      lines.push("");
      lines.push(`**My Understanding:** ${userState.personalInterpretation}`);
    }

    if (userState?.importance && userState.importance !== "medium") {
      lines.push(`**Importance:** \`${userState.importance.toUpperCase()}\``);
    }

    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
