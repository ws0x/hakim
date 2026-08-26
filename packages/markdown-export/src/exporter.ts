import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatBookMarkdown, type BookExportPayload } from "./formatter.js";

export interface VaultExportOptions {
  vaultPath: string;
  booksSubfolder?: string;
}

export function exportLibraryToVault(
  payloads: BookExportPayload[],
  options: VaultExportOptions
): { exportedCount: number; destination: string } {
  const targetDir = options.booksSubfolder ? join(options.vaultPath, options.booksSubfolder) : options.vaultPath;
  mkdirSync(targetDir, { recursive: true });

  let exportedCount = 0;

  for (const payload of payloads) {
    const markdown = formatBookMarkdown(payload);
    // Sanitize filename for Windows/macOS/Linux
    const safeTitle = payload.book.displayTitle.replace(/[/\\?%*:|"<>]/g, "-");
    const fileName = `${safeTitle}.md`;
    const filePath = join(targetDir, fileName);

    writeFileSync(filePath, markdown, "utf-8");
    exportedCount++;
  }

  return {
    exportedCount,
    destination: targetDir,
  };
}
