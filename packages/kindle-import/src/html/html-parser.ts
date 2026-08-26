import type { ImportEnvelope, RawImportBook, RawImportAnnotation, AnnotationColor } from "@hakim/domain";
import { normalizeText, normalizeTitle, normalizeAuthor } from "@hakim/domain";

export function parseKindleHtmlExport(htmlContent: string): ImportEnvelope {
  // Extract book title
  const titleMatch = htmlContent.match(/<div class="bookTitle">\s*([\s\S]*?)\s*<\/div>/i);
  const title = titleMatch && titleMatch[1] ? normalizeTitle(titleMatch[1].replace(/<[^>]*>/g, "")) : "Untitled Notebook";

  // Extract author
  const authorMatch = htmlContent.match(/<div class="authors">\s*([\s\S]*?)\s*<\/div>/i);
  const author = authorMatch && authorMatch[1] ? normalizeAuthor(authorMatch[1].replace(/<[^>]*>/g, "")) : "Unknown Author";

  const annotations: RawImportAnnotation[] = [];

  // Match each section or highlight item
  const itemRegex = /<div class="noteHeading">\s*([\s\S]*?)\s*<\/div>\s*<div class="noteText">\s*([\s\S]*?)\s*<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(htmlContent)) !== null) {
    const heading = match[1]?.replace(/<[^>]*>/g, "").trim() || "";
    const noteText = match[2]?.replace(/<[^>]*>/g, "").trim() || "";

    if (!noteText) continue;

    // Color extraction
    let color: AnnotationColor = "yellow";
    if (/yellow|أصفر/i.test(heading)) color = "yellow";
    else if (/blue|أزرق/i.test(heading)) color = "blue";
    else if (/pink|وردي/i.test(heading)) color = "pink";
    else if (/orange|برتقالي/i.test(heading)) color = "orange";

    // Location extraction
    let locationStart: number | undefined;
    const locMatch = heading.match(/location\s+(\d+)/i);
    if (locMatch && locMatch[1]) {
      locationStart = parseInt(locMatch[1], 10);
    }

    // Page extraction
    let page: number | undefined;
    const pageMatch = heading.match(/page\s+(\d+)/i);
    if (pageMatch && pageMatch[1]) {
      page = parseInt(pageMatch[1], 10);
    }

    annotations.push({
      type: "highlight",
      rawText: normalizeText(noteText),
      locationStart,
      locationEnd: locationStart,
      page,
      color,
      contentLimitState: "normal",
    });
  }

  const book: RawImportBook = {
    sourceBookKey: `html:${title.toLowerCase()}:${author.toLowerCase()}`,
    sourceTitle: title,
    author,
    annotations,
  };

  return {
    version: "1.0",
    sourceKind: "kindle_html",
    importedAt: new Date().toISOString(),
    books: [book],
  };
}
