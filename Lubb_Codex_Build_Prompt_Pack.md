# Lubb: Codex Build Prompt Pack

Version: 1.0  
Companion specification: `Lubb_Product_and_Architecture_Plan.md`

## How to use this pack

Do not give Codex every implementation prompt at once.

1. Create a new Git repository for Lubb.
2. Add the approved product specification as `docs/product-spec.md`.
3. Add `Lubb_AGENTS.md` as the repository-root `AGENTS.md`.
4. Start with the Master Goal.
5. Give Codex one phase prompt at a time in the same goal/chat.
6. Review the phase verification evidence before advancing.
7. If a phase exposes an architectural problem, update the specification and decision record before continuing.

The prompts intentionally state outcome, constraints, verification and stopping criteria. This is more reliable than a single giant “build the app” prompt.

## Master Goal

```text
/goal

Build Lubb, a local-first personal Kindle-to-Notion reading intelligence system, according to `docs/product-spec.md` and the repository `AGENTS.md`.

Outcome:
- A Chromium Manifest V3 extension imports complete available Kindle Cloud Notebook annotations using the user's existing Amazon browser session.
- A loopback-only local engine imports cloud payloads, My Clippings.txt and Kindle HTML exports into an authoritative SQLite database.
- A controlled bidirectional Notion projection creates the Reading OS databases and synchronizes fields according to explicit ownership rules.
- A versioned, grounded AI pipeline creates reviewable reading-intelligence drafts without modifying source text.
- The repository includes fixtures, deterministic evaluations, security checks, documentation, backup/restore and a reproducible end-to-end verification path.

Constraints:
- Never request, read, export, persist or transmit Amazon passwords or cookie values.
- Do not attempt to write annotations back to Kindle or bypass publisher clipping limits.
- Bind the engine to 127.0.0.1 by default and require extension pairing.
- Keep raw source data separate from user state and AI drafts.
- Never use highlight text alone as identity.
- Never hard-delete records automatically because they are absent from one sync.
- Prefer the smallest maintainable local-first stack; do not introduce cloud infrastructure for V1.
- Preserve strict TypeScript boundaries and runtime validation.
- Treat Notion as a mixed-ownership projection, not as the raw source of truth.

Working method:
1. Read `AGENTS.md` and every required document it references.
2. Inspect the repository before proposing changes.
3. Maintain `docs/progress.md` and an explicit implementation plan.
4. Work phase by phase. Do not implement later phases before the current phase acceptance criteria pass.
5. Make focused changes, run the relevant evaluation after each meaningful change, and record results.
6. Ask only when a missing product decision would materially change behavior. Make reversible engineering decisions independently and record them.

Verification:
- `pnpm verify` passes.
- Importer fixture score is 100% for identity, idempotency and no-data-loss invariants.
- Interrupted and malformed syncs cannot produce deletions.
- Notion user-owned fields survive repeated source syncs.
- AI outputs validate against schema and groundedness thresholds.
- The documented end-to-end test imports a fixture library, syncs it twice without duplicates, edits a user-owned Notion field, pulls it back, changes a source annotation, pushes only source-owned changes, and produces a clean audit report.

Start by performing Phase 0 only. Do not scaffold production applications until Phase 0 contracts and evaluations are complete.
```

## Phase 0 — Evidence, contracts and evaluation harness

