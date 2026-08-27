import type { RawImportBook, RawImportAnnotation, AnnotationColor, ContentLimitState } from "@hakim/domain";
import { normalizeTitle, normalizeAuthor, decodeHtmlEntities } from "@hakim/domain";

export class SessionExpiredError extends Error {
  constructor(message = "Amazon session expired. Please log in to read.amazon.com") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export class CaptchaDetectedError extends Error {
  constructor(message = "Amazon presented a CAPTCHA verification challenge.") {
    super(message);
    this.name = "CaptchaDetectedError";
  }
}

export interface AmazonBookListItem {
  asin: string;
  title: string;
  author: string;
}

export interface SyncCacheMap {
  [asin: string]: {
    annotationsCount: number;
    lastSyncedAt: string;
  };
}

export interface AmazonHighlightsPage {
  book: RawImportBook;
  nextToken?: string;
  nextPageStart?: string;
  terminal: boolean;
}

export class AmazonNotebookClient {
  private baseDomain: string;

  constructor(domain = "read.amazon.com") {
    this.baseDomain = domain;
  }

  public getBaseUrl(): string {
    return `https://${this.baseDomain}`;
  }

  public async checkSession(): Promise<{ loggedIn: boolean; error?: string }> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/notebook`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (res.redirected && (res.url.includes("signin") || res.url.includes("ap/signin"))) {
        return { loggedIn: false, error: "Session expired" };
      }

      const text = await res.text();
      if (text.includes("Enter the characters you see below") || text.includes("validateCaptcha")) {
        throw new CaptchaDetectedError();
      }

      if (
        text.includes("Your Highlights") ||
        text.includes("kp-notebook") ||
        text.includes("kp-notebook-library") ||
        res.status === 200
      ) {
        return { loggedIn: true };
      }

      return { loggedIn: false };
    } catch (err: unknown) {
      if (err instanceof CaptchaDetectedError) throw err;
      return { loggedIn: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }

  public async fetchLibraryIndex(): Promise<AmazonBookListItem[]> {
    const response = await fetch(`${this.getBaseUrl()}/notebook`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    });
    const html = await response.text();
    this.assertUsableAmazonResponse(html, response);
    return this.extractLibraryBookList(html);
  }

  public async fetchHighlightsPage(params: {
    asin: string;
    title: string;
    author: string;
    token?: string;
    nextPageStart?: string;
  }): Promise<AmazonHighlightsPage> {
    const url = new URL(`${this.getBaseUrl()}/notebook`);
    url.searchParams.set("asin", params.asin);
    url.searchParams.set("contentLimitState", "");
    if (params.token) url.searchParams.set("token", params.token);
    if (params.nextPageStart) url.searchParams.set("nextPageStart", params.nextPageStart);

    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: `${this.getBaseUrl()}/notebook`,
      },
    });
    const html = await response.text();
    this.assertUsableAmazonResponse(html, response);
    const book = this.parseNotebookHtml(html, params.asin, params.title, params.author);
    const tokenMatch = html.match(/id="kp-notebook-annotations-token"[^>]*value="([^"]+)"/i)
      ?? html.match(/name="token"[^>]*value="([^"]+)"/i)
      ?? html.match(/class="[^"]*kp-notebook-annotations-token[^"]*"[^>]*value="([^"]+)"/i);
    const nextStartMatch = html.match(/id="kp-notebook-annotations-next-page-start"[^>]*value="([^"]+)"/i)
      ?? html.match(/name="nextPageStart"[^>]*value="([^"]+)"/i)
      ?? html.match(/class="[^"]*kp-notebook-annotations-next-page-start[^"]*"[^>]*value="([^"]+)"/i);
    const nextToken = tokenMatch?.[1]?.trim();
    const nextPageStart = nextStartMatch?.[1]?.trim();
    const repeatedCursor = nextToken === params.token && nextPageStart === params.nextPageStart;
    return {
      book,
      nextToken,
      nextPageStart,
      terminal: repeatedCursor || (!nextToken && !nextPageStart),
    };
  }

  private assertUsableAmazonResponse(html: string, response: Response): void {
    if (html.includes("Enter the characters you see below") || html.includes("validateCaptcha")) {
      throw new CaptchaDetectedError();
    }
    if (response.redirected && (response.url.includes("signin") || response.url.includes("ap/signin"))) {
      throw new SessionExpiredError();
    }
    if (html.includes("ap/signin") || html.includes("Sign In")) throw new SessionExpiredError();
    if (!response.ok) throw new Error(`Amazon Kindle returned HTTP ${response.status}`);
  }

  /**
   * Scrapes ALL book ASINs, titles, and authors across the entire Kindle Cloud library sidebar.
   * Decodes all HTML entities and prevents truncation.
   */
  public extractLibraryBookList(html: string): AmazonBookListItem[] {
    const books: AmazonBookListItem[] = [];
    const seenAsins = new Set<string>();

    const itemBlocks = html.split(/(?=<div[^>]*class="[^"]*kp-notebook-library-each)/i).slice(1);

    for (const block of itemBlocks) {
      const asinMatch = block.match(/id="asin_([A-Z0-9_-]+)"/i) ||
        block.match(/asin="([A-Z0-9_-]+)"/i) ||
        block.match(/id="([A-Z0-9]{10})"/i) ||
        block.match(/name="asin"\s+value="([A-Z0-9_-]+)"/i);
      
      const asin = asinMatch && asinMatch[1] ? asinMatch[1].trim() : "";
      if (!asin || seenAsins.has(asin)) continue;

      // Extract Title
      const titleMatch = block.match(/<h2[^>]*class="[^"]*kp-notebook-searchable[^"]*"[^>]*>([\s\S]*?)<\/h2>/i) ||
        block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) ||
        block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      const rawTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : "";

      // Extract Author
      const authorMatch = block.match(/<p[^>]*class="[^"]*kp-notebook-searchable[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
        block.match(/<p[^>]*class="[^"]*kp-notebook-metadata[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
        block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      let rawAuthor = authorMatch && authorMatch[1] ? authorMatch[1].replace(/<[^>]*>/g, "").trim() : "";
      rawAuthor = rawAuthor.replace(/^By:\s*/i, "").trim();

      if (asin && rawTitle) {
        seenAsins.add(asin);
        books.push({
          asin,
          title: normalizeTitle(decodeHtmlEntities(rawTitle)),
          author: normalizeAuthor(decodeHtmlEntities(rawAuthor || "Unknown Author")),
        });
      }
    }

    return books;
  }

  /**
   * Parses the HTML content of a book's notebook page into normalized annotations.
   * Decodes all HTML entities like &laquo;, &raquo;, &quot;, &#39;, &hellip;.
   */
  public parseNotebookHtml(html: string, bookAsin?: string, defaultTitle?: string, defaultAuthor?: string): RawImportBook {
    if (html.includes("Enter the characters you see below") || html.includes("validateCaptcha")) {
      throw new CaptchaDetectedError();
    }

    if (html.includes("ap/signin") || html.includes("Sign In")) {
      throw new SessionExpiredError();
    }

    // 1. Isolate main annotations area
    const annotationsAreaMatch = html.match(/<div[^>]*id="kp-notebook-annotations"[^>]*>([\s\S]*)/i);
    const annotationsHtml = annotationsAreaMatch ? annotationsAreaMatch[1]! : html;

    // 2. Extract active book title
    const titleMatch = html.match(/<h3[^>]*class="[^"]*kcp-notebook-title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ||
      html.match(/<h2[^>]*class="[^"]*kp-notebook-selectable[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
    const rawTitle = titleMatch && titleMatch[1] ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : (defaultTitle || "Kindle Book");

    // 3. Extract active author
    const authorMatch = html.match(/<p[^>]*class="[^"]*kcp-notebook-author[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
      html.match(/<p[^>]*class="[^"]*kp-notebook-metadata[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    let rawAuthor = authorMatch && authorMatch[1] ? authorMatch[1].replace(/<[^>]*>/g, "").trim() : (defaultAuthor || "Unknown Author");
    rawAuthor = rawAuthor.replace(/^By:\s*/i, "").trim();

    // 4. Extract active ASIN
    const asinMatch = html.match(/name="asin"\s+value="([^"]+)"/i) ||
      html.match(/id="kp-notebook-annotations-[^"]*asin-([A-Z0-9]{10})/i);
    const asin = bookAsin || (asinMatch && asinMatch[1] ? asinMatch[1].trim() : "UNKNOWN_ASIN");

    const annotations: RawImportAnnotation[] = [];

    // 5. Extract highlight blocks
    const rowBlocks = annotationsHtml.split(/(?=<div[^>]*class="[^"]*kp-notebook-row-separator)/i).slice(1);

    for (const block of rowBlocks) {
      // Preserve decoded human-visible source text. Matching uses normalizedText separately.
      const textMatch = block.match(/<span[^>]*id="highlight"[^>]*>([\s\S]*?)<\/span>/i);
      const rawText = textMatch && textMatch[1]
        ? decodeHtmlEntities(textMatch[1].replace(/<[^>]*>/g, ""))
        : "";

      if (!rawText) continue;

      // Note Text
      const noteMatch = block.match(/<span[^>]*id="note"[^>]*>([\s\S]*?)<\/span>/i);
      const sourceNote = noteMatch && noteMatch[1]
        ? decodeHtmlEntities(noteMatch[1].replace(/<[^>]*>/g, ""))
        : undefined;

      // Color
      let color: AnnotationColor = "yellow";
      if (/kp-notebook-highlight-yellow/i.test(block)) color = "yellow";
      else if (/kp-notebook-highlight-blue/i.test(block)) color = "blue";
      else if (/kp-notebook-highlight-pink/i.test(block)) color = "pink";
      else if (/kp-notebook-highlight-orange/i.test(block)) color = "orange";

      // Location
      let locationStart: number | undefined;
      const locMatch = block.match(/location\s+(\d+)/i) ||
        block.match(/id="kp-annotation-location"[^>]*value="(\d+)"/i);
      if (locMatch && locMatch[1]) {
        locationStart = parseInt(locMatch[1], 10);
      }

      // Check clipping limit
      let contentLimitState: ContentLimitState = "normal";
      if (rawText.includes("clipping limit") || rawText.includes("limit reached")) {
        contentLimitState = "publisher_clipped";
      }

      annotations.push({
        type: "highlight",
        rawText,
        sourceNote,
        locationStart,
        locationEnd: locationStart,
        color,
        contentLimitState,
      });
    }

    return {
      sourceBookKey: `amzn:${asin}`,
      asin,
      sourceTitle: normalizeTitle(decodeHtmlEntities(rawTitle)),
      author: normalizeAuthor(decodeHtmlEntities(rawAuthor)),
      annotations,
    };
  }

  /**
   * Fetches ALL paginated highlights for a single book.
   */
  public async fetchAllHighlightsForBook(asin: string, title: string, author: string): Promise<RawImportBook> {
    const allAnnotations: RawImportAnnotation[] = [];
    const seenAnnotationKeys = new Set<string>();

    let token: string | undefined = undefined;
    let nextPageStart: string | undefined = undefined;
    let page = 1;
    const maxPages = 60; // Up to 1500+ highlights

    while (page <= maxPages) {
      const result = await this.fetchHighlightsPage({ asin, title, author, token, nextPageStart });
      const parsed = result.book;

      for (const a of parsed.annotations) {
        const key = `${a.locationStart || 0}:${a.rawText.substring(0, 60)}`;
        if (!seenAnnotationKeys.has(key)) {
          seenAnnotationKeys.add(key);
          allAnnotations.push(a);
        }
      }

      if (result.terminal) break;
      token = result.nextToken;
      nextPageStart = result.nextPageStart;
      page++;
      await new Promise((r) => setTimeout(r, 300));
    }

    return {
      sourceBookKey: `amzn:${asin}`,
      asin,
      sourceTitle: title,
      author,
      annotations: allAnnotations,
    };
  }

  /**
   * Fetches real highlights for ALL books across the user's entire Kindle library.
   * Supports intelligent caching to skip unchanged books on rapid re-syncs.
   */
  public async fetchAllLibrary(
    progressCallback?: (bookTitle: string, current: number, total: number) => void,
    cache?: SyncCacheMap,
    forceFullScan = false
  ): Promise<RawImportBook[]> {
    // 1. Fetch Landing Page
    const landingRes = await fetch(`${this.getBaseUrl()}/notebook`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const landingHtml = await landingRes.text();

    const bookList = this.extractLibraryBookList(landingHtml);
    const results: RawImportBook[] = [];

    if (bookList.length === 0) {
      const single = this.parseNotebookHtml(landingHtml);
      if (single.annotations.length > 0) {
        results.push(single);
      }
      return results;
    }

    // 2. Fetch all paginated highlights for each discovered book in the library
    for (let i = 0; i < bookList.length; i++) {
      const b = bookList[i]!;
      progressCallback?.(b.title, i + 1, bookList.length);

      // Check if book was recently synced and unchanged (only in background mode without forceFullScan)
      if (!forceFullScan && cache) {
        const cached = cache[b.asin];
        if (cached && cached.annotationsCount > 0) {
          const lastSyncTime = new Date(cached.lastSyncedAt).getTime();
          const ageMinutes = (Date.now() - lastSyncTime) / (1000 * 60);
          if (ageMinutes < 15) {
            continue;
          }
        }
      }

      try {
        const bookWithAllHighlights = await this.fetchAllHighlightsForBook(b.asin, b.title, b.author);
        if (bookWithAllHighlights.annotations.length > 0) {
          results.push(bookWithAllHighlights);
        }
      } catch (err) {
        console.warn(`Could not fetch highlights for "${b.title}":`, err);
      }
    }

    return results;
  }
}
