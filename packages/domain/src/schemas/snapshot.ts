import { z } from "zod";
import {
  AnnotationSchema,
  AnnotationUserStateSchema,
  BookSchema,
  SyncRunSchema,
} from "./index.js";

export const SnapshotCompletenessSchema = z.enum([
  "complete",
  "partial",
  "authentication_required",
  "captcha",
  "content_limited",
]);
export type SnapshotCompleteness = z.infer<typeof SnapshotCompletenessSchema>;

export const IdentityAliasSchema = z.object({
  legacyId: z.string().min(1),
  currentId: z.string().uuid(),
  entityType: z.enum(["book", "annotation"]),
  createdAt: z.string().datetime(),
});
export type IdentityAlias = z.infer<typeof IdentityAliasSchema>;

export const LocalBookRecordSchema = BookSchema.extend({
  identityVersion: z.literal(2),
  legacyIds: z.array(z.string().min(1)).default([]),
});
export type LocalBookRecord = z.infer<typeof LocalBookRecordSchema>;

export const LocalAnnotationRecordSchema = AnnotationSchema.extend({
  identityVersion: z.literal(2),
  identityStrategy: z.enum(["source_key", "location_anchor", "page_text_fallback", "book_text_fallback"]),
  legacyIds: z.array(z.string().min(1)).default([]),
  consecutiveCompleteMisses: z.number().int().nonnegative().default(0),
});
export type LocalAnnotationRecord = z.infer<typeof LocalAnnotationRecordSchema>;

export const NotionProjectionSchema = z.object({
  entityId: z.string().uuid(),
  entityType: z.enum(["book", "annotation"]),
  pageId: z.string().min(1),
  dataSourceId: z.string().min(1),
  sourceHash: z.string().min(8).optional(),
  notionLastEditedAt: z.string().datetime().optional(),
  lastPulledAt: z.string().datetime().optional(),
  lastPushedAt: z.string().datetime().optional(),
});
export type NotionProjection = z.infer<typeof NotionProjectionSchema>;

export const SyncStageSchema = z.enum([
  "discover_library",
  "fetch_amazon_page",
  "reconcile_local",
  "pull_notion",
  "push_notion",
  "finalize_snapshot",
]);
export type SyncStage = z.infer<typeof SyncStageSchema>;

export const SyncFailureCodeSchema = z.enum([
  "offline",
  "amazon_authentication_required",
  "amazon_captcha",
  "notion_authentication",
  "notion_permission",
  "notion_schema_drift",
  "notion_rate_limited",
  "partial_snapshot",
  "unexpected",
]);
export type SyncFailureCode = z.infer<typeof SyncFailureCodeSchema>;

export const SyncCheckpointV1Schema = z.object({
  stage: SyncStageSchema,
  bookIndex: z.number().int().nonnegative().default(0),
  amazonPage: z.number().int().positive().default(1),
  amazonToken: z.string().optional(),
  amazonNextPageStart: z.string().optional(),
  notionCursor: z.string().optional(),
  completedOperations: z.number().int().nonnegative().default(0),
  totalOperations: z.number().int().nonnegative().optional(),
});
export type SyncCheckpointV1 = z.infer<typeof SyncCheckpointV1Schema>;

export const SyncJobV1Schema = z.object({
  id: z.string().uuid(),
  version: z.literal("1"),
  trigger: z.enum(["manual", "scheduled", "startup", "continuation"]),
  state: z.enum(["queued", "running", "paused", "completed", "failed"]),
  checkpoint: SyncCheckpointV1Schema,
  attemptCount: z.number().int().nonnegative().default(0),
  retryAt: z.string().datetime().optional(),
  leaseOwner: z.string().optional(),
  leaseExpiresAt: z.string().datetime().optional(),
  failureCode: SyncFailureCodeSchema.optional(),
  failureMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SyncJobV1 = z.infer<typeof SyncJobV1Schema>;

export const MigrationReviewItemSchema = z.object({
  id: z.string().uuid(),
  entityType: z.enum(["book", "annotation"]),
  reason: z.enum([
    "ambiguous_identity",
    "duplicate_candidate",
    "missing_relation",
    "incompatible_property",
    "possibly_truncated",
  ]),
  notionPageIds: z.array(z.string().min(1)),
  candidateEntityIds: z.array(z.string().uuid()).default([]),
  details: z.string(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
});
export type MigrationReviewItem = z.infer<typeof MigrationReviewItemSchema>;

export const HakimLibrarySnapshotV2Schema = z.object({
  schemaVersion: z.literal("2.0"),
  exportedAt: z.string().datetime(),
  source: z.literal("hakim_extension"),
  completeness: SnapshotCompletenessSchema,
  books: z.array(LocalBookRecordSchema),
  annotations: z.array(LocalAnnotationRecordSchema),
  userStates: z.array(AnnotationUserStateSchema),
  identityAliases: z.array(IdentityAliasSchema).default([]),
  notionProjections: z.array(NotionProjectionSchema).default([]),
  syncRuns: z.array(SyncRunSchema).default([]),
});
export type HakimLibrarySnapshotV2 = z.infer<typeof HakimLibrarySnapshotV2Schema>;

export const SyncCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("GET_STATUS") }),
  z.object({ type: z.literal("START_SYNC"), forceFullSync: z.boolean().default(true) }),
  z.object({ type: z.literal("RESUME_SYNC") }),
  z.object({ type: z.literal("SAVE_CONFIG"), config: z.unknown(), notionSecret: z.string().optional() }),
  z.object({ type: z.literal("CLEAR_NOTION_SECRET") }),
  z.object({ type: z.literal("EXPORT_BACKUP") }),
  z.object({ type: z.literal("RUN_MIGRATION_PREFLIGHT") }),
]);
export type SyncCommand = z.infer<typeof SyncCommandSchema>;

export const SyncStatusSchema = z.object({
  state: z.enum([
    "setup_required",
    "ready",
    "syncing",
    "paused",
    "partial",
    "login_required",
    "captcha",
    "permission_failure",
    "failed",
    "success",
  ]),
  notionConfigured: z.boolean(),
  databasesConfigured: z.boolean(),
  amazonDomain: z.string(),
  lastSyncAt: z.string().datetime().optional(),
  nextSyncAt: z.string().datetime().optional(),
  booksCount: z.number().int().nonnegative(),
  annotationsCount: z.number().int().nonnegative(),
  progress: z.number().min(0).max(100).optional(),
  stage: SyncStageSchema.optional(),
  message: z.string().optional(),
});
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