```text
Implement Phase 0: evidence, contracts and the evaluation harness.

Before changing files:
- Read `AGENTS.md` and `docs/product-spec.md` completely.
- Inspect the repository and summarize the active constraints in `docs/progress.md`.

Deliverables:
1. Architecture, data-contract, sync-semantics and security documents derived faithfully from the product specification.
2. Architecture decision records for local-first engine, SQLite authority, controlled Notion projection and browser-session-only Amazon access.
3. TypeScript domain types and runtime schemas for Account, Book, Annotation, AnnotationUserState, IntelligenceDraft, ImportEnvelope, SyncRun and SyncEvent.
4. Pure normalization and identity interfaces with no source-specific implementation assumptions.
5. A sanitized fixture corpus covering:
   - English Kindle Cloud Notebook
   - Arabic/localized metadata
   - multiple pages of annotations
   - same text at different locations
   - edited note
   - shortened/expanded highlight
   - My Clippings.txt
   - Kindle HTML export
   - clipping/content limit
   - login/CAPTCHA page
   - malformed and interrupted responses
6. An evaluation CLI that scores book identity, annotation identity, deduplication, cross-source reconciliation and deletion safety.
7. Repository scripts for format, lint, typecheck, unit tests, fixture evaluations, build and verify.

Constraints:
- Do not implement real Amazon or Notion network access.
- Do not select identities based on title or text alone.
- Keep fixtures synthetic or safely sanitized; do not commit copyrighted full-book content or secrets.

Acceptance criteria:
- Reimporting every fixture is idempotent.
- Identical quotation text at two locations remains two annotations.
- Title punctuation or localized metadata does not create a second book when a stronger ID exists.
- One incomplete snapshot produces zero missing/deleted events.
- All runtime schemas reject malformed boundaries with useful errors.
- `pnpm verify` passes.

Return:
- files created or changed
- commands and results
- evaluation score table
- architectural questions discovered
- remaining proof gaps

Stop after Phase 0. Do not start Phase 1.
```

## Phase 1 — Local engine and offline importers

```text
Implement Phase 1: the loopback-only Lubb Engine, SQLite persistence, My Clippings.txt importer and Kindle HTML importer.

First verify that Phase 0 acceptance criteria still pass. If they do not, fix Phase 0 before adding behavior.

Deliverables:
1. Local engine service bound to 127.0.0.1 with explicit configurable port.
2. SQLite migrations, WAL mode, repositories and transaction boundaries.
3. Pairing-token creation, rotation and authenticated extension-facing API.
4. Import endpoints using the shared ImportEnvelope schema.
5. My Clippings parser that handles structural delimiters, multiple locales, line endings, encodings, highlights, notes and bookmarks.
6. Kindle HTML parser with chapter and metadata preservation when present.
7. Cross-source reconciliation and ambiguity queue.
8. SyncRun/SyncEvent audit persistence and human-readable sync report.
9. CLI commands for import, status, backup, restore and integrity check.
10. Health endpoint that reveals no secrets or raw content.

Security constraints:
- Reject non-loopback binding unless an explicit development flag is present.
- Store only a hash of the pairing token when practical.
- Redact secrets and authorization headers from logs and errors.
- Apply request size limits and runtime validation.

Acceptance criteria:
- Importing the same files repeatedly creates no duplicates.
- A crash or validation failure rolls back the current transaction safely.
- Ambiguous cross-source matches are retained for review, not guessed.
- Backup followed by restore reproduces all source, user and sync records.
- All Phase 0 fixture evaluations remain at target.
- `pnpm verify` passes.

Add or update a clean-start runbook. Stop after Phase 1.
```

## Phase 2 — Kindle Cloud Notebook extension

```text
Implement Phase 2: the Chromium Manifest V3 Kindle Cloud Notebook connector.

Research requirement:
- Before coding network behavior, inspect the current Kindle Notebook in an authenticated test session available to the user or use only sanitized captured fixtures.
- Record observed endpoints, pagination fields, selectors, regions and failure pages in a dated adapter note.
- Do not infer unsupported current behavior from old open-source implementations without a fixture or live observation.

Deliverables:
1. Extension setup and regional host-permission flow.
2. Pairing with the loopback engine.
3. Authentication-state detection without reading or serializing cookie values.
4. Library discovery that handles lazy loading or pagination and does not stop silently at the initially rendered books.
5. Changed-book prioritization using stable source metadata.
6. Per-book annotation fetching with pagination tokens and checkpoints.
7. Parser adapters with semantic fallbacks and validation gates.
8. Manual Sync now, selected-book sync, full resync and cancellation.
9. Scheduled recent-book sync, startup catch-up, weekly integrity scan and bounded retry queue.
10. Clear states for engine offline, Amazon session expired, CAPTCHA/consent, clipping limit, parser drift and partial sync.
11. Minimal progress and diagnostic UI.

Constraints:
- Request only region-specific Kindle Notebook permissions plus the loopback engine origin.
- Do not request broad browsing history or general Amazon access unless verified functionality requires it and the user approves the documented reason.
- Never send cookies, passwords or raw Amazon authorization material to the engine.
- A partial book fetch cannot commit a complete source snapshot.
- Do not attempt to bypass content-export limits.

Acceptance criteria:
- Fixture-based full library import passes.
- Multi-page book annotations import completely.
- Interrupted fetch resumes without duplicates.
- Login and CAPTCHA fixtures are detected before parsing.
- Previously imported data is unchanged after a simulated Amazon markup failure.
- Startup and alarm scheduling tests pass with fake clocks.
- Permission audit matches the documented minimum.
- `pnpm verify` passes.

Produce a manual test checklist for Yusuf's actual Amazon region and stop after Phase 2.
```

