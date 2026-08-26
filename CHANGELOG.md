# Changelog

All notable changes to the **Hakim: Kindle Reading Intelligence** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-08-26

### Added
- **Modern Landing Page**: High-conversion dark obsidian landing page with live interactive Hero simulation, 3-step tabbed installation guide, feature cards, and Readwise comparison matrix.
- **Visual Reading Web Client & Topology Engine**:
  - **Interactive 2D Force-Directed Knowledge Graph**: Hardware-accelerated canvas physics engine with Pan/Zoom, Coulomb node repulsion, Hooke spring attraction, and dynamic search reflow.
  - **Reading OS Card Grid & Books Shelf**: Multi-column responsive cards with color tags, location pills, and importance indicators.
  - **Reading OS Kanban Board**: 3-column reading workflow hub (`Currently Reading`, `Completed`, `Want to Read`) with reactive status updates.
  - **Slide-over Reading Detail Drawer**: Fast slide-out drawer with full quote context, personal notes, reflections, and Markdown citation exporter.
  - **Social Quote Card Generator**: Real-time canvas artboard renderer with theme presets (*Obsidian*, *Sunset*, *Emerald*, *Minimal*), multi-aspect ratio framing (`1:1`, `9:16`, `16:9`), and high-res PNG downloads.
  - **3D Active Recall Flashcard Deck**: Spaced repetition review engine with 3D card flips, keyboard navigation (`Space`, `1`, `2`, `3`), retention analytics, and study restart.

---

## [1.2.2] - 2026-08-26

### Fixed
- **Manual Sync Cache Bypass (`forceFullSync`)**: Clicking **Sync Highlights to Notion** in the popup now executes a full live scan without being blocked by time-window caching.
- **Notion Book Page Body Content Syncing**: Highlights and personal notes are now automatically written directly into the Book page body in Notion (`PATCH /v1/blocks/{bookPageId}/children`), ensuring quotes are visible when opening the book in Notion.
- **Reciprocal Relation Schema Patching**: `ensureDatabaseRelations` dynamically checks and patches the Books database schema to verify the two-way relation exists even on existing/reset databases.
- **Reset Database Connection Option**: Added a one-click action to reset cached database IDs and sync tokens.

---

## [1.2.1] - 2026-08-26

### Fixed
- **Multilingual HTML Entity Decoding**: Added robust decoding for named (`&laquo;`, `&raquo;`, `&quot;`, `&#39;`, `&hellip;`) and numeric HTML entities across Arabic and multilingual texts.
- **Two-Way Notion Database Relations**: Database provisioner now establishes reciprocal backlinks (`dual_property: { synced_property_name: "Highlights" }`), ensuring all highlights for a book render automatically on the Book's Notion page.
- **Structured Highlight Titles**: Highlight records in Notion now use structured `Loc [N] — "First words..."` titles instead of raw truncated quotes.
- **Semantic Highlight Color UX**: Converted raw color tags into meaningful reading taxonomy (`Yellow (Key Insight)`, `Blue (Quote / Fact)`, `Pink (Critical / Action)`, `Orange (Concept / Story)`).
- **Intelligent Checkpointing & Cache**: Added 15-minute smart caching to skip unchanged books, reducing repeated re-sync times from minutes to under 2 seconds.

---

## [1.2.0] - 2026-08-26

### Added
- **Autonomous Background Auto-Sync (Readwise-style)**:
  - Automatic scheduled syncing via `chrome.alarms` with configurable intervals (`Every 6 Hours`, `12 Hours`, `24 Hours`, `1 Hour`, or `Manual`).
  - Browser startup trigger via `chrome.runtime.onStartup` to automatically sync highlights when opening Chrome each morning.
  - Active toolbar sync badge (`SYNC`) and warning badges (`!`) for expired sessions.
  - Native OS desktop notifications for background sync completions.

---

## [1.1.1] - 2026-08-26

### Fixed
- **Multi-Book Library Sidebar Scraper**: Fixed regex containment lookahead that previously truncated the book list at the first closing `</div>`, enabling discovery of all books in the library.
- **Kindle Highlight Pagination**: Added automated `token` and `nextPageStart` multi-page loop, pulling all 100+ highlights across all pages for every book.

---

## [1.1.0] - 2026-08-26

### Added
- **Standalone Cloud Synchronization**: Direct browser-to-Notion syncing without requiring Node.js, CLI, or background engine server.
- **Comprehensive 12+ Field Mapping**: Complete customizable column mapping for both Books database (`Title`, `Author`, `ASIN`, `Kindle URL`, `Last Annotated`) and Highlights database (`Name`, `Book`, `Quote`, `Kindle Note`, `Location`, `Page`, `Chapter`, `Color`, `Importance`, `Process Status`, `My Interpretation`).
- **Live Progress Broadcasting**: Real-time progress bar tracking exact book name, current index, total books, and percentage.
- **Bespoke Vector Logo & Multi-Resolution Icons**: High-fidelity matching SVG logo and PNG icon suite (`16x16`, `32x32`, `48x48`, `128x128`).
- **Tactile UI Controls**: Inline label/input layout, show/hide password toggle, and slide-in toast notifications.
- **Automated Versioning Tool**: Added `pnpm bump:patch`, `pnpm bump:minor`, and `pnpm bump:major` release scripts.

### Changed
- **Multi-Book Kindle Isolation**: Scraper now discovers all books from the Kindle Cloud sidebar and fetches individual book highlights with proper request headers, preventing cross-book highlight mixing.
- **Paginated Notion Queries**: Sync pipeline queries Notion using cursors to support libraries with >100 highlights without truncating.
- **Universal Text Selection**: Enabled `user-select: text` across all popup UI elements.
- **Nomenclature Polish**: Removed all em dashes (`—`) and Arabic text for clean, standardized English branding.

### Fixed
- Fixed 15% sync freeze caused by unhandled exceptions in database discovery.
- Fixed Notion API relation schema property formatting in `POST /v1/databases`.
- Fixed highlight row separator lookahead regex preserving color CSS classes.
- Fixed highlight deduplication to ensure user reflections and interpretations are never overwritten during re-syncs.

---

## [1.0.0] - 2026-08-26

### Added
- Initial release of Hakim reading intelligence system.
- Authoritative local SQLite engine with WAL mode and foreign key constraints.
- Ingestion pipeline with deterministic composite UUIDv5-style identifier hashing.
- Offline file parsers for USB `My Clippings.txt` and Kindle HTML notebook exports.
- 7-database Notion Reading OS provisioner and reconciler.
- Obsidian Markdown vault export with YAML frontmatter.
- Bilingual grounded AI claim extraction and active recall question generation.
- Chromium Manifest V3 browser extension with pairing token authentication.
