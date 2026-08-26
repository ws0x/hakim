import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  type ImportEnvelope,
  ImportEnvelopeSchema,
  generateBookId,
  generateAnnotationId,
  normalizeText,
  normalizeTitle,
  normalizeAuthor,
  computePayloadHash,
} from "@hakim/domain";

export interface SyncReport {
  syncRunId: string;
  source: string;
  booksDiscovered: number;
  annotationsDiscovered: number;
  createdAnnotations: number;
  updatedAnnotations: number;
  errors: number;
  durationMs: number;
}

export class IngestionService {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  public ingestEnvelope(envelope: ImportEnvelope): SyncReport {
    const startTime = Date.now();
    // 1. Runtime validation
    const validated = ImportEnvelopeSchema.parse(envelope);

    const syncRunId = randomUUID();
    const now = new Date().toISOString();

    let createdAnnotations = 0;
    let updatedAnnotations = 0;
    let totalAnnotations = 0;

    // Record start of sync run
    this.db
      .prepare(
        "INSERT INTO sync_runs (id, source, status, started_at) VALUES (?, ?, 'in_progress', ?)"
      )
      .run(syncRunId, validated.sourceKind, now);

    try {
      for (const rawBook of validated.books) {
        // Generate stable book identity
        const { id: bookId, stableKey } = generateBookId({
          asin: rawBook.asin,
          sourceBookKey: rawBook.sourceBookKey,
          title: rawBook.sourceTitle,
          author: rawBook.author,
        });

        const displayTitle = normalizeTitle(rawBook.sourceTitle);
        const author = normalizeAuthor(rawBook.author);

        // Check if book exists
        const existingBook = this.db
          .prepare("SELECT * FROM books WHERE id = ?")
          .get(bookId) as
          | { source_kinds: string; source_title: string }
          | undefined;

        if (!existingBook) {
          this.db
            .prepare(
              `INSERT INTO books (
                id, source_book_key, asin, source_title, display_title, author,
                cover_url, source_url, last_annotated_at, source_kinds,
                source_state, first_seen_at, last_seen_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
            )
            .run(
              bookId,
              stableKey,
              rawBook.asin || null,
              rawBook.sourceTitle,
              displayTitle,
              author,
              rawBook.coverUrl || null,
              rawBook.sourceUrl || null,
              rawBook.lastAnnotatedAt || null,
              JSON.stringify([validated.sourceKind]),
              now,
              now
            );
        } else {
          // Merge source kinds
          const kinds = new Set<string>(JSON.parse(existingBook.source_kinds));
          kinds.add(validated.sourceKind);

          this.db
            .prepare(
              `UPDATE books SET 
                last_seen_at = ?,
                source_kinds = ?,
                last_annotated_at = COALESCE(?, last_annotated_at),
                cover_url = COALESCE(?, cover_url)
              WHERE id = ?`
            )
            .run(now, JSON.stringify(Array.from(kinds)), rawBook.lastAnnotatedAt || null, rawBook.coverUrl || null, bookId);
        }

        // Process annotations for this book
        for (const rawAnnot of rawBook.annotations) {
          totalAnnotations++;
          const normText = normalizeText(rawAnnot.rawText);
          const rawHash = computePayloadHash(rawAnnot.rawText + (rawAnnot.sourceNote || ""));

          const { id: annotId } = generateAnnotationId({
            bookId,
            type: rawAnnot.type,
            sourceAnnotationKey: rawAnnot.sourceAnnotationKey,
            locationStart: rawAnnot.locationStart,
            locationEnd: rawAnnot.locationEnd,
            page: rawAnnot.page,
            rawText: rawAnnot.rawText,
          });

          const existingAnnot = this.db
            .prepare("SELECT id, raw_payload_hash FROM annotations WHERE id = ?")
            .get(annotId) as { id: string; raw_payload_hash: string } | undefined;

          if (!existingAnnot) {
            // Insert annotation (Source-owned)
            this.db
              .prepare(
                `INSERT INTO annotations (
                  id, book_id, source_annotation_key, source_kind, type,
                  raw_text, normalized_text, source_note, location_start,
                  location_end, page, chapter, color, annotated_at,
                  first_imported_at, last_seen_at, source_state,
                  content_limit_state, raw_payload_hash
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
              )
              .run(
                annotId,
                bookId,
                rawAnnot.sourceAnnotationKey || null,
                validated.sourceKind,
                rawAnnot.type || "highlight",
                rawAnnot.rawText,
                normText,
                rawAnnot.sourceNote || null,
                rawAnnot.locationStart !== undefined ? rawAnnot.locationStart : null,
                rawAnnot.locationEnd !== undefined ? rawAnnot.locationEnd : null,
                rawAnnot.page !== undefined ? rawAnnot.page : null,
                rawAnnot.chapter || null,
                rawAnnot.color || "yellow",
                rawAnnot.annotatedAt || null,
                now,
                now,
                rawAnnot.contentLimitState || "normal",
                rawHash
              );

            // Create initial user state (User-owned)
            this.db
              .prepare(
                `INSERT INTO annotation_user_states (
                  annotation_id, process_status, importance, agreement, user_tags, user_locked_fields
                ) VALUES (?, 'inbox', 'medium', 'agree', '[]', '[]')`
              )
              .run(annotId);

            createdAnnotations++;
          } else {
            // Update source-owned properties ONLY. User state is NOT touched!
            this.db
              .prepare(
                `UPDATE annotations SET
                  source_note = COALESCE(?, source_note),
                  color = COALESCE(?, color),
                  chapter = COALESCE(?, chapter),
                  last_seen_at = ?,
                  raw_payload_hash = ?
                WHERE id = ?`
              )
              .run(rawAnnot.sourceNote || null, rawAnnot.color || null, rawAnnot.chapter || null, now, rawHash, annotId);

            updatedAnnotations++;
          }
        }
      }

      const durationMs = Date.now() - startTime;

      // Complete sync run record
      this.db
        .prepare(
          `UPDATE sync_runs SET
            status = 'completed',
            books_discovered = ?,
            annotations_discovered = ?,
            created_count = ?,
            updated_count = ?,
            completed_at = ?
          WHERE id = ?`
        )
        .run(
          validated.books.length,
          totalAnnotations,
          createdAnnotations,
          updatedAnnotations,
          new Date().toISOString(),
          syncRunId
        );

      return {
        syncRunId,
        source: validated.sourceKind,
        booksDiscovered: validated.books.length,
        annotationsDiscovered: totalAnnotations,
        createdAnnotations,
        updatedAnnotations,
        errors: 0,
        durationMs,
      };
    } catch (err) {
      this.db
        .prepare(
          "UPDATE sync_runs SET status = 'failed', completed_at = ?, error_count = 1 WHERE id = ?"
        )
        .run(new Date().toISOString(), syncRunId);
      throw err;
    }
  }
}
