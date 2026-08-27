import {
  computePayloadHash,
  generateAnnotationId,
  generateAnnotationIdentityV2,
  generateBookId,
  normalizeAuthor,
  normalizeText,
  normalizeTitle,
  type AnnotationUserState,
  type IdentityAlias,
  type LocalAnnotationRecord,
  type LocalBookRecord,
  type RawImportBook,
  type SnapshotCompleteness,
} from "@hakim/domain";

export interface ReconciliationResult {
  books: LocalBookRecord[];
  annotations: LocalAnnotationRecord[];
  userStates: AnnotationUserState[];
  aliases: IdentityAlias[];
  createdAnnotations: number;
  updatedAnnotations: number;
  missingAnnotations: number;
}

export function reconcileSourceSnapshot(params: {
  rawBooks: RawImportBook[];
  existingBooks: LocalBookRecord[];
  existingAnnotations: LocalAnnotationRecord[];
  existingUserStates: AnnotationUserState[];
  completeness: SnapshotCompleteness;
  amazonRegion: string;
  now?: string;
}): ReconciliationResult {
  const now = params.now ?? new Date().toISOString();
  const bookById = new Map(params.existingBooks.map((book) => [book.id, book]));
  const annotationById = new Map(params.existingAnnotations.map((annotation) => [annotation.id, annotation]));
  const seenAnnotationIds = new Set<string>();
  const books: LocalBookRecord[] = [];
  const annotations: LocalAnnotationRecord[] = [];
  const userStates = [...params.existingUserStates];
  const aliases: IdentityAlias[] = [];
  let createdAnnotations = 0;
  let updatedAnnotations = 0;

  for (const rawBook of params.rawBooks) {
    const bookIdentity = generateBookId({
      asin: rawBook.asin,
      sourceBookKey: rawBook.sourceBookKey,
      title: rawBook.sourceTitle,
      author: rawBook.author,
      region: params.amazonRegion,
    });
    const existingBook = bookById.get(bookIdentity.id);
    const book: LocalBookRecord = {
      id: bookIdentity.id,
      identityVersion: 2,
      legacyIds: existingBook?.legacyIds ?? [],
      sourceBookKey: bookIdentity.stableKey,
      asin: rawBook.asin,
      sourceTitle: rawBook.sourceTitle,
      displayTitle: existingBook?.displayTitle ?? normalizeTitle(rawBook.sourceTitle),
      author: normalizeAuthor(rawBook.author),
      coverUrl: rawBook.coverUrl,
      sourceUrl: rawBook.sourceUrl,
      lastAnnotatedAt: rawBook.lastAnnotatedAt,
      sourceKinds: Array.from(new Set([...(existingBook?.sourceKinds ?? []), "kindle_cloud" as const])),
      sourceState: "active",
      firstSeenAt: existingBook?.firstSeenAt ?? now,
      lastSeenAt: now,
    };
    books.push(book);

    for (const rawAnnotation of rawBook.annotations) {
      const identity = generateAnnotationIdentityV2({
        bookId: book.id,
        type: rawAnnotation.type,
        sourceAnnotationKey: rawAnnotation.sourceAnnotationKey,
        locationStart: rawAnnotation.locationStart,
        page: rawAnnotation.page,
        rawText: rawAnnotation.rawText,
      });
      const legacyIdentity = generateAnnotationId({
        bookId: book.id,
        type: rawAnnotation.type,
        sourceAnnotationKey: rawAnnotation.sourceAnnotationKey,
        locationStart: rawAnnotation.locationStart,
        locationEnd: rawAnnotation.locationEnd,
        page: rawAnnotation.page,
        rawText: rawAnnotation.rawText,
      });
      const existingAnnotation = annotationById.get(identity.id);
      const normalizedText = normalizeText(rawAnnotation.rawText);
      const rawPayloadHash = computePayloadHash(
        JSON.stringify({
          rawText: rawAnnotation.rawText,
          sourceNote: rawAnnotation.sourceNote ?? null,
          locationStart: rawAnnotation.locationStart ?? null,
          locationEnd: rawAnnotation.locationEnd ?? null,
          page: rawAnnotation.page ?? null,
          chapter: rawAnnotation.chapter ?? null,
          color: rawAnnotation.color,
          annotatedAt: rawAnnotation.annotatedAt ?? null,
          contentLimitState: rawAnnotation.contentLimitState,
        })
      );

      const legacyIds = Array.from(
        new Set([...(existingAnnotation?.legacyIds ?? []), ...(legacyIdentity.id === identity.id ? [] : [legacyIdentity.id])])
      );
      const annotation: LocalAnnotationRecord = {
        id: identity.id,
        identityVersion: 2,
        identityStrategy: identity.strategy,
        legacyIds,
        consecutiveCompleteMisses: 0,
        bookId: book.id,
        sourceAnnotationKey: rawAnnotation.sourceAnnotationKey,
        sourceKind: "kindle_cloud",
        type: rawAnnotation.type,
        rawText: rawAnnotation.rawText,
        normalizedText,
        sourceNote: rawAnnotation.sourceNote,
        locationStart: rawAnnotation.locationStart,
        locationEnd: rawAnnotation.locationEnd,
        page: rawAnnotation.page,
        chapter: rawAnnotation.chapter,
        color: rawAnnotation.color,
        annotatedAt: rawAnnotation.annotatedAt,
        firstImportedAt: existingAnnotation?.firstImportedAt ?? now,
        lastSeenAt: now,
        sourceState: "active",
        contentLimitState: rawAnnotation.contentLimitState,
        rawPayloadHash,
      };
      annotations.push(annotation);
      seenAnnotationIds.add(annotation.id);

      if (existingAnnotation) updatedAnnotations++;
      else {
        createdAnnotations++;
        userStates.push({
          annotationId: annotation.id,
          processStatus: "inbox",
          importance: "medium",
          agreement: "agree",
          userTags: [],
          userLockedFields: [],
        });
      }

      for (const legacyId of legacyIds) {
        aliases.push({ legacyId, currentId: annotation.id, entityType: "annotation", createdAt: now });
      }
    }
  }

  let missingAnnotations = 0;
  for (const existing of params.existingAnnotations) {
    if (seenAnnotationIds.has(existing.id)) continue;
    const completeMisses = params.completeness === "complete"
      ? existing.consecutiveCompleteMisses + 1
      : existing.consecutiveCompleteMisses;
    const sourceState = completeMisses >= 2 ? "confirmed_missing" : completeMisses === 1 ? "source_missing" : existing.sourceState;
    if (sourceState !== "active") missingAnnotations++;
    annotations.push({
      ...existing,
      consecutiveCompleteMisses: completeMisses,
      sourceState,
    });
  }

  for (const existing of params.existingBooks) {
    if (!books.some((book) => book.id === existing.id)) books.push(existing);
  }

  return {
    books,
    annotations,
    userStates: Array.from(new Map(userStates.map((state) => [state.annotationId, state])).values()),
    aliases,
    createdAnnotations,
    updatedAnnotations,
    missingAnnotations,
  };
}
