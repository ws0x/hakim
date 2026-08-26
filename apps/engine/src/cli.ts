#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { initDatabase } from "./db/database.js";
import { createEngineServer } from "./server.js";
import { parseMyClippings, parseKindleHtmlExport } from "@hakim/kindle-import";
import { VaultExportService } from "./services/vault-export-service.js";
import { IntelligenceService } from "./services/intelligence-service.js";
import { BackupService } from "./services/backup-service.js";

const DB_PATH = process.env.HAKIM_DB_PATH || join(homedir(), ".hakim", "hakim.db");
const PORT = parseInt(process.env.HAKIM_PORT || "4242", 10);
const HOST = process.env.HAKIM_HOST || "127.0.0.1";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "start";

  const db = initDatabase({ filePath: DB_PATH });

  if (command === "start") {
    const engine = createEngineServer({ port: PORT, host: HOST, db });
    await engine.listen();
    console.log(`\n===========================================`);
    console.log(`  Hakim (حَكِيم) Reading Intelligence Engine`);
    console.log(`  Address:  http://${HOST}:${PORT}`);
    console.log(`  Database: ${DB_PATH}`);
    console.log(`===========================================\n`);
    return;
  }

  if (command === "token") {
    const engine = createEngineServer({ port: PORT, host: HOST, db });
    const token = engine.auth.rotatePairingToken();
    console.log(`\n[Hakim] New Pairing Token generated:`);
    console.log(`\n  ${token}\n`);
    console.log(`Enter this token in your Hakim Browser Extension settings.\n`);
    process.exit(0);
  }

  if (command === "import-clippings") {
    const filePath = args[1];
    if (!filePath || !existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    const raw = readFileSync(filePath, "utf-8");
    const envelope = parseMyClippings(raw);
    const engine = createEngineServer({ port: PORT, host: HOST, db });
    const report = engine.ingestion.ingestEnvelope(envelope);
    console.log(`\n[Hakim] Import Completed Successfully!`);
    console.log(`  Books Discovered:       ${report.booksDiscovered}`);
    console.log(`  Annotations Discovered: ${report.annotationsDiscovered}`);
    console.log(`  Created Annotations:    ${report.createdAnnotations}`);
    console.log(`  Updated Annotations:    ${report.updatedAnnotations}`);
    console.log(`  Duration:               ${report.durationMs}ms\n`);
    process.exit(0);
  }

  if (command === "import-html") {
    const filePath = args[1];
    if (!filePath || !existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    const raw = readFileSync(filePath, "utf-8");
    const envelope = parseKindleHtmlExport(raw);
    const engine = createEngineServer({ port: PORT, host: HOST, db });
    const report = engine.ingestion.ingestEnvelope(envelope);
    console.log(`\n[Hakim] HTML Import Completed Successfully!`);
    console.log(`  Books Discovered:       ${report.booksDiscovered}`);
    console.log(`  Annotations Discovered: ${report.annotationsDiscovered}`);
    console.log(`  Created Annotations:    ${report.createdAnnotations}`);
    console.log(`  Duration:               ${report.durationMs}ms\n`);
    process.exit(0);
  }

  if (command === "export-vault") {
    const vaultPath = args[1] || join(homedir(), "Hakim-Obsidian-Vault");
    const exportService = new VaultExportService(db);
    const result = exportService.exportAll(vaultPath);
    console.log(`\n[Hakim] Obsidian Vault Export Complete!`);
    console.log(`  Books Exported: ${result.exportedCount}`);
    console.log(`  Location:       ${result.destination}\n`);
    process.exit(0);
  }

  if (command === "synthesize") {
    const intelligenceService = new IntelligenceService(db);
    console.log(`\n[Hakim AI] Running claim extraction & recall question synthesis...`);
    const count = await intelligenceService.synthesizeAllUnprocessed();
    console.log(`  Synthesized ${count} highlight(s) into structured insight drafts.\n`);
    process.exit(0);
  }

  if (command === "backup") {
    const targetPath = args[1] || join(homedir(), ".hakim", `backup-${Date.now()}.json`);
    const backupService = new BackupService(db);
    const result = backupService.exportJsonBackup(targetPath);
    console.log(`\n[Hakim] Database Backup Created!`);
    console.log(`  File:        ${result.filePath}`);
    console.log(`  Books:       ${result.bookCount}`);
    console.log(`  Highlights:  ${result.annotCount}\n`);
    process.exit(0);
  }

  if (command === "restore") {
    const sourcePath = args[1];
    if (!sourcePath || !existsSync(sourcePath)) {
      console.error(`Error: Backup file not found: ${sourcePath}`);
      process.exit(1);
    }
    const backupService = new BackupService(db);
    const result = backupService.restoreJsonBackup(sourcePath);
    console.log(`\n[Hakim] Database Restored Successfully!`);
    console.log(`  Restored Books:      ${result.restoredBooks}`);
    console.log(`  Restored Highlights: ${result.restoredAnnots}\n`);
    process.exit(0);
  }

  if (command === "status") {
    const bookCount = (db.prepare("SELECT COUNT(*) as count FROM books").get() as { count: number }).count;
    const annotCount = (db.prepare("SELECT COUNT(*) as count FROM annotations").get() as { count: number }).count;
    const insightCount = (db.prepare("SELECT COUNT(*) as count FROM insights").get() as { count: number }).count;
    console.log(`\n[Hakim Status]`);
    console.log(`  Database Location: ${DB_PATH}`);
    console.log(`  Total Books:       ${bookCount}`);
    console.log(`  Total Highlights:  ${annotCount}`);
    console.log(`  AI Insight Drafts: ${insightCount}\n`);
    process.exit(0);
  }

  console.log(`\nHakim (حَكِيم) CLI Usage:`);
  console.log(`  hakim start                      - Start local loopback engine`);
  console.log(`  hakim token                      - Generate/rotate pairing token`);
  console.log(`  hakim import-clippings <file>    - Ingest My Clippings.txt (USB)`);
  console.log(`  hakim import-html <file>         - Ingest Kindle HTML export`);
  console.log(`  hakim export-vault [path]        - Export library to Obsidian vault`);
  console.log(`  hakim synthesize                 - Run AI claim and recall synthesis`);
  console.log(`  hakim backup [path]              - Create verified JSON database backup`);
  console.log(`  hakim restore <file>             - Restore database from backup`);
  console.log(`  hakim status                     - Check library counts & health\n`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
