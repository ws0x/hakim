# AGENTS.md: Hakim (حَكِيم)

## Mission

Build Hakim (حَكِيم), a local-first personal reading intelligence system. Reliability, data recoverability, provenance, and preservation of user thinking take absolute priority over feature count.

Read these documents before changing code:

1. `docs/architecture.md`
2. `docs/data-contract.md`
3. `docs/sync-semantics.md`
4. `docs/security.md`

If one is missing during initial scaffolding, create it from the approved product specification before implementing behavior.

## Working agreements

- Use TypeScript strict mode. Do not introduce explicit `any` without a documented boundary reason.
- Use pnpm workspaces and keep domain logic independent from UI, storage, and transport layers.
- Preserve existing user changes and unrelated files.
- Keep database migrations append-only after they have been applied to a non-test database.
- Do not add production dependencies unless they materially simplify a defined requirement. Record the reason in the relevant decision document.
- Do not silently weaken tests, schemas, assertions, permission scopes, or security gates to make a build pass.
- Never log authentication tokens, cookie values, Notion secrets, OpenAI/model secrets, or raw request authorization headers.
- Never send Amazon cookies or passwords to the Hakim Engine or anywhere outside the browser context.
- Never alter raw imported highlight text through AI processing.
- Never permanently delete source records as an automatic consequence of synchronization.
- Never identify an annotation using text alone.

## Architecture invariants

- SQLite is the authoritative Hakim store for V1.
- Notion and Obsidian are controlled projections, not the raw source snapshot.
- The browser extension accesses Amazon only in the user's authenticated browser context.
- The engine binds to loopback (`127.0.0.1`) by default.
- Extension-to-engine calls require a pairing token.
- Every external payload is runtime-validated with Zod schemas.
- Every external write is idempotent.
- Every sync run is checkpointed and auditable.
- A failed or incomplete source snapshot cannot cause deletions.
- Source-owned, user-owned, AI-draft-owned, and derived fields are reconciled separately.

## Module boundaries

- `packages/domain` contains pure entities, identifiers, normalization, matching and invariants. It must not import browser, filesystem, database, Notion, or model clients.
- `packages/kindle-import` contains adapters that map source-specific representations (Cloud, `My Clippings.txt`, HTML) into the shared import envelope.
- `packages/notion-sync` owns Notion schemas, pacing, mapping, and field-ownership reconciliation.
- `packages/markdown-export` owns formatting and export of Markdown files and Obsidian vaults.
- `packages/intelligence` orchestrates structured AI tasks but must depend on a model interface, not a concrete provider SDK.
- `packages/prompts` contains versioned prompt templates and their output schemas.
- `packages/test-fixtures` contains sanitized golden fixtures and test doubles.
- `apps/engine` owns persistence, local API, background jobs, configuration, and health surfaces.
- `apps/extension` owns Amazon session use, discovery, pagination, scheduling, and delivery to the engine.

## Testing requirements

For every meaningful change, run the narrowest relevant tests first, then the repository verification command.

The repository must provide these stable commands:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:fixtures`
- `pnpm verify`

`pnpm verify` must run formatting checks, lint, strict type checking, unit tests, fixture evaluations, and build checks.

Every importer change requires regression fixtures for:

- English Kindle metadata
- Arabic or localized metadata
- Repeated import (idempotency)
- Duplicate text at different locations
- Changed note
- Expanded/shortened highlight
- Pagination
- Clipping/content-limit state
- Interrupted run
- Login/CAPTCHA response
- Cloud and `My Clippings.txt` reconciliation

Every Notion sync change requires tests proving:

- Idempotent create/update behavior
- User-owned fields survive source sync
- Source-owned fields update correctly
- AI-locked fields are not overwritten
- Rate limits and `Retry-After` are honored
- Archived/missing pages are handled without data loss

Every AI prompt change requires:

- JSON Schema validation
- Groundedness fixtures
- English and Arabic fixtures
- Prompt version increment when semantics change
- Recorded evaluation comparison against the previous best

## Security review rules

- Flag any code that reads or serializes Amazon cookie values.
- Flag extension host permissions broader than the configured Kindle domains unless a documented feature requires them.
- Flag any engine listener bound beyond loopback without explicit authenticated remote-mode design.
- Flag logs or errors that may contain secrets or authorization headers.
- Flag whole-page Notion replacement when source and user content coexist.
- Flag automatic hard deletion of books, annotations, insights, or user state.
- Flag AI output written into source-owned properties.

## Documentation requirements

Update the relevant document when behavior, data contracts, permissions, sync ownership, or recovery semantics change. Maintain `docs/progress.md` during long-running implementation. It must include:

- Current phase
- Completed acceptance criteria
- Commands last run and results
- Known failures or proof gaps
- Next highest-priority task

## Definition of done

A task is complete only when:

1. The requested outcome is implemented.
2. Relevant fixtures and regression tests exist.
3. Relevant verification commands pass.
4. Security and synchronization invariants remain true.
5. Documentation is current.
6. Remaining limitations and proof gaps are stated explicitly.
