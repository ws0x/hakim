import { describe, it, expect, beforeEach } from "vitest";
import { initDatabase } from "../db/database.js";
import { IngestionService } from "../services/ingestion.js";
import { VaultExportService } from "../services/vault-export-service.js";
import { IntelligenceService } from "../services/intelligence-service.js";
import { BackupService } from "../services/backup-service.js";
import { englishCloudEnvelope } from "@hakim/test-fixtures";
import type { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

describe("Hakim End-to-End Full Lifecycle Verification", () => {
  let db: DatabaseSync;
  let ingestion: IngestionService;
  let vaultExport: VaultExportService;
  let intelligence: IntelligenceService;
  let backup: BackupService;

  beforeEach(() => {
    db = initDatabase({ filePath: ":memory:" });
    ingestion = new IngestionService(db);
    vaultExport = new VaultExportService(db);
    intelligence = new IntelligenceService(db);
    backup = new BackupService(db);
  });

  it("completes full roundtrip: Ingest ➔ User Edit ➔ Re-sync ➔ AI Synthesis ➔ Obsidian Export ➔ Backup & Restore", async () => {
    // 1. Ingest initial cloud highlights
    const report1 = ingestion.ingestEnvelope(englishCloudEnvelope);
    expect(report1.createdAnnotations).toBe(2);
    expect(report1.updatedAnnotations).toBe(0);

    // 2. User sets their personal interpretation and importance rating
    const annot = db.prepare("SELECT id FROM annotations LIMIT 1").get() as { id: string };
    db.prepare(
      `UPDATE annotation_user_states SET 
        process_status = 'processed',
        importance = 'essential',
        personal_interpretation = 'Vital rule for architectural design and leadership.'
      WHERE annotation_id = ?`
    ).run(annot.id);

    // 3. Re-sync from Kindle source; verify idempotency and zero user data loss
    const report2 = ingestion.ingestEnvelope(englishCloudEnvelope);
    expect(report2.createdAnnotations).toBe(0);
    expect(report2.updatedAnnotations).toBe(2);

    const userState = db
      .prepare("SELECT * FROM annotation_user_states WHERE annotation_id = ?")
      .get(annot.id) as {
      process_status: string;
      importance: string;
      personal_interpretation: string;
    };
    expect(userState.personal_interpretation).toBe("Vital rule for architectural design and leadership.");

    // 4. Run AI Intelligence synthesis
    const synthCount = await intelligence.synthesizeAllUnprocessed();
    expect(synthCount).toBe(2);

    const insights = db.prepare("SELECT * FROM insights").all();
    expect(insights.length).toBe(2);

    // 5. Export to Obsidian Vault folder
    const tempVault = join(tmpdir(), `hakim-test-vault-${Date.now()}`);
    const exportResult = vaultExport.exportAll(tempVault);
    expect(exportResult.exportedCount).toBe(1);

    const expectedMdFile = join(exportResult.destination, "The Effective Engineer.md");
    expect(existsSync(expectedMdFile)).toBe(true);

    const fileContent = readFileSync(expectedMdFile, "utf-8");
    expect(fileContent).toContain('title: "The Effective Engineer"');
    expect(fileContent).toContain("Vital rule for architectural design and leadership.");
    expect(fileContent).toContain("**Importance:** `ESSENTIAL`");

    // 6. Backup database to JSON
    const tempBackupPath = join(tmpdir(), `hakim-backup-${Date.now()}.json`);
    const backupResult = backup.exportJsonBackup(tempBackupPath);
    expect(backupResult.bookCount).toBe(1);
    expect(backupResult.annotCount).toBe(2);

    // 7. Wipe database and Restore from Backup
    const freshDb = initDatabase({ filePath: ":memory:" });
    const freshBackupService = new BackupService(freshDb);
    const restoreResult = freshBackupService.restoreJsonBackup(tempBackupPath);
    expect(restoreResult.restoredBooks).toBe(1);
    expect(restoreResult.restoredAnnots).toBe(2);

    const restoredUserState = freshDb
      .prepare("SELECT * FROM annotation_user_states WHERE annotation_id = ?")
      .get(annot.id) as { personal_interpretation: string };
    expect(restoredUserState.personal_interpretation).toBe("Vital rule for architectural design and leadership.");
  });
});
