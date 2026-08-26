import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface DatabaseOptions {
  filePath?: string;
}

export function initDatabase(options: DatabaseOptions = {}): DatabaseSync {
  const filePath = options.filePath || ":memory:";

  if (filePath !== ":memory:") {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const db = new DatabaseSync(filePath);

  // Enable WAL mode and foreign keys when using file on disk
  if (filePath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  db.exec("PRAGMA foreign_keys = ON;");

  // Schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS engine_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      source_book_key TEXT NOT NULL,
      asin TEXT,
      source_title TEXT NOT NULL,
      display_title TEXT NOT NULL,
      author TEXT NOT NULL,
      cover_url TEXT,
      source_url TEXT,
      last_annotated_at TEXT,
      source_kinds TEXT NOT NULL,
      source_state TEXT NOT NULL DEFAULT 'active',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      source_annotation_key TEXT,
      source_kind TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'highlight',
      raw_text TEXT NOT NULL,
      normalized_text TEXT NOT NULL,
      source_note TEXT,
      location_start INTEGER,
      location_end INTEGER,
      page INTEGER,
      chapter TEXT,
      color TEXT NOT NULL DEFAULT 'yellow',
      annotated_at TEXT,
      first_imported_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      source_state TEXT NOT NULL DEFAULT 'active',
      content_limit_state TEXT NOT NULL DEFAULT 'normal',
      raw_payload_hash TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS annotation_user_states (
      annotation_id TEXT PRIMARY KEY,
      process_status TEXT NOT NULL DEFAULT 'inbox',
      importance TEXT NOT NULL DEFAULT 'medium',
      personal_interpretation TEXT,
      agreement TEXT NOT NULL DEFAULT 'agree',
      user_tags TEXT NOT NULL DEFAULT '[]',
      notion_page_id TEXT,
      notion_last_pulled_at TEXT,
      user_locked_fields TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (annotation_id) REFERENCES annotations (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      working_definition TEXT NOT NULL,
      my_understanding TEXT,
      status TEXT NOT NULL DEFAULT 'emerging',
      mastery_score REAL NOT NULL DEFAULT 0,
      last_reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      claim TEXT NOT NULL,
      explanation_in_my_words TEXT NOT NULL,
      evidence TEXT,
      counterevidence TEXT,
      my_position TEXT,
      confidence REAL NOT NULL DEFAULT 0.8,
      stage TEXT NOT NULL DEFAULT 'ai_draft',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_runs (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'started',
      books_discovered INTEGER NOT NULL DEFAULT 0,
      annotations_discovered INTEGER NOT NULL DEFAULT 0,
      created_count INTEGER NOT NULL DEFAULT 0,
      updated_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_books_asin ON books (asin);
    CREATE INDEX IF NOT EXISTS idx_annotations_book_id ON annotations (book_id);
    CREATE INDEX IF NOT EXISTS idx_annotations_location ON annotations (book_id, location_start);
  `);

  return db;
}
