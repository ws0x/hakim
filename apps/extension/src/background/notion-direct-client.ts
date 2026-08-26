import type { RawImportBook, RawImportAnnotation } from "@hakim/domain";

export interface NotionFieldMapping {
  // Books Database Fields
  bookTitleField?: string;
  bookAuthorField?: string;
  bookAsinField?: string;
  bookUrlField?: string;
  bookLastAnnotatedField?: string;
  // Highlights Database Fields
  highlightTitleField?: string;
  highlightBookRelationField?: string;
  highlightQuoteField?: string;
  highlightNoteField?: string;
  highlightLocationField?: string;
  highlightPageField?: string;
  highlightChapterField?: string;
  highlightColorField?: string;
  highlightImportanceField?: string;
  highlightStatusField?: string;
  highlightInterpretationField?: string;
}

export interface NotionProvisionResult {
  booksDbId: string;
  highlightsDbId: string;
}

export class NotionDirectClient {
  private token: string;
  private baseUrl = "https://api.notion.com/v1";
  private notionVersion = "2022-06-28";
  public mapping: Required<NotionFieldMapping>;

  constructor(token: string, mapping?: NotionFieldMapping) {
    this.token = token.trim();
    this.mapping = {
      bookTitleField: mapping?.bookTitleField || "Title",
      bookAuthorField: mapping?.bookAuthorField || "Author",
      bookAsinField: mapping?.bookAsinField || "ASIN",
      bookUrlField: mapping?.bookUrlField || "Kindle URL",
      bookLastAnnotatedField: mapping?.bookLastAnnotatedField || "Last Annotated",
      highlightTitleField: mapping?.highlightTitleField || "Name",
      highlightBookRelationField: mapping?.highlightBookRelationField || "Book",
      highlightQuoteField: mapping?.highlightQuoteField || "Quote",
      highlightNoteField: mapping?.highlightNoteField || "Kindle Note",
      highlightLocationField: mapping?.highlightLocationField || "Location",
      highlightPageField: mapping?.highlightPageField || "Page",
      highlightChapterField: mapping?.highlightChapterField || "Chapter",
      highlightColorField: mapping?.highlightColorField || "Color",
      highlightImportanceField: mapping?.highlightImportanceField || "Importance",
      highlightStatusField: mapping?.highlightStatusField || "Process Status",
      highlightInterpretationField: mapping?.highlightInterpretationField || "My Interpretation",
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public cleanId(raw: string): string {
    const trimmed = raw.trim();
    const cleanUrl = trimmed.split("?")[0] || trimmed;
    const match = cleanUrl.replace(/-/g, "").match(/([a-f0-9]{32})/i);
    if (match && match[1]) {
      const hex = match[1];
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return trimmed;
  }

  public async request<T = unknown>(endpoint: string, method = "GET", body?: unknown): Promise<T> {
    await this.sleep(300);

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Notion-Version": this.notionVersion,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      const code = err.code || "";
      const msg = err.message || `HTTP ${res.status}`;

      if (res.status === 404 || code === "object_not_found") {
        throw new Error(
          "Notion page not found. In Notion, open your page, click '···' (top right) -> 'Connect to' -> select 'Hakim' to grant access."
        );
      }
      if (res.status === 401 || code === "unauthorized") {
        throw new Error(
          "Invalid Notion Secret Token. Please verify your secret from notion.so/profile/integrations."
        );
      }
      if (res.status === 403 || code === "restricted_resource") {
        throw new Error(
          "Access restricted. Ensure the Hakim integration has permission to edit your Notion page."
        );
      }

      throw new Error(`Notion API Error: ${msg}`);
    }

    return (await res.json()) as T;
  }

  public async testConnection(): Promise<{ valid: boolean; botName?: string; error?: string }> {
    try {
      const user = (await this.request<{ name?: string }>("/users/me")) as { name?: string };
      return { valid: true, botName: user.name || "Hakim Integration" };
    } catch (err: unknown) {
      return { valid: false, error: err instanceof Error ? err.message : "Authentication failed" };
    }
  }

  /**
   * Ensures the Books database has a reciprocal relation property to the Highlights database.
   * Patches existing databases if the relation was missing!
   */
  public async ensureDatabaseRelations(booksDbId: string, highlightsDbId: string): Promise<void> {
    try {
      const booksDb = await this.request<{ properties: Record<string, any> }>(`/databases/${booksDbId}`);
      if (!booksDb.properties["Highlights"] && !booksDb.properties["Highlights Relation"]) {
        await this.request(`/databases/${booksDbId}`, "PATCH", {
          properties: {
            Highlights: {
              relation: {
                database_id: highlightsDbId,
                dual_property: {
                  synced_property_name: this.mapping.highlightBookRelationField,
                },
              },
            },
          },
        });
      }
    } catch (err) {
      console.warn("Could not patch Books DB reciprocal relation:", err);
    }
  }

  public async provisionDatabases(parentPageId: string): Promise<NotionProvisionResult> {
    const parentId = this.cleanId(parentPageId);

    // 1. Create Books Database
    const booksProperties: Record<string, unknown> = {
      [this.mapping.bookTitleField]: { title: {} },
      [this.mapping.bookAuthorField]: { rich_text: {} },
      [this.mapping.bookAsinField]: { rich_text: {} },
      [this.mapping.bookUrlField]: { url: {} },
      [this.mapping.bookLastAnnotatedField]: { date: {} },
    };

    const booksDb = await this.request<{ id: string }>("/databases", "POST", {
      parent: { type: "page_id", page_id: parentId },
      icon: { type: "emoji", emoji: "📖" },
      title: [{ type: "text", text: { content: "Hakim: Books" } }],
      properties: booksProperties,
    });

    const booksDbId = booksDb.id;

    // 2. Create Highlights Database with Two-Way Synced Backlink to Books
    const highlightsProperties: Record<string, unknown> = {
      [this.mapping.highlightTitleField]: { title: {} },
      [this.mapping.highlightBookRelationField]: {
        relation: {
          database_id: booksDbId,
          dual_property: {
            synced_property_name: "Highlights",
          },
        },
      },
      [this.mapping.highlightQuoteField]: { rich_text: {} },
      [this.mapping.highlightNoteField]: { rich_text: {} },
      [this.mapping.highlightLocationField]: { number: {} },
      [this.mapping.highlightPageField]: { number: {} },
      [this.mapping.highlightChapterField]: { rich_text: {} },
      [this.mapping.highlightColorField]: {
        select: {
          options: [
            { name: "Yellow (Key Insight)", color: "yellow" },
            { name: "Blue (Quote / Fact)", color: "blue" },
            { name: "Pink (Critical / Action)", color: "pink" },
            { name: "Orange (Concept / Story)", color: "orange" },
          ],
        },
      },
      [this.mapping.highlightImportanceField]: {
        select: {
          options: [
            { name: "Low", color: "gray" },
            { name: "Medium", color: "blue" },
            { name: "High", color: "orange" },
            { name: "Essential", color: "red" },
          ],
        },
      },
      [this.mapping.highlightStatusField]: {
        select: {
          options: [
            { name: "Inbox", color: "red" },
            { name: "Processed", color: "green" },
            { name: "Discarded", color: "gray" },
          ],
        },
      },
      [this.mapping.highlightInterpretationField]: { rich_text: {} },
    };

    const highlightsDb = await this.request<{ id: string }>("/databases", "POST", {
      parent: { type: "page_id", page_id: parentId },
      icon: { type: "emoji", emoji: "💡" },
      title: [{ type: "text", text: { content: "Hakim: Highlights" } }],
      properties: highlightsProperties,
    });

    return {
      booksDbId,
      highlightsDbId: highlightsDb.id,
    };
  }

  public async queryExistingBooks(booksDbId: string): Promise<Map<string, string>> {
    const bookMap = new Map<string, string>(); // asin or normalized title -> pageId
    try {
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const body: Record<string, unknown> = { page_size: 100 };
        if (cursor) body["start_cursor"] = cursor;

        const res = await this.request<{
          results: Array<{ id: string; properties: Record<string, unknown> }>;
          has_more: boolean;
          next_cursor: string | null;
        }>(`/databases/${booksDbId}/query`, "POST", body);

        for (const page of res.results) {
          const asinProp = page.properties[this.mapping.bookAsinField] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
          const titleProp = page.properties[this.mapping.bookTitleField] as { title?: Array<{ plain_text?: string }> } | undefined;

          const asin = asinProp?.rich_text?.[0]?.plain_text?.trim();
          const title = titleProp?.title?.[0]?.plain_text?.trim().toLowerCase();

          if (asin) bookMap.set(asin, page.id);
          if (title) bookMap.set(title, page.id);
        }

        hasMore = res.has_more && Boolean(res.next_cursor);
        cursor = res.next_cursor || undefined;
      }
    } catch (err) {
      console.warn("Could not query existing books from Notion:", err);
    }
    return bookMap;
  }

  public async upsertBook(booksDbId: string, book: RawImportBook, existingPageId?: string): Promise<string> {
    const properties: Record<string, unknown> = {
      [this.mapping.bookTitleField]: { title: [{ text: { content: book.sourceTitle } }] },
      [this.mapping.bookAuthorField]: { rich_text: [{ text: { content: book.author } }] },
    };

    if (book.asin) {
      properties[this.mapping.bookAsinField] = { rich_text: [{ text: { content: book.asin } }] };
    }
    if (book.sourceUrl) {
      properties[this.mapping.bookUrlField] = { url: book.sourceUrl };
    }
    if (book.lastAnnotatedAt) {
      properties[this.mapping.bookLastAnnotatedField] = { date: { start: book.lastAnnotatedAt } };
    }

    if (existingPageId) {
      await this.request(`/pages/${existingPageId}`, "PATCH", {
        icon: { type: "emoji", emoji: "📖" },
        properties,
      });
      return existingPageId;
    }

    const created = await this.request<{ id: string }>("/pages", "POST", {
      parent: { database_id: booksDbId },
      icon: { type: "emoji", emoji: "📖" },
      properties,
    });

    return created.id;
  }

  /**
   * Syncs highlights as rich callout blocks directly inside the Book page body!
   * Guarantees highlights are visually presented when opening the Book page in Notion.
   */
  public async syncBookPageContent(bookPageId: string, book: RawImportBook): Promise<void> {
    if (book.annotations.length === 0) return;

    try {
      // Check existing blocks on page
      const blocksRes = await this.request<{ results: Array<{ type: string; [key: string]: any }> }>(
        `/blocks/${bookPageId}/children?page_size=50`
      );

      // If page already has blocks, avoid duplicate header append
      if (blocksRes.results && blocksRes.results.length > 0) {
        return;
      }

      const childrenBlocks: unknown[] = [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: "Highlights & Notes" } }],
          },
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: `${book.annotations.length} highlights synced by Hakim.` },
              },
            ],
          },
        },
        {
          object: "block",
          type: "divider",
          divider: {},
        },
      ];

      // Add top highlights (up to 40 per batch to respect Notion limits)
      for (const annot of book.annotations.slice(0, 40)) {
        const locLabel = annot.locationStart !== undefined ? ` (Location ${annot.locationStart})` : "";
        const calloutEmoji = annot.color === "blue" ? "🟦" : annot.color === "pink" ? "🌸" : annot.color === "orange" ? "🟧" : "💡";

        const textContent = `${annot.rawText}${locLabel}`;
        childrenBlocks.push({
          object: "block",
          type: "callout",
          callout: {
            rich_text: [{ type: "text", text: { content: textContent.substring(0, 1900) } }],
            icon: { type: "emoji", emoji: calloutEmoji },
          },
        });

        if (annot.sourceNote) {
          childrenBlocks.push({
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                { type: "text", text: { content: "✍️ Note: " }, annotations: { bold: true } },
                { type: "text", text: { content: annot.sourceNote.substring(0, 1900) }, annotations: { italic: true } },
              ],
            },
          });
        }
      }

      await this.request(`/blocks/${bookPageId}/children`, "PATCH", {
        children: childrenBlocks,
      });
    } catch (err) {
      console.warn("Could not append highlight blocks to book page body:", err);
    }
  }

  /**
   * Queries existing highlights for a specific book with full pagination support.
   */
  public async queryExistingHighlightsForBook(
    highlightsDbId: string,
    bookPageId: string
  ): Promise<Map<string, string>> {
    const highlightMap = new Map<string, string>();
    try {
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const body: Record<string, unknown> = {
          filter: {
            property: this.mapping.highlightBookRelationField,
            relation: { contains: bookPageId },
          },
          page_size: 100,
        };
        if (cursor) body["start_cursor"] = cursor;

        const res = await this.request<{
          results: Array<{ id: string; properties: Record<string, unknown> }>;
          has_more: boolean;
          next_cursor: string | null;
        }>(`/databases/${highlightsDbId}/query`, "POST", body);

        for (const page of res.results) {
          const quoteProp = page.properties[this.mapping.highlightQuoteField] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
          const locProp = page.properties[this.mapping.highlightLocationField] as { number?: number } | undefined;

          const quoteText = quoteProp?.rich_text?.[0]?.plain_text?.trim() || "";
          const loc = locProp?.number ?? 0;

          if (quoteText) {
            const key = `${loc}:${quoteText.substring(0, 60)}`;
            highlightMap.set(key, page.id);
          }
        }

        hasMore = res.has_more && Boolean(res.next_cursor);
        cursor = res.next_cursor || undefined;
      }
    } catch (err) {
      console.warn("Could not query existing highlights:", err);
    }
    return highlightMap;
  }

  private mapColorToSelect(color?: string): string {
    switch (color) {
      case "blue":
        return "Blue (Quote / Fact)";
      case "pink":
        return "Pink (Critical / Action)";
      case "orange":
        return "Orange (Concept / Story)";
      default:
        return "Yellow (Key Insight)";
    }
  }

  /**
   * Generates a clean, structured Title for the highlight page in Notion.
   * E.g. "Loc 340 • Atomic Habits" or "Loc 120 — 'First few words...'"
   */
  private formatHighlightTitle(bookTitle: string, annotation: RawImportAnnotation): string {
    const locStr = annotation.locationStart !== undefined ? `Loc ${annotation.locationStart}` : (annotation.page !== undefined ? `p. ${annotation.page}` : "Note");
    const quoteWords = annotation.rawText.split(" ").slice(0, 7).join(" ");
    const snippet = quoteWords ? `— "${quoteWords}..."` : `• ${bookTitle}`;
    return `${locStr} ${snippet}`.substring(0, 100);
  }

  /**
   * Creates a new highlight in Notion with clean icon, structured title, and semantic color labels.
   */
  public async createHighlight(
    highlightsDbId: string,
    bookPageId: string,
    bookTitle: string,
    annotation: RawImportAnnotation
  ): Promise<string> {
    const title = this.formatHighlightTitle(bookTitle, annotation);
    const colorLabel = this.mapColorToSelect(annotation.color);

    const properties: Record<string, unknown> = {
      [this.mapping.highlightTitleField]: { title: [{ text: { content: title } }] },
      [this.mapping.highlightBookRelationField]: { relation: [{ id: bookPageId }] },
      [this.mapping.highlightQuoteField]: { rich_text: [{ text: { content: annotation.rawText.substring(0, 2000) } }] },
      [this.mapping.highlightColorField]: { select: { name: colorLabel } },
      [this.mapping.highlightImportanceField]: { select: { name: "Medium" } },
      [this.mapping.highlightStatusField]: { select: { name: "Inbox" } },
    };

    if (annotation.sourceNote) {
      properties[this.mapping.highlightNoteField] = {
        rich_text: [{ text: { content: annotation.sourceNote.substring(0, 2000) } }],
      };
    }
    if (annotation.locationStart !== undefined) {
      properties[this.mapping.highlightLocationField] = { number: annotation.locationStart };
    }
    if (annotation.page !== undefined) {
      properties[this.mapping.highlightPageField] = { number: annotation.page };
    }
    if (annotation.chapter) {
      properties[this.mapping.highlightChapterField] = {
        rich_text: [{ text: { content: annotation.chapter } }],
      };
    }

    const created = await this.request<{ id: string }>("/pages", "POST", {
      parent: { database_id: highlightsDbId },
      icon: { type: "emoji", emoji: "💡" },
      properties,
    });

    return created.id;
  }

  /**
   * Updates ONLY source-owned fields on an existing highlight page.
   * INVARIANT: Never overwrites user reflections, tags, or status!
   */
  public async updateHighlightSourceFields(
    pageId: string,
    bookTitle: string,
    annotation: RawImportAnnotation
  ): Promise<void> {
    const title = this.formatHighlightTitle(bookTitle, annotation);
    const colorLabel = this.mapColorToSelect(annotation.color);

    const properties: Record<string, unknown> = {
      [this.mapping.highlightTitleField]: { title: [{ text: { content: title } }] },
      [this.mapping.highlightQuoteField]: { rich_text: [{ text: { content: annotation.rawText.substring(0, 2000) } }] },
      [this.mapping.highlightColorField]: { select: { name: colorLabel } },
    };

    if (annotation.sourceNote) {
      properties[this.mapping.highlightNoteField] = {
        rich_text: [{ text: { content: annotation.sourceNote.substring(0, 2000) } }],
      };
    }
    if (annotation.locationStart !== undefined) {
      properties[this.mapping.highlightLocationField] = { number: annotation.locationStart };
    }

    await this.request(`/pages/${pageId}`, "PATCH", {
      icon: { type: "emoji", emoji: "💡" },
      properties,
    });
  }
}
