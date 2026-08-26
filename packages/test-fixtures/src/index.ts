import type { ImportEnvelope } from "@hakim/domain";

/**
 * 1. Standard English Kindle Cloud Envelope
 */
export const englishCloudEnvelope: ImportEnvelope = {
  version: "1.0",
  sourceKind: "kindle_cloud",
  importedAt: "2026-08-26T10:00:00.000Z",
  books: [
    {
      sourceBookKey: "amzn:us:B005DOK8TK",
      asin: "B005DOK8TK",
      sourceTitle: "The Effective Engineer (Kindle Edition)",
      author: "Lau, Edmond",
      coverUrl: "https://m.media-amazon.com/images/I/51abc.jpg",
      sourceUrl: "https://read.amazon.com/notebook?asin=B005DOK8TK",
      lastAnnotatedAt: "2026-08-20T14:32:00.000Z",
      annotations: [
        {
          sourceAnnotationKey: "amzn:annot:001",
          type: "highlight",
          rawText: "Focus on high-leverage activities that produce outsized value per unit time.",
          locationStart: 120,
          locationEnd: 125,
          page: 14,
          chapter: "Chapter 1: Focus on High Leverage",
          color: "yellow",
          annotatedAt: "2026-08-20T14:30:00.000Z",
          contentLimitState: "normal",
        },
        {
          sourceAnnotationKey: "amzn:annot:002",
          type: "highlight",
          rawText: "Invest heavily in your iteration speed and continuous automated testing.",
          sourceNote: "Key takeaway for engineering workflow optimization.",
          locationStart: 450,
          locationEnd: 455,
          page: 48,
          chapter: "Chapter 3: Optimize for Iteration Speed",
          color: "blue",
          annotatedAt: "2026-08-20T14:32:00.000Z",
          contentLimitState: "normal",
        },
      ],
    },
  ],
};

/**
 * 2. Arabic & Localized Metadata Envelope
 */
export const arabicCloudEnvelope: ImportEnvelope = {
  version: "1.0",
  sourceKind: "kindle_cloud",
  importedAt: "2026-08-26T10:00:00.000Z",
  books: [
    {
      sourceBookKey: "amzn:us:B08XYZ999",
      asin: "B08XYZ999",
      sourceTitle: "صيد الخاطر (طبعة كيندل)",
      author: "ابن الجوزي",
      sourceUrl: "https://read.amazon.com/notebook?asin=B08XYZ999",
      lastAnnotatedAt: "2026-08-21T09:15:00.000Z",
      annotations: [
        {
          sourceAnnotationKey: "amzn:annot:ar01",
          type: "highlight",
          rawText: "العاقل من حاسب نفسه وميز بين ما ينفعه وما يضره، ورتب وقته لأولوياته.",
          locationStart: 102,
          locationEnd: 106,
          page: 25,
          chapter: "فصل في حفظ الوقت",
          color: "yellow",
          annotatedAt: "2026-08-21T09:15:00.000Z",
          contentLimitState: "normal",
        },
      ],
    },
  ],
};

/**
 * 3. Same quotation text at two DIFFERENT locations in the same book
 * Invariant: Must produce two distinct annotation records with separate IDs.
 */
export const duplicateQuoteDifferentLocations: ImportEnvelope = {
  version: "1.0",
  sourceKind: "kindle_cloud",
  importedAt: "2026-08-26T10:00:00.000Z",
  books: [
    {
      sourceBookKey: "amzn:us:B001TEST01",
      asin: "B001TEST01",
      sourceTitle: "Thinking in Systems",
      author: "Meadows, Donella",
      annotations: [
        {
          type: "highlight",
          rawText: "The system always seeks balance.",
          locationStart: 145,
          locationEnd: 148,
          page: 22,
          color: "yellow",
          contentLimitState: "normal",
        },
        {
          type: "highlight",
          rawText: "The system always seeks balance.",
          locationStart: 890,
          locationEnd: 893,
          page: 110,
          color: "pink",
          contentLimitState: "normal",
        },
      ],
    },
  ],
};

/**
 * 4. Content Limit / Publisher Clipped State
 */
export const clippingLimitEnvelope: ImportEnvelope = {
  version: "1.0",
  sourceKind: "kindle_cloud",
  importedAt: "2026-08-26T10:00:00.000Z",
  books: [
    {
      sourceBookKey: "amzn:us:B00CLIPPED",
      asin: "B00CLIPPED",
      sourceTitle: "Copyrighted Text Example",
      author: "Author, Protected",
      annotations: [
        {
          type: "highlight",
          rawText: "<You have reached the clipping limit for this item>",
          locationStart: 1200,
          locationEnd: 1205,
          color: "yellow",
          contentLimitState: "publisher_clipped",
        },
      ],
    },
  ],
};

/**
 * 5. Sample Raw My Clippings.txt content
 */
export const rawMyClippingsSample = `
Designing Data-Intensive Applications (Martin Kleppmann)
- Your Highlight on Location 512-514 | Added on Thursday, August 15, 2026 8:42:10 PM

Reliability means making systems work correctly, even when faults occur.
==========
Designing Data-Intensive Applications (Martin Kleppmann)
- Your Note on Location 514 | Added on Thursday, August 15, 2026 8:43:05 PM

Fault tolerance vs failure prevention.
==========
قواعد في تحصيل العلم (عبد العزيز السدحان)
- Your Highlight on Page 12 | Location 145-148 | Added on Friday, August 16, 2026 10:11:00 AM

العلم صيد والكتابة قيده، قيد صيودك بالحبال الواثقة.
==========
`.trim();

/**
 * 6. Sample Raw HTML Export
 */
export const rawKindleHtmlSample = `
<!DOCTYPE html>
<html>
<head><title>Kindle Notebook Export</title></head>
<body>
  <div class="bookTitle">Staff Engineer: Leadership beyond the management track</div>
  <div class="authors">Will Larson</div>
  <div class="sectionHeading">Operating as a Staff Engineer</div>
  <div class="noteHeading">Highlight (Yellow) - Location 320</div>
  <div class="noteText">Staff engineers must focus on setting technical direction and mentoring others.</div>
</body>
</html>
`.trim();