## Phase 2B — Live importer verification and repair loop

```text
Run Phase 2B as an eval-driven importer verification loop against Yusuf's authorized Kindle Notebook session.

Safety:
- Read-only access only.
- Do not print, save or transmit session cookies or passwords.
- Do not commit raw personal highlights to Git.
- Store any temporary diagnostic HTML locally, sanitized by default, and list it in .gitignore.

Loop:
1. Run a dry synchronization that writes only to a temporary database.
2. Compare discovered book and annotation counts with what the Kindle Notebook UI reports.
3. Inspect failures by category: library discovery, book identity, pagination, annotation parsing, note association, region/localization or content limit.
4. Add a sanitized minimal regression fixture for each failure.
5. Make one focused adapter improvement.
6. Re-run fixture evaluations, then the dry synchronization.
7. Record counts and changes in `docs/importer-eval-log.md`.

Stopping rule:
- All visible test books are discovered.
- Every fully exportable test book reconciles its visible annotation count.
- Content-limited books are detected and explicitly reported.
- Two consecutive dry runs produce zero unexpected creates or duplicates.
- No high-severity parser or security issue remains.

Return the final scorecard and remaining Amazon limitations. Do not begin Notion work in this phase.
```

## Phase 3 — Notion schema provisioner

```text
Implement the Notion Reading OS schema provisioner according to `docs/product-spec.md`.

Before coding:
- Verify the current official Notion API version and data-source terminology.
- Document API limitations, especially database-view creation, rate limits, relations and content updates.

Deliverables:
1. Secure local Notion integration configuration and connectivity test.
2. Idempotent provisioner for Books, Highlights, Concepts, Insights, Learning Paths, Reviews and Applications.
3. Stable local mapping from Lubb entities and properties to Notion page, data-source and property IDs.
4. Relation creation in dependency-safe order.
5. Schema drift detector that reports changes and never destructively rewrites user schema.
6. Setup guide and checklist for dashboard views the API cannot create.
7. Seed command for Yusuf's initial learning paths without overwriting existing ones.

Constraints:
- Pin an explicit current Notion API version.
- Keep the schema within documented size and request limits.
- Do not store the Notion token in the browser extension.
- Do not assume property names remain stable; persist property IDs after provisioning.
- Do not delete unknown user-added properties.

Acceptance criteria:
- Running provisioning twice produces no duplicates or destructive changes.
- Every relation resolves correctly.
- A renamed user-facing property is detected and safely mapped by ID.
- Missing permissions generate precise remediation instructions.
- Rate-limit test doubles prove Retry-After handling.
- `pnpm verify` passes.

Stop before syncing real highlight records.
```

## Phase 4 — Controlled two-way Notion synchronization

