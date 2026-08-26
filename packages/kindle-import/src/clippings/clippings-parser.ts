import type { ImportEnvelope, RawImportBook, RawImportAnnotation, AnnotationType } from "@hakim/domain";
import { normalizeText, normalizeTitle, normalizeAuthor } from "@hakim/domain";

interface ParsedClippingHeader {
  title: string;
  author: string;
  type: AnnotationType;
  locationStart?: number;
  locationEnd?: number;
  page?: number;
  annotatedAt?: string;
}

export function parseClippingHeader(metaLine: string, titleLine: string): ParsedClippingHeader {
  // 1. Extract Title and Author
  let title = titleLine.trim();
  let author = "Unknown Author";

  const lastParenMatch = title.match(/^(.*)\s+\(([^()]+)\)$/);
  if (lastParenMatch && lastParenMatch[1] && lastParenMatch[2]) {
    title = lastParenMatch[1].trim();
    author = lastParenMatch[2].trim();
  }

  // 2. Extract Type
  let type: AnnotationType = "highlight";
  const lowerMeta = metaLine.toLowerCase();
  if (lowerMeta.includes("note") || lowerMeta.includes("ملاحظة") || lowerMeta.includes("notiz")) {
    type = "note";
  } else if (lowerMeta.includes("bookmark") || lowerMeta.includes("إشارة") || lowerMeta.includes("lesezeichen")) {
    type = "bookmark";
  }

  // 3. Extract Location
  let locationStart: number | undefined;
  let locationEnd: number | undefined;
  const locMatch = metaLine.match(/(?:location|الموقع|position|emplacement)\s+(\d+)(?:-(\d+))?/i);
  if (locMatch && locMatch[1]) {
    locationStart = parseInt(locMatch[1], 10);
    locationEnd = locMatch[2] ? parseInt(locMatch[2], 10) : locationStart;
  }

  // 4. Extract Page
  let page: number | undefined;
  const pageMatch = metaLine.match(/(?:page|صفحة|seite)\s+(\d+)/i);
  if (pageMatch && pageMatch[1]) {
    page = parseInt(pageMatch[1], 10);
  }

  // 5. Extract Date (try standard parsing)
  let annotatedAt: string | undefined;
  const dateMatch = metaLine.match(/(?:added on|تمت الإضافة في|hinzugefügt am)\s+(.*)$/i);
  if (dateMatch && dateMatch[1]) {
    const parsedDate = Date.parse(dateMatch[1].trim());
    if (!isNaN(parsedDate)) {
      annotatedAt = new Date(parsedDate).toISOString();
    }
  }

  return {
    title: normalizeTitle(title),
    author: normalizeAuthor(author),
    type,
    locationStart,
    locationEnd,
    page,
    annotatedAt,
  };
}

export function parseMyClippings(rawContent: string): ImportEnvelope {
  const entries = rawContent
    .split(/\r?\n={5,}\r?\n?/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  const booksMap = new Map<string, RawImportBook>();

  for (const entry of entries) {
    const lines = entry.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const titleLine = lines[0] || "";
    const metaLine = lines[1] || "";
    const textLines = lines.slice(2).join("\n").trim();

    const header = parseClippingHeader(metaLine, titleLine);
    if (!header.title) continue;

    const bookKey = `clippings:${normalizeTitle(header.title).toLowerCase()}:${normalizeAuthor(header.author).toLowerCase()}`;

    let book = booksMap.get(bookKey);
    if (!book) {
      book = {
        sourceBookKey: bookKey,
        sourceTitle: header.title,
        author: header.author,
        annotations: [],
      };
      booksMap.set(bookKey, book);
    }

    const annotation: RawImportAnnotation = {
      type: header.type,
      rawText: normalizeText(textLines),
      locationStart: header.locationStart,
      locationEnd: header.locationEnd,
      page: header.page,
      annotatedAt: header.annotatedAt,
      color: "yellow",
      contentLimitState: "normal",
    };

    // If it's a standalone note on an existing highlight location, associate or append
    if (header.type === "note") {
      const matchingHighlight = book.annotations.find(
        (a) =>
          a.type === "highlight" &&
          a.locationStart !== undefined &&
          header.locationStart !== undefined &&
          header.locationStart >= a.locationStart &&
          header.locationStart <= (a.locationEnd || a.locationStart)
      );
      if (matchingHighlight && !matchingHighlight.sourceNote) {
        matchingHighlight.sourceNote = annotation.rawText;
        continue;
      }
    }

    book.annotations.push(annotation);
  }

  return {
    version: "1.0",
    sourceKind: "my_clippings",
    importedAt: new Date().toISOString(),
    books: Array.from(booksMap.values()),
  };
}
