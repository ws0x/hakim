import type { DatabaseSync } from "node:sqlite";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export class BackupService {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  public exportJsonBackup(targetPath: string): { filePath: string; bookCount: number; annotCount: number } {
    const books = this.db.prepare("SELECT * FROM books").all();
    const annotations = this.db.prepare("SELECT * FROM annotations").all();
    const userStates = this.db.prepare("SELECT * FROM annotation_user_states").all();
    const concepts = this.db.prepare("SELECT * FROM concepts").all();
    const insights = this.db.prepare("SELECT * FROM insights").all();

    const payload = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      system: "Hakim (حَكِيم)",
      data: {
        books,
        annotations,
        userStates,
        concepts,
        insights,
      },
    };

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, JSON.stringify(payload, null, 2), "utf-8");

    return {
      filePath: targetPath,
      bookCount: books.length,
      annotCount: annotations.length,
    };
  }

  public restoreJsonBackup(sourcePath: string): { restoredBooks: number; restoredAnnots: number } {
    if (!existsSync(sourcePath)) {
      throw new Error(`Backup file does not exist: ${sourcePath}`);
    }

    const raw = readFileSync(sourcePath, "utf-8");
    const parsed = JSON.parse(raw) as {
      data: {
        books: Array<Record<string, unknown>>;
        annotations: Array<Record<string, unknown>>;
        userStates: Array<Record<string, unknown>>;
      };
    };

    let restoredBooks = 0;
    let restoredAnnots = 0;

    for (const b of parsed.data.books || []) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO books (
            id, source_book_key, asin, source_title, display_title, author,
            cover_url, source_url, last_annotated_at, source_kinds,
            source_state, first_seen_at, last_seen_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          b["id"] as string,
          b["source_book_key"] as string,
          (b["asin"] as string) || null,
          b["source_title"] as string,
          b["display_title"] as string,
          b["author"] as string,
          (b["cover_url"] as string) || null,
          (b["source_url"] as string) || null,
          (b["last_annotated_at"] as string) || null,
          b["source_kinds"] as string,
          (b["source_state"] as string) || "active",
          b["first_seen_at"] as string,
          b["last_seen_at"] as string
        );
      restoredBooks++;
    }

    for (const a of parsed.data.annotations || []) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO annotations (
            id, book_id, source_annotation_key, source_kind, type,
            raw_text, normalized_text, source_note, location_start,
            location_end, page, chapter, color, annotated_at,
            first_imported_at, last_seen_at, source_state,
            content_limit_state, raw_payload_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          a["id"] as string,
          a["book_id"] as string,
          (a["source_annotation_key"] as string) || null,
          a["source_kind"] as string,
          (a["type"] as string) || "highlight",
          a["raw_text"] as string,
          a["normalized_text"] as string,
          (a["source_note"] as string) || null,
          (a["location_start"] as number) ?? null,
          (a["location_end"] as number) ?? null,
          (a["page"] as number) ?? null,
          (a["chapter"] as string) || null,
          (a["color"] as string) || "yellow",
          (a["annotated_at"] as string) || null,
          a["first_imported_at"] as string,
          a["last_seen_at"] as string,
          (a["source_state"] as string) || "active",
          (a["content_limit_state"] as string) || "normal",
          a["raw_payload_hash"] as string
        );
      restoredAnnots++;
    }

    for (const u of parsed.data.userStates || []) {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO annotation_user_states (
            annotation_id, process_status, importance, personal_interpretation,
            agreement, user_tags, notion_page_id, notion_last_pulled_at, user_locked_fields
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          u["annotation_id"] as string,
          (u["process_status"] as string) || "inbox",
          (u["importance"] as string) || "medium",
          (u["personal_interpretation"] as string) || null,
          (u["agreement"] as string) || "agree",
          (u["user_tags"] as string) || "[]",
          (u["notion_page_id"] as string) || null,
          (u["notion_last_pulled_at"] as string) || null,
          (u["user_locked_fields"] as string) || "[]"
        );
    }

    return { restoredBooks, restoredAnnots };
  }
}
