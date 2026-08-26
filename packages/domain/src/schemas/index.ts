import { z } from "zod";

// ==========================================
// 1. Account Schema
// ==========================================
export const AccountSchema = z.object({
  id: z.string().uuid(),
  amazonRegion: z.string().default("com"),
  amazonAccountFingerprint: z.string().optional(),
  notionWorkspaceId: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type Account = z.infer<typeof AccountSchema>;

// ==========================================
// 2. Book Schema
// ==========================================
export const SourceKindSchema = z.enum(["kindle_cloud", "my_clippings", "kindle_html"]);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SourceStateSchema = z.enum(["active", "limited", "source_missing", "confirmed_missing"]);
export type SourceState = z.infer<typeof SourceStateSchema>;

export const BookSchema = z.object({
  id: z.string().uuid(),
  sourceBookKey: z.string().min(1),
  asin: z.string().optional(),
  sourceTitle: z.string().min(1),
  displayTitle: z.string().min(1),
  author: z.string().default("Unknown Author"),
  coverUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  lastAnnotatedAt: z.string().datetime().optional(),
  sourceKinds: z.array(SourceKindSchema).min(1),
  sourceState: SourceStateSchema.default("active"),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
});
export type Book = z.infer<typeof BookSchema>;

// ==========================================
// 3. Annotation Schema
// ==========================================
export const AnnotationTypeSchema = z.enum(["highlight", "note", "bookmark"]);
export type AnnotationType = z.infer<typeof AnnotationTypeSchema>;

export const ContentLimitStateSchema = z.enum(["normal", "publisher_clipped", "truncated"]);
export type ContentLimitState = z.infer<typeof ContentLimitStateSchema>;

export const AnnotationColorSchema = z.enum(["yellow", "blue", "pink", "orange", "default"]);
export type AnnotationColor = z.infer<typeof AnnotationColorSchema>;

export const AnnotationSchema = z.object({
  id: z.string().uuid(),
  bookId: z.string().uuid(),
  sourceAnnotationKey: z.string().optional(),
  sourceKind: SourceKindSchema,
  type: AnnotationTypeSchema.default("highlight"),
  rawText: z.string(),
  normalizedText: z.string(),
  sourceNote: z.string().optional(),
  locationStart: z.number().int().nonnegative().optional(),
  locationEnd: z.number().int().nonnegative().optional(),
  page: z.number().int().positive().optional(),
  chapter: z.string().optional(),
  color: AnnotationColorSchema.default("yellow"),
  annotatedAt: z.string().datetime().optional(),
  firstImportedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  sourceState: SourceStateSchema.default("active"),
  contentLimitState: ContentLimitStateSchema.default("normal"),
  rawPayloadHash: z.string().min(8),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

// ==========================================
// 4. Annotation User State Schema
// ==========================================
export const ProcessStatusSchema = z.enum(["inbox", "processed", "discarded"]);
export type ProcessStatus = z.infer<typeof ProcessStatusSchema>;

export const ImportanceSchema = z.enum(["low", "medium", "high", "essential"]);
export type Importance = z.infer<typeof ImportanceSchema>;

export const AgreementSchema = z.enum(["agree", "unsure", "disagree"]);
export type Agreement = z.infer<typeof AgreementSchema>;

export const AnnotationUserStateSchema = z.object({
  annotationId: z.string().uuid(),
  processStatus: ProcessStatusSchema.default("inbox"),
  importance: ImportanceSchema.default("medium"),
  personalInterpretation: z.string().optional(),
  agreement: AgreementSchema.default("agree"),
  userTags: z.array(z.string()).default([]),
  notionPageId: z.string().optional(),
  notionLastPulledAt: z.string().datetime().optional(),
  userLockedFields: z.array(z.string()).default([]),
});
export type AnnotationUserState = z.infer<typeof AnnotationUserStateSchema>;

// ==========================================
// 5. Concept Schema
// ==========================================
export const ConceptStatusSchema = z.enum(["emerging", "active", "stable", "challenged", "archived"]);
export type ConceptStatus = z.infer<typeof ConceptStatusSchema>;

export const ConceptSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  workingDefinition: z.string().min(1),
  myUnderstanding: z.string().optional(),
  status: ConceptStatusSchema.default("emerging"),
  masteryScore: z.number().min(0).max(100).default(0),
  lastReviewedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type Concept = z.infer<typeof ConceptSchema>;

// ==========================================
// 6. Insight Schema
// ==========================================
export const InsightStageSchema = z.enum(["ai_draft", "reviewing", "approved", "challenged", "archived"]);
export type InsightStage = z.infer<typeof InsightStageSchema>;

export const InsightSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  claim: z.string().min(1),
  explanationInMyWords: z.string().min(1),
  evidence: z.string().optional(),
  counterevidence: z.string().optional(),
  myPosition: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.8),
  stage: InsightStageSchema.default("ai_draft"),
  sourceAnnotationIds: z.array(z.string().uuid()).default([]),
  conceptIds: z.array(z.string().uuid()).default([]),
  createdAt: z.string().datetime(),
});
export type Insight = z.infer<typeof InsightSchema>;

// ==========================================
// 7. Intelligence Draft Schema
// ==========================================
export const TaskTypeSchema = z.enum([
  "classification",
  "claim_extraction",
  "question_generation",
  "concept_connect",
  "contradiction_detect",
  "book_synthesis",
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

export const DraftStatusSchema = z.enum(["draft", "approved", "rejected", "stale"]);
export type DraftStatus = z.infer<typeof DraftStatusSchema>;

export const IntelligenceDraftSchema = z.object({
  id: z.string().uuid(),
  annotationId: z.string().uuid().optional(),
  bookId: z.string().uuid().optional(),
  taskType: TaskTypeSchema,
  promptVersion: z.string().min(1),
  model: z.string().min(1),
  inputHash: z.string().min(8),
  structuredOutput: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).default(1.0),
  groundingWarnings: z.array(z.string()).default([]),
  status: DraftStatusSchema.default("draft"),
  createdAt: z.string().datetime(),
});
export type IntelligenceDraft = z.infer<typeof IntelligenceDraftSchema>;

// ==========================================
// 8. Import Envelope Schemas
// ==========================================
export const RawImportAnnotationSchema = z.object({
  sourceAnnotationKey: z.string().optional(),
  type: AnnotationTypeSchema.optional().default("highlight"),
  rawText: z.string(),
  sourceNote: z.string().optional(),
  locationStart: z.number().int().nonnegative().optional(),
  locationEnd: z.number().int().nonnegative().optional(),
  page: z.number().int().positive().optional(),
  chapter: z.string().optional(),
  color: AnnotationColorSchema.optional().default("yellow"),
  annotatedAt: z.string().optional(),
  contentLimitState: ContentLimitStateSchema.optional().default("normal"),
});
export type RawImportAnnotation = z.infer<typeof RawImportAnnotationSchema>;

export const RawImportBookSchema = z.object({
  sourceBookKey: z.string().min(1),
  asin: z.string().optional(),
  sourceTitle: z.string().min(1),
  author: z.string().default("Unknown Author"),
  coverUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
  lastAnnotatedAt: z.string().optional(),
  annotations: z.array(RawImportAnnotationSchema),
});
export type RawImportBook = z.infer<typeof RawImportBookSchema>;

export const ImportEnvelopeSchema = z.object({
  version: z.literal("1.0"),
  sourceKind: SourceKindSchema,
  importedAt: z.string().datetime(),
  books: z.array(RawImportBookSchema),
});
export type ImportEnvelope = z.infer<typeof ImportEnvelopeSchema>;

// ==========================================
// 9. Sync Run & Event Schemas
// ==========================================
export const SyncRunStatusSchema = z.enum(["started", "in_progress", "completed", "failed", "partial"]);
export type SyncRunStatus = z.infer<typeof SyncRunStatusSchema>;

export const SyncRunSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  status: SyncRunStatusSchema.default("started"),
  booksDiscovered: z.number().int().nonnegative().default(0),
  annotationsDiscovered: z.number().int().nonnegative().default(0),
  createdCount: z.number().int().nonnegative().default(0),
  updatedCount: z.number().int().nonnegative().default(0),
  errorCount: z.number().int().nonnegative().default(0),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type SyncRun = z.infer<typeof SyncRunSchema>;
