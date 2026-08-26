# Hakim (حَكِيم): Product Specification

**Version**: 1.0  
**Name**: Hakim (حَكِيم): *Transforming reading into actionable wisdom and understanding.*

## 1. Executive Summary

Hakim is a local-first personal reading intelligence system. It imports your complete available Kindle annotation history (from Amazon Cloud Notebook, USB `My Clippings.txt`, and HTML exports), deduplicates and stores it in an authoritative local SQLite database, and projects it into:
1. **Notion Reading OS**: A 7-database relational ecosystem for active reflection, concept synthesis, spaced recall, and real-world application tracking.
2. **Obsidian / Markdown Vault**: Clean, portable `.md` files with YAML frontmatter, wikilinks, and tags for local offline archival and graph visualization.
3. **Reading Intelligence Pipeline**: Grounded, schema-validated AI drafts (English & Arabic) that generate recall questions, distill claims, map concepts, and highlight contradictions without modifying source text.

## 2. Ingestion & Sync Boundaries

Amazon provides no public API for Kindle annotations. Hakim resolves this reliably through:
- **Hakim Chromium Extension (Manifest V3)**: Fetches `read.amazon.com/notebook` using the user's active browser session. Cookies and passwords never leave the browser.
- **Offline Importers**: Direct local parsing of `My Clippings.txt` (USB) and Kindle HTML email notebooks.
- **Local Engine (127.0.0.1)**: Runs on loopback, stores all raw data in SQLite, reconciles multi-source annotations, and coordinates pushes/pulls with Notion and Obsidian.

## 3. Notion Reading OS Databases

Hakim provisions and manages 7 connected databases in Notion:
1. **Books**: Title, Author, ASIN, Cover, Reading Status, Rating, Synthesis Status, Relations to Highlights & Learning Paths.
2. **Highlights**: Exact quote, Kindle location, page, chapter, color, source, user Process Status, Importance, Personal Interpretation, Agreement, AI suggested claims & questions.
3. **Concepts**: Working definitions, mastery score, relations to highlights, supporting/contradicting insights.
4. **Insights**: Durable synthesized ideas in the user's own words, claims, evidence, confidence, and stage.
5. **Learning Paths**: Structured curricula (e.g. Staff SWE, Islamic Learning, Wealth) tracking books, concepts, and review progress.
6. **Reviews**: Daily recall questions, weekly synthesis, book completion reflections, and recall scores.
7. **Applications**: Practical action items, hypotheses, planned actions, target dates, and observed outcomes.

## 4. Field Ownership & Synchronization Invariants

- **Source-owned** (Kindle): Exact quote text, Kindle note, location, page, chapter, color, annotated date.
- **User-owned** (Notion/Obsidian): Personal interpretation, process status, importance, agreement, rating, learning path links, concept definitions, action outcomes.
- **AI-draft-owned**: Suggested claims, reflection questions, candidate concept matches. Only refreshed if `AI Locked` is false and input changed.
- **Derived**: Rollups, formulas, health indicators, counts.

Reconciliation Rule: User-owned edits in Notion are always pulled first into SQLite and protected; Kindle re-syncs will NEVER overwrite user notes or personal status.

## 5. Non-Goals for V1
- Writing annotations back into Kindle (unsupported by Amazon).
- Bypassing publisher clipping limits.
- Multi-user hosted SaaS accounts.
- Cloud server dependencies (system is 100% local-first).
