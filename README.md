# Hakim (حَكِيم): Personal Reading Intelligence System

> *From Kindle highlights to understanding you can use.*

**Hakim (حَكِيم)** is a local-first personal reading intelligence system. It reliably captures your complete Kindle reading history (from Amazon Cloud Notebook, USB `My Clippings.txt`, and HTML exports), saves it to an authoritative local SQLite database, and projects it into:
1. **Notion Reading OS**: 7 connected relational databases for active reflection, concept linking, spaced recall, and action tracking.
2. **Obsidian / Markdown Vault**: Clean, portable `.md` files with YAML frontmatter, wikilinks, and tags.
3. **Reading Intelligence Pipeline**: Grounded, schema-validated AI summaries, active recall questions, and reflection prompts (in Arabic and English).

---

## 🏛️ System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ Chromium Browser (Chrome / Edge / Brave)                    │
│  └── apps/extension (Manifest V3)                           │
│        • In-session fetching for read.amazon.com/notebook   │
│        • Zero credential/cookie transmission                │
│        • Auto-scheduling & popup dashboard                  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Paired HTTP (Token Auth)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Hakim Local Engine (127.0.0.1:4242)                         │
│  ├── Ingestion & Parser Adapters (Cloud, Clippings, HTML)   │
│  ├── Deduplication & Normalization Service                  │
│  ├── SQLite Authoritative Database (WAL Mode)               │
│  ├── Notion Sync Worker (Paced 3 req/s, 2-Way Protection)   │
│  ├── Obsidian / Markdown Vault Exporter                    │
│  └── Reading Intelligence Pipeline (Structured LLM Tasks)   │
└──────────────────────┬──────────────────────────────┬───────┘
                       │                              │
                       ▼                              ▼
          ┌─────────────────────────┐   ┌─────────────────────────┐
          │ Notion Workspace        │   │ Local Filesystem        │
          │ (7 Connected DBs)       │   │ (Obsidian Vault .md)    │
          └─────────────────────────┘   └─────────────────────────┘
```

---

## 📦 Monorepo Packages & Apps

| Directory | Package / App | Purpose |
| :--- | :--- | :--- |
| `apps/extension` | **Hakim Browser Extension** | Manifest V3 extension for Kindle Cloud Notebook scraping & sync. |
| `apps/engine` | **Hakim Engine & CLI** | Local REST API server, SQLite persistence, and CLI runner. |
| `packages/domain` | `@hakim/domain` | Pure TypeScript entities, Zod schemas, deterministic ID hashing. |
| `packages/kindle-import` | `@hakim/kindle-import` | Parsers for `My Clippings.txt`, Kindle HTML exports, and Cloud envelopes. |
| `packages/notion-sync` | `@hakim/notion-sync` | Notion 7-database schema provisioner & field-ownership reconciler. |
| `packages/markdown-export` | `@hakim/markdown-export` | Formatter & exporter for Obsidian vaults (`.md` + Frontmatter). |
| `packages/intelligence` | `@hakim/intelligence` | Provider-neutral structured LLM engine with grounding safeguards. |
| `packages/prompts` | `@hakim/prompts` | Versioned prompt templates (Arabic & English). |
| `packages/test-fixtures` | `@hakim/test-fixtures` | Sanitized golden Kindle fixtures and edge cases. |

---

## 🚀 Quick Start Guide

### 1. Start the Hakim Local Engine
```bash
# Start the loopback server on http://127.0.0.1:4242
pnpm --filter @hakim/engine start
```

### 2. Generate a Pairing Token
```bash
# Generate a high-entropy pairing token for the extension
node apps/engine/dist/cli.js token
```

### 3. Load the Browser Extension
1. Open Chrome/Edge and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select `d:/Projects/Hakim/apps/extension`.
4. Click the **Hakim icon** in your toolbar:
   - Paste your **Pairing Token** into the settings section.
   - Select your Amazon region (e.g. `read.amazon.com`).
   - Click **Save Configuration**.
   - Click **⚡ Sync Highlights Now**!

### 4. Offline Imports (`My Clippings.txt` or HTML exports)
```bash
# Import My Clippings.txt from your physical Kindle over USB
node apps/engine/dist/cli.js import-clippings /path/to/My\ Clippings.txt

# Import a Kindle HTML notebook export
node apps/engine/dist/cli.js import-html /path/to/Notebook.html
```

---

## 🛡️ Invariants & Guarantees

* **Zero Credential Transmission**: The browser extension uses your active browser session; Amazon passwords and cookies never leave your browser.
* **100% Data Preservation**: User notes, personal ratings, and status edits made in Notion or Hakim are **never overwritten** by Kindle re-syncs.
* **Text Alone is Never Identity**: Identical quotations across different books or locations produce distinct, stable IDs.
* **Offline Sovereignty**: SQLite is the authoritative source of truth. You can export your entire library to Obsidian Markdown files anytime.

---

## 🧪 Verification & Tests

Run the full verification suite:
```bash
pnpm verify
```
Runs strict TypeScript typechecking, linting, and all 30 unit & integration test suites.
