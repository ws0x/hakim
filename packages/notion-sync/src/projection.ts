import { computePayloadHash, type AnnotationUserState, type LocalAnnotationRecord, type LocalBookRecord } from "@hakim/domain";
import { BOOK_PROPERTY_NAMES, HIGHLIGHT_PROPERTY_NAMES } from "./core-schema.js";

export interface RichTextItem {
  type: "text";
  text: { content: string };
}

export function toRichText(value: string | undefined): RichTextItem[] {
  if (!value) return [];
  const chunks: RichTextItem[] = [];
  for (let index = 0; index < value.length; index += 2_000) {
    chunks.push({ type: "text", text: { content: value.slice(index, index + 2_000) } });
  }
  return chunks;
}

function displaySourceState(value: LocalBookRecord["sourceState"] | LocalAnnotationRecord["sourceState"]): string {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function mapBookSourceProperties(book: LocalBookRecord, now: string): Record<string, unknown> {
  return {
    [BOOK_PROPERTY_NAMES.sourceTitle]: { rich_text: toRichText(book.sourceTitle) },
    [BOOK_PROPERTY_NAMES.hakimId]: { rich_text: toRichText(book.id) },
    [BOOK_PROPERTY_NAMES.asin]: { rich_text: toRichText(book.asin) },
    [BOOK_PROPERTY_NAMES.author]: { rich_text: toRichText(book.author) },
    [BOOK_PROPERTY_NAMES.kindleUrl]: { url: book.sourceUrl ?? null },
    [BOOK_PROPERTY_NAMES.lastAnnotated]: { date: book.lastAnnotatedAt ? { start: book.lastAnnotatedAt } : null },
    [BOOK_PROPERTY_NAMES.sourceHash]: { rich_text: toRichText(bookSourceHash(book)) },
    [BOOK_PROPERTY_NAMES.syncState]: { select: { name: displaySourceState(book.sourceState) } },
    [BOOK_PROPERTY_NAMES.lastSynced]: { date: { start: now } },
  };
}

export function bookSourceHash(book: LocalBookRecord): string {
  return computePayloadHash(JSON.stringify({
    sourceTitle: book.sourceTitle,
    asin: book.asin ?? null,
    author: book.author,
    sourceUrl: book.sourceUrl ?? null,
    lastAnnotatedAt: book.lastAnnotatedAt ?? null,
    sourceState: book.sourceState,
  }));
}

export function mapBookCreateProperties(book: LocalBookRecord, now: string): Record<string, unknown> {
  return {
    [BOOK_PROPERTY_NAMES.title]: { title: toRichText(book.displayTitle) },
    ...mapBookSourceProperties(book, now),
  };
}

export function mapHighlightSourceProperties(
  annotation: LocalAnnotationRecord,
  bookPageId: string,
  _bookTitle: string,
  now: string,
): Record<string, unknown> {
  const locationLabel = annotation.locationStart !== undefined ? `Loc ${annotation.locationStart}` : "Highlight";
  return {
    [HIGHLIGHT_PROPERTY_NAMES.title]: {
      title: toRichText(`${locationLabel}: ${annotation.rawText.slice(0, 72)}`.slice(0, 100)),
    },
    [HIGHLIGHT_PROPERTY_NAMES.hakimId]: { rich_text: toRichText(annotation.id) },
    [HIGHLIGHT_PROPERTY_NAMES.book]: { relation: [{ id: bookPageId }] },
    [HIGHLIGHT_PROPERTY_NAMES.quote]: { rich_text: toRichText(annotation.rawText) },
    [HIGHLIGHT_PROPERTY_NAMES.kindleNote]: { rich_text: toRichText(annotation.sourceNote) },
    [HIGHLIGHT_PROPERTY_NAMES.locationStart]: { number: annotation.locationStart ?? null },
    [HIGHLIGHT_PROPERTY_NAMES.locationEnd]: { number: annotation.locationEnd ?? null },
    [HIGHLIGHT_PROPERTY_NAMES.page]: { number: annotation.page ?? null },
    [HIGHLIGHT_PROPERTY_NAMES.chapter]: { rich_text: toRichText(annotation.chapter) },
    [HIGHLIGHT_PROPERTY_NAMES.color]: { select: { name: annotation.color } },
    [HIGHLIGHT_PROPERTY_NAMES.annotatedAt]: { date: annotation.annotatedAt ? { start: annotation.annotatedAt } : null },
    [HIGHLIGHT_PROPERTY_NAMES.contentLimit]: { select: { name: annotation.contentLimitState } },
    [HIGHLIGHT_PROPERTY_NAMES.sourceHash]: { rich_text: toRichText(annotation.rawPayloadHash) },
    [HIGHLIGHT_PROPERTY_NAMES.sourceState]: { select: { name: displaySourceState(annotation.sourceState) } },
    [HIGHLIGHT_PROPERTY_NAMES.lastSynced]: { date: { start: now } },
  };
}

export function mapInitialUserProperties(userState?: AnnotationUserState): Record<string, unknown> {
  return {
    [HIGHLIGHT_PROPERTY_NAMES.processStatus]: { select: { name: capitalize(userState?.processStatus ?? "inbox") } },
    [HIGHLIGHT_PROPERTY_NAMES.importance]: { select: { name: capitalize(userState?.importance ?? "medium") } },
    [HIGHLIGHT_PROPERTY_NAMES.interpretation]: { rich_text: toRichText(userState?.personalInterpretation) },
    [HIGHLIGHT_PROPERTY_NAMES.agreement]: { select: { name: capitalize(userState?.agreement ?? "agree") } },
    [HIGHLIGHT_PROPERTY_NAMES.tags]: {
      multi_select: (userState?.userTags ?? []).map((name) => ({ name })),
    },
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
