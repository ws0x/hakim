import type { DatabaseSync } from "node:sqlite";
import type { Book, Annotation, AnnotationUserState } from "@hakim/domain";
import { exportLibraryToVault, type BookExportPayload } from "@hakim/markdown-export";

export class VaultExportService {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  public exportAll(vaultPath: string): { exportedCount: number; destination: string } {
    const rawBooks = this.db.prepare("SELECT * FROM books").all() as Array<{
      id: string;
      source_book_key: string;
      asin: string | null;
      source_title: string;
      display_title: string;
      author: string;
      cover_url: string | null;
      source_url: string | null;
      last_annotated_at: string | null;
      source_kinds: string;
      source_state: "active" | "limited" | "source_missing" | "confirmed_missing";
      first_seen_at: string;
      last_seen_at: string;
    }>;

    const payloads: BookExportPayload[] = [];

    for (const rb of rawBooks) {
      const book: Book = {
        id: rb.id,
        sourceBookKey: rb.source_book_key,
        asin: rb.asin || undefined,
        sourceTitle: rb.source_title,
        displayTitle: rb.display_title,
        author: rb.author,
        coverUrl: rb.cover_url || undefined,
        sourceUrl: rb.source_url || undefined,
        lastAnnotatedAt: rb.last_annotated_at || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sourceKinds: JSON.parse(rb.source_kinds) as any,
        sourceState: rb.source_state,
        firstSeenAt: rb.first_seen_at,
        lastSeenAt: rb.last_seen_at,
      };

      const rawAnnots = this.db
        .prepare("SELECT * FROM annotations WHERE book_id = ? ORDER BY location_start ASC")
        .all(book.id) as Array<{
        id: string;
        book_id: string;
        source_annotation_key: string | null;
        source_kind: "kindle_cloud" | "my_clippings" | "kindle_html";
        type: "highlight" | "note" | "bookmark";
        raw_text: string;
        normalized_text: string;
        source_note: string | null;
        location_start: number | null;
        location_end: number | null;
        page: number | null;
        chapter: string | null;
        color: "yellow" | "blue" | "pink" | "orange" | "default";
        annotated_at: string | null;
        first_imported_at: string;
        last_seen_at: string;
        source_state: "active" | "limited" | "source_missing" | "confirmed_missing";
        content_limit_state: "normal" | "publisher_clipped" | "truncated";
        raw_payload_hash: string;
      }>;

      const annotationsWithState = rawAnnots.map((ra) => {
        const annot: Annotation = {
          id: ra.id,
          bookId: ra.book_id,
          sourceAnnotationKey: ra.source_annotation_key || undefined,
          sourceKind: ra.source_kind,
          type: ra.type,
          rawText: ra.raw_text,
          normalizedText: ra.normalized_text,
          sourceNote: ra.source_note || undefined,
          locationStart: ra.location_start ?? undefined,
          locationEnd: ra.location_end ?? undefined,
          page: ra.page ?? undefined,
          chapter: ra.chapter || undefined,
          color: ra.color,
          annotatedAt: ra.annotated_at || undefined,
          firstImportedAt: ra.first_imported_at,
          lastSeenAt: ra.last_seen_at,
          sourceState: ra.source_state,
          contentLimitState: ra.content_limit_state,
          rawPayloadHash: ra.raw_payload_hash,
        };

        const rawUserState = this.db
          .prepare("SELECT * FROM annotation_user_states WHERE annotation_id = ?")
          .get(annot.id) as
          | {
              annotation_id: string;
              process_status: "inbox" | "processed" | "discarded";
              importance: "low" | "medium" | "high" | "essential";
              personal_interpretation: string | null;
              agreement: "agree" | "unsure" | "disagree";
              user_tags: string;
              notion_page_id: string | null;
              notion_last_pulled_at: string | null;
              user_locked_fields: string;
            }
          | undefined;

        let userState: AnnotationUserState | undefined;
        if (rawUserState) {
          userState = {
            annotationId: rawUserState.annotation_id,
            processStatus: rawUserState.process_status,
            importance: rawUserState.importance,
            personalInterpretation: rawUserState.personal_interpretation || undefined,
            agreement: rawUserState.agreement,
            userTags: JSON.parse(rawUserState.user_tags || "[]"),
            notionPageId: rawUserState.notion_page_id || undefined,
            notionLastPulledAt: rawUserState.notion_last_pulled_at || undefined,
            userLockedFields: JSON.parse(rawUserState.user_locked_fields || "[]"),
          };
        }

        return { annotation: annot, userState };
      });

      payloads.push({ book, annotations: annotationsWithState });
    }

    return exportLibraryToVault(payloads, { vaultPath, booksSubfolder: "Hakim Books" });
  }
}