```text
Implement controlled bidirectional synchronization between SQLite and the provisioned Notion Reading OS.

Deliverables:
1. Explicit property-ownership registry: source, user, AI draft and derived.
2. Pull phase for changed Notion pages and user-owned properties.
3. Push phase for source-owned changes and unlocked AI drafts.
4. Idempotent Notion page upserts keyed by immutable Lubb IDs.
5. SQLite durable job table with idempotency key, attempt count, next attempt, Retry-After support and dead-letter state.
6. Incremental synchronization using last edited timestamps plus periodic full reconciliation.
7. Handling for trashed, restored, duplicated and manually moved Notion pages.
8. Per-run report showing source changes, user changes, conflicts, retries and unresolved records.

Conflict rules:
- Pull user-owned fields before pushing source changes.
- Never replace a complete mixed-ownership page body.
- Never overwrite AI Locked fields.
- Never interpret a missing or inaccessible Notion page as permission to delete local data.
- Require explicit user action for ambiguous duplicates.

Acceptance scenario:
1. Import a fixture library and push it to Notion.
2. Repeat the push; expect zero duplicate pages.
3. Edit Process Status, Importance and My Interpretation in Notion.
4. Pull and verify those values in SQLite.
5. Change the source note and color in a fixture.
6. Sync again; source fields update and user fields remain unchanged.
7. Lock an AI field and verify it remains unchanged.
8. Simulate 429 and transient 5xx responses; verify paced retries.

All acceptance steps must be automated with a fake Notion adapter and documented for an optional sandbox workspace test. Stop after Phase 4.
```

## Phase 5 — Reading intelligence prompt system

```text
Implement the versioned reading-intelligence prompt system and evaluation harness.

Deliverables:
1. Provider-neutral model interface and structured-output executor.
2. Versioned global grounding prompt.
3. Versioned task prompts for:
   - annotation classification
   - claim extraction
   - recall and reflection questions
   - candidate concept connection
   - contradiction detection
   - book synthesis
   - weekly learning-path synthesis
   - application/experiment proposal
4. JSON Schema for every output.
5. Input hashing, prompt version, model name, provenance, confidence and staleness tracking.
6. Human approval/rejection and AI Locked behavior through Notion.
7. Cost and token-budget guardrails.
8. Golden English and Arabic fixtures plus adversarial grounding fixtures.
9. Evaluation CLI producing machine-readable and human-readable score reports.

Grounding rules:
- Distinguish author statement, Yusuf statement and model inference.
- Use only supplied source evidence for book-specific claims.
- Do not fabricate chapter context, citations or external facts.
- Preserve the exact raw highlight separately.
- Produce concise, useful outputs rather than generic advice.
- Treat religious material cautiously; do not fabricate rulings or authorities.
- Return uncertainty and insufficient-evidence states explicitly.

Evaluation loop:
1. Establish baseline scores.
2. Identify the largest failure mode.
3. Make one focused prompt or pipeline change.
4. Re-run all golden and adversarial fixtures.
5. Record improvements and regressions in `evals/intelligence-log.md`.
6. Continue until schema validity is 100%, source-attribution errors are 0 on deterministic fixtures, and the approved quality rubric exceeds the configured threshold for both English and Arabic sets.

Do not auto-approve any generated insight. Stop after Phase 5.
```

## Phase 6 — Notion reading workflows and dashboard guidance

```text
Implement the user workflows that turn synchronized records into a reading intelligence system.

Deliverables:
1. Highlight Inbox workflow with deterministic statuses and recommended filters.
2. Process Highlight action: keep, discard, explain, challenge, connect, question or apply.
3. Book completion workflow that creates a synthesis draft and review.
4. Daily recall and weekly synthesis generation.
5. Learning-path coverage and curriculum-gate logic.
6. Application cards with hypothesis, action, result and evaluation.
7. Notion template/checklist documentation for every required linked view, filter, sort and grouping.
8. Local engine commands or setup actions that validate the Notion workspace configuration.

Constraints:
- Notion remains the interaction surface; do not build a redundant large web UI.
- AI drafts require approval before becoming durable Insights.
- Avoid vanity metrics. Measure processing, understanding, recall and application.

Acceptance criteria:
- A newly imported highlight reaches the Inbox.
- Processing it creates only the selected durable objects.
- A completed book can generate a grounded synthesis draft and recall review.
- A weekly learning-path review identifies studied, unprocessed, unresolved and applied material.
- An application can be reviewed later without losing its source evidence.
- Documentation lets Yusuf reproduce every required Notion dashboard view.
- `pnpm verify` passes.

Stop after Phase 6.
```

