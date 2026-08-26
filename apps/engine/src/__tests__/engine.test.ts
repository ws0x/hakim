import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDatabase } from "../db/database.js";
import { createEngineServer } from "../server.js";
import { englishCloudEnvelope } from "@hakim/test-fixtures";
import type { DatabaseSync } from "node:sqlite";

describe("Hakim Local Engine Integration", () => {
  let db: DatabaseSync;
  let engine: ReturnType<typeof createEngineServer>;
  const testPort = 4299;

  beforeAll(async () => {
    db = initDatabase({ filePath: ":memory:" });
    engine = createEngineServer({ port: testPort, host: "127.0.0.1", db });
    await engine.listen();
  });

  afterAll(async () => {
    await engine.close();
  });

  it("exposes a public health endpoint with library counts and zero secrets", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/v1/health`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string; library: { books: number; annotations: number } };
    expect(data.status).toBe("healthy");
    expect(data.library.books).toBe(0);
    expect(data.library.annotations).toBe(0);
  });

  it("generates and verifies pairing tokens", async () => {
    const token = engine.auth.rotatePairingToken();
    expect(token).toBeDefined();

    // Valid pair
    const pairRes = await fetch(`http://127.0.0.1:${testPort}/api/v1/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(pairRes.status).toBe(200);

    // Invalid pair
    const invalidRes = await fetch(`http://127.0.0.1:${testPort}/api/v1/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "wrong-token" }),
    });
    expect(invalidRes.status).toBe(401);
  });

  it("ingests cloud import envelopes idempotently", async () => {
    const token = engine.auth.rotatePairingToken();

    // Run 1: Create
    const res1 = await fetch(`http://127.0.0.1:${testPort}/api/v1/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(englishCloudEnvelope),
    });
    expect(res1.status).toBe(200);
    const data1 = (await res1.json()) as { report: { createdAnnotations: number; updatedAnnotations: number } };
    expect(data1.report.createdAnnotations).toBe(2);
    expect(data1.report.updatedAnnotations).toBe(0);

    // Check DB counts
    const bookCount = (db.prepare("SELECT COUNT(*) as count FROM books").get() as { count: number }).count;
    const annotCount = (db.prepare("SELECT COUNT(*) as count FROM annotations").get() as { count: number }).count;
    expect(bookCount).toBe(1);
    expect(annotCount).toBe(2);

    // Run 2: Re-import (must be 0 created, 2 updated)
    const res2 = await fetch(`http://127.0.0.1:${testPort}/api/v1/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(englishCloudEnvelope),
    });
    expect(res2.status).toBe(200);
    const data2 = (await res2.json()) as { report: { createdAnnotations: number; updatedAnnotations: number } };
    expect(data2.report.createdAnnotations).toBe(0);
    expect(data2.report.updatedAnnotations).toBe(2);
  });

  it("INVARIANT: Preserves user state (notes & status) when source highlights re-sync", async () => {
    const token = engine.auth.rotatePairingToken();

    // 1. User sets their custom notes and status in user state table
    const annot = db.prepare("SELECT id FROM annotations LIMIT 1").get() as { id: string };
    db.prepare(
      `UPDATE annotation_user_states SET 
        process_status = 'processed',
        importance = 'essential',
        personal_interpretation = 'Crucial concept for our engineering team architecture.'
      WHERE annotation_id = ?`
    ).run(annot.id);

    // 2. Trigger re-sync from Kindle
    const res = await fetch(`http://127.0.0.1:${testPort}/api/v1/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(englishCloudEnvelope),
    });
    expect(res.status).toBe(200);

    // 3. Verify user-owned fields survived untouched
    const userState = db
      .prepare("SELECT * FROM annotation_user_states WHERE annotation_id = ?")
      .get(annot.id) as {
      process_status: string;
      importance: string;
      personal_interpretation: string;
    };
    expect(userState.process_status).toBe("processed");
    expect(userState.importance).toBe("essential");
    expect(userState.personal_interpretation).toBe("Crucial concept for our engineering team architecture.");
  });
});
