import { z } from "zod";
import type { MigrationReviewItem } from "@hakim/domain";
import { BOOK_PROPERTY_NAMES, HIGHLIGHT_PROPERTY_NAMES } from "./core-schema.js";
import type { NotionDataSourceRecord, NotionPageRecord } from "./client.js";

export const NotionMigrationBackupV1Schema = z.object({
  schemaVersion: z.literal("1.0"),
  exportedAt: z.string().datetime(),
  booksDataSource: z.object({ id: z.string(), schema: z.record(z.unknown()), pages: z.array(z.unknown()) }),
  highlightsDataSource: z.object({ id: z.string(), schema: z.record(z.unknown()), pages: z.array(z.unknown()) }),
  pageBlocks: z.record(z.array(z.unknown())),
});
export type NotionMigrationBackupV1 = z.infer<typeof NotionMigrationBackupV1Schema>;

export interface MigrationPreflightReport {
  booksCount: number;
  highlightsCount: number;
  duplicateHakimIds: string[];
  missingRelations: string[];
  incompatibleProperties: string[];
  possiblyTruncatedPageIds: string[];
  reviewItems: MigrationReviewItem[];
  safeToApplyTechnicalFields: boolean;
}

const EXPECTED_BOOK_TYPES: Record<string, string> = {
  [BOOK_PROPERTY_NAMES.title]: "title",
  [BOOK_PROPERTY_NAMES.sourceTitle]: "rich_text",
  [BOOK_PROPERTY_NAMES.hakimId]: "rich_text",
  [BOOK_PROPERTY_NAMES.asin]: "rich_text",
};

const EXPECTED_HIGHLIGHT_TYPES: Record<string, string> = {
  [HIGHLIGHT_PROPERTY_NAMES.title]: "title",
  [HIGHLIGHT_PROPERTY_NAMES.hakimId]: "rich_text",
  [HIGHLIGHT_PROPERTY_NAMES.book]: "relation",
  [HIGHLIGHT_PROPERTY_NAMES.quote]: "rich_text",
  [HIGHLIGHT_PROPERTY_NAMES.interpretation]: "rich_text",
};

function plainText(property: unknown): string {
  if (!property || typeof property !== "object") return "";
  const record = property as { rich_text?: Array<{ plain_text?: string }>; title?: Array<{ plain_text?: string }> };
  return [...(record.rich_text ?? []), ...(record.title ?? [])].map((item) => item.plain_text ?? "").join("");
}

function relationIds(property: unknown): string[] {
  if (!property || typeof property !== "object") return [];
  const relation = (property as { relation?: Array<{ id?: string }> }).relation ?? [];
  return relation.flatMap((item) => item.id ? [item.id] : []);
}

export function buildMigrationPreflight(params: {
  booksDataSource: NotionDataSourceRecord;
  highlightsDataSource: NotionDataSourceRecord;
  books: NotionPageRecord[];
  highlights: NotionPageRecord[];
  now?: string;
}): MigrationPreflightReport {
  const incompatibleProperties: string[] = [];
  for (const [name, type] of Object.entries(EXPECTED_BOOK_TYPES)) {
    const current = params.booksDataSource.properties[name];
    if (current && current.type !== type) incompatibleProperties.push(`Books.${name}: expected ${type}, found ${current.type ?? "unknown"}`);
  }
  for (const [name, type] of Object.entries(EXPECTED_HIGHLIGHT_TYPES)) {
    const current = params.highlightsDataSource.properties[name];
    if (current && current.type !== type) incompatibleProperties.push(`Highlights.${name}: expected ${type}, found ${current.type ?? "unknown"}`);
  }

  const duplicateHakimIds: string[] = [];
  const seen = new Set<string>();
  for (const page of [...params.books, ...params.highlights]) {
    const propertyName = params.books.includes(page) ? BOOK_PROPERTY_NAMES.hakimId : HIGHLIGHT_PROPERTY_NAMES.hakimId;
    const id = plainText(page.properties[propertyName]);
    if (!id) continue;
    if (seen.has(id)) duplicateHakimIds.push(id);
    seen.add(id);
  }

  const missingRelations = params.highlights
    .filter((page) => relationIds(page.properties[HIGHLIGHT_PROPERTY_NAMES.book]).length !== 1)
    .map((page) => page.id);
  const possiblyTruncatedPageIds = params.highlights
    .filter((page) => plainText(page.properties[HIGHLIGHT_PROPERTY_NAMES.quote]).length === 2_000)
    .map((page) => page.id);
  const now = params.now ?? new Date().toISOString();
  const reviewItems: MigrationReviewItem[] = [
    ...duplicateHakimIds.map((id) => ({
      id: crypto.randomUUID(), entityType: "annotation" as const, reason: "duplicate_candidate" as const,
      notionPageIds: params.highlights.filter((page) => plainText(page.properties[HIGHLIGHT_PROPERTY_NAMES.hakimId]) === id).map((page) => page.id),
      candidateEntityIds: [], details: `Duplicate Hakim ID ${id}`, createdAt: now,
    })),
    ...missingRelations.map((pageId) => ({
      id: crypto.randomUUID(), entityType: "annotation" as const, reason: "missing_relation" as const,
      notionPageIds: [pageId], candidateEntityIds: [], details: "Highlight must relate to exactly one book", createdAt: now,
    })),
    ...possiblyTruncatedPageIds.map((pageId) => ({
      id: crypto.randomUUID(), entityType: "annotation" as const, reason: "possibly_truncated" as const,
      notionPageIds: [pageId], candidateEntityIds: [], details: "Quote is exactly 2,000 characters and may have been truncated by the legacy client", createdAt: now,
    })),
  ];

  return {
    booksCount: params.books.length,
    highlightsCount: params.highlights.length,
    duplicateHakimIds: Array.from(new Set(duplicateHakimIds)),
    missingRelations,
    incompatibleProperties,
    possiblyTruncatedPageIds,
    reviewItems,
    safeToApplyTechnicalFields: incompatibleProperties.length === 0 && duplicateHakimIds.length === 0,
  };
}

export function createMigrationBackup(input: Omit<NotionMigrationBackupV1, "schemaVersion" | "exportedAt">): NotionMigrationBackupV1 {
  return NotionMigrationBackupV1Schema.parse({
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    ...input,
  });
}