## Phase 7 — Hardening, packaging and recovery

```text
Complete production hardening and personal-use packaging for Lubb.

Deliverables:
1. Clean-machine setup and upgrade path.
2. Local engine startup integration appropriate to the target OS.
3. Extension release build and permission review.
4. Configuration wizard for pairing, Amazon region, Notion and optional model provider.
5. Health and synchronization status surface.
6. Automatic SQLite backup rotation and verified restore.
7. Complete JSON and Markdown export.
8. Database migration backup and rollback procedure.
9. Secret rotation and redaction tests.
10. End-to-end verification script and operator runbook.
11. Threat model and focused security review.

Required recovery drills:
- Restore from backup after database loss.
- Recover from extension reinstall and re-pairing.
- Rotate Notion and model tokens.
- Resume an interrupted complete library sync.
- Rebuild Notion projection from SQLite without duplicates.
- Recover after a breaking Amazon parser change without deleting prior data.

Final acceptance:
- Run the full end-to-end scenario from `docs/product-spec.md`.
- Run `pnpm verify` and the configured E2E suite.
- Report every remaining proof gap.
- Do not declare completion while a high-severity data-loss, credential or ownership issue remains.

Return:
- installation artifact or reproducible build command
- exact verification commands and results
- final architecture summary
- security and recovery scorecard
- known Amazon/Notion limitations
- prioritized post-V1 backlog
```

## Focused repair prompt — duplicate annotations

```text
Diagnose and fix duplicate annotations without deleting user data.

First reproduce the duplicate using sanitized fixtures and identify whether the failure is book identity, annotation identity, cross-source matching, retry idempotency or Notion page mapping.

Constraints:
- Do not solve the issue by weakening identity or collapsing all matching text.
- Do not hard-delete existing records automatically.
- Provide a reversible reconciliation migration and a dry-run report.

Verification:
- The regression fixture fails before the fix and passes afterward.
- Same text at different locations remains distinct.
- Existing user state and Notion page IDs are preserved on the surviving canonical record.
- `pnpm verify` passes.
```

## Focused repair prompt — Amazon markup change

```text
Repair the Kindle adapter after a suspected Amazon markup or endpoint change.

Safety:
- Read-only authorized access.
- Do not print or persist cookie values.
- Do not commit personal raw highlights.
- Do not allow a failed parser to mark anything missing or deleted.

Workflow:
1. Confirm the failure category with health gates.
2. Capture the smallest sanitized failing fixture.
3. Compare it with the current adapter contract.
4. Implement semantic selectors or endpoint parsing with a documented fallback.
5. Re-run every historical importer fixture.
6. Perform two dry runs and compare counts and identities.
7. Update the dated adapter note and importer evaluation log.

Return the cause, patch, regression fixture, verification evidence and any unsupported remaining variation.
```

## Focused repair prompt — Notion drift

```text
Diagnose and repair Notion schema or projection drift without overwriting user-owned content.

Inspect the live schema by stable IDs, compare it with the ownership registry and produce a read-only drift report first.

Classify every difference as:
- safe automatic repair
- user customization to preserve
- missing permission
- ambiguous conflict requiring Yusuf's decision

Apply only safe automatic repairs. Do not delete unknown properties, relations, pages or user content.

Verify an idempotent second run and return the before/after drift report plus unresolved decisions.
```

## Final review prompt

```text
Perform a release-readiness review of Lubb against `docs/product-spec.md` and `AGENTS.md`.

Do not modify code during the first pass.

Review dimensions:
- Kindle coverage and parser resilience
- identity and deduplication
- transaction and deletion safety
- extension permissions and credential isolation
- SQLite integrity and recovery
- Notion field ownership and idempotency
- rate-limit and retry behavior
- AI grounding and approval boundaries
- Arabic/English support
- installation and operator documentation

For every acceptance criterion, report Pass, Fail or Proof Gap and cite the exact test, command or artifact. Then propose the smallest ordered remediation plan. Do not call the release ready unless every critical criterion passes and no high-severity proof gap remains.
```
