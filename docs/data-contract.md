# Data Contract & Entity Schemas: Hakim (حَكِيم)

## Core Entities

### 1. Book
Represents a literary work in the user's library.
* `id`: UUID (v4/v5 deterministic)
* `sourceBookKey`: Stable namespaced key (e.g. `amzn:us:B005DOK8TK`)
* `asin`: Optional Amazon Standard Identification Number
* `sourceTitle`: Exact title reported by source
* `displayTitle`: Normalized/preferred display title
* `author`: Source author string
* `coverUrl`: URL to cover image if available
* `sourceUrl`: URL to reader/notebook if available
* `lastAnnotatedAt`: ISO8601 timestamp of most recent annotation
* `sourceKinds`: Array of sources discovered (`kindle_cloud`, `my_clippings`, `kindle_html`)
* `sourceState`: `active` | `limited` | `source_missing` | `confirmed_missing`
* `firstSeenAt`: ISO8601 timestamp
* `lastSeenAt`: ISO8601 timestamp

### 2. Annotation
Represents an individual highlight, note, or bookmark.
* `id`: UUID (deterministic hash of Book ID + Type + Location Range + Text Hash)
* `bookId`: UUID of parent Book
* `sourceAnnotationKey`: Provider's native key when present
* `sourceKind`: `kindle_cloud` | `my_clippings` | `kindle_html`
* `type`: `highlight` | `note` | `bookmark`
* `rawText`: Exact, unaltered text from source
* `normalizedText`: Normalized whitespace and unicode for matching
* `sourceNote`: Accompanying user note from Kindle if present
* `locationStart`: Integer location start
* `locationEnd`: Integer location end
* `page`: Optional printed page number
* `chapter`: Optional chapter / section heading
* `color`: `yellow` | `blue` | `pink` | `orange` | `default`
* `annotatedAt`: ISO8601 timestamp from source
* `contentLimitState`: `normal` | `publisher_clipped` | `truncated`
* `rawPayloadHash`: SHA-256 hash of the source payload

### 3. AnnotationUserState
Represents the user's cognitive engagement with an annotation.
* `annotationId`: UUID of target Annotation
* `processStatus`: `inbox` | `processed` | `discarded`
* `importance`: `low` | `medium` | `high` | `essential`
* `personalInterpretation`: User's explanation and reflection in their own words
* `agreement`: `agree` | `unsure` | `disagree`
* `userTags`: Array of user-defined tags
* `notionPageId`: Notion block/page UUID
* `notionLastPulledAt`: Timestamp of last Notion sync
* `userLockedFields`: Array of field names locked against automated updates

### 4. IntelligenceDraft
Represents structured AI enrichment proposals.
* `id`: UUID
* `annotationId`: Optional UUID
* `bookId`: Optional UUID
* `taskType`: `classification` | `claim_extraction` | `question_generation` | `concept_connect` | `contradiction_detect` | `book_synthesis`
* `promptVersion`: String (e.g. `claim.v1`)
* `model`: Model name used (e.g. `gemini-2.5-pro`, `gpt-4o`)
* `inputHash`: Hash of source text + context
* `structuredOutput`: JSON payload adhering to task output schema
* `confidence`: Float 0.0 - 1.0
* `groundingWarnings`: Array of warning strings if grounding checks flagged potential extrapolation
* `status`: `draft` | `approved` | `rejected` | `stale`
* `createdAt`: ISO8601 timestamp

### 5. SyncRun & SyncEvent
Provides an audit ledger of all sync operations.
* `id`: UUID
* `source`: `kindle_cloud` | `my_clippings` | `kindle_html` | `notion` | `obsidian`
* `status`: `started` | `in_progress` | `completed` | `failed` | `partial`
* `booksDiscovered`: Count
* `annotationsDiscovered`: Count
* `createdCount`: Count
* `updatedCount`: Count
* `errorCount`: Count
* `startedAt`: ISO8601 timestamp
* `completedAt`: Optional ISO8601 timestamp
