import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Lightweight Zero-Dependency In-Memory ZIP Archive Builder (PK standard)
 */
class ZipBuilder {
  private files: { path: string; data: Buffer }[] = [];

  public addFile(path: string, data: Buffer): void {
    this.files.push({ path: path.replace(/\\/g, "/"), data });
  }

  public build(): Buffer {
    const localHeaders: Buffer[] = [];
    const centralDirectoryHeaders: Buffer[] = [];
    let offset = 0;

    for (const file of this.files) {
      const fileNameBuffer = Buffer.from(file.path, "utf-8");
      const compressedData = deflateRawSync(file.data);
      const crc = this.crc32(file.data);

      // Local file header (30 bytes + filename + data)
      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
      localHeader.writeUInt16LE(20, 4);         // Version needed
      localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
      localHeader.writeUInt16LE(8, 8);          // Compression method (8 = Deflate)
      localHeader.writeUInt16LE(0, 10);         // Last mod time
      localHeader.writeUInt16LE(0, 12);         // Last mod date
      localHeader.writeUInt32LE(crc, 14);       // CRC-32
      localHeader.writeUInt32LE(compressedData.length, 18); // Compressed size
      localHeader.writeUInt32LE(file.data.length, 22);       // Uncompressed size
      localHeader.writeUInt16LE(fileNameBuffer.length, 26);  // File name length
      localHeader.writeUInt16LE(0, 28);                      // Extra field length

      const fileChunk = Buffer.concat([localHeader, fileNameBuffer, compressedData]);
      localHeaders.push(fileChunk);

      // Central directory header (46 bytes + filename)
      const cdHeader = Buffer.alloc(46);
      cdHeader.writeUInt32LE(0x02014b50, 0); // Central directory header signature
      cdHeader.writeUInt16LE(20, 4);         // Version made by
      cdHeader.writeUInt16LE(20, 6);         // Version needed
      cdHeader.writeUInt16LE(0, 8);          // General purpose bit flag
      cdHeader.writeUInt16LE(8, 10);         // Compression method (8 = Deflate)
      cdHeader.writeUInt16LE(0, 12);         // Last mod time
      cdHeader.writeUInt16LE(0, 14);         // Last mod date
      cdHeader.writeUInt32LE(crc, 16);       // CRC-32
      cdHeader.writeUInt32LE(compressedData.length, 20); // Compressed size
      cdHeader.writeUInt32LE(file.data.length, 24);       // Uncompressed size
      cdHeader.writeUInt16LE(fileNameBuffer.length, 28);  // File name length
      cdHeader.writeUInt16LE(0, 30);                      // Extra field length
      cdHeader.writeUInt16LE(0, 32);                      // File comment length
      cdHeader.writeUInt16LE(0, 34);                      // Disk number start
      cdHeader.writeUInt16LE(0, 36);                      // Internal file attributes
      cdHeader.writeUInt32LE(0, 38);                      // External file attributes
      cdHeader.writeUInt32LE(offset, 42);                 // Relative offset of local header

      centralDirectoryHeaders.push(Buffer.concat([cdHeader, fileNameBuffer]));
      offset += fileChunk.length;
    }

    const cdBuffer = Buffer.concat(centralDirectoryHeaders);
    const cdOffset = offset;
    const cdSize = cdBuffer.length;

    // End of central directory record (22 bytes)
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
    eocd.writeUInt16LE(0, 4);          // Disk number
    eocd.writeUInt16LE(0, 6);          // Disk with start of CD
    eocd.writeUInt16LE(this.files.length, 8);  // Total entries on disk
    eocd.writeUInt16LE(this.files.length, 10); // Total entries
    eocd.writeUInt32LE(cdSize, 12);            // Size of central directory
    eocd.writeUInt32LE(cdOffset, 16);          // Offset of CD
    eocd.writeUInt16LE(0, 20);                 // Comment length

    return Buffer.concat([...localHeaders, cdBuffer, eocd]);
  }

  private crc32(buffer: Buffer): number {
    let crc = ~0;
    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i]!;
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ ~0) >>> 0;
  }
}

export function packageExtension(): { zipPath: string; sha256: string; manifestVersion: string } {
  // 1. Verify and read manifest.json
  const manifestPath = join(__dirname, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error("manifest.json not found in apps/extension");
  }

  const manifestRaw = readFileSync(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw);

  if (manifest.manifest_version !== 3) {
    throw new Error(`Invalid manifest_version: ${manifest.manifest_version}. Expected 3.`);
  }

  const version = manifest.version || "1.0.0";
  console.log(`📦 Packaging Hakim Chrome Extension v${version}...`);

  // 2. Collect all files in apps/extension
  const zip = new ZipBuilder();
  const baseDir = __dirname;

  function collectFiles(dir: string) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relPath = relative(baseDir, fullPath).replace(/\\/g, "/");

      if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry.endsWith(".zip")) {
        continue;
      }

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        collectFiles(fullPath);
      } else {
        const fileData = readFileSync(fullPath);
        zip.addFile(relPath, fileData);
      }
    }
  }

  // Also include built dist directory
  const distDir = join(__dirname, "dist");
  if (existsSync(distDir)) {
    function collectDist(dir: string) {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const relPath = relative(baseDir, fullPath).replace(/\\/g, "/");
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          collectDist(fullPath);
        } else if (!entry.endsWith(".zip") && !entry.endsWith(".txt")) {
          const fileData = readFileSync(fullPath);
          zip.addFile(relPath, fileData);
        }
      }
    }
    collectDist(distDir);
  }

  collectFiles(baseDir);

  // 3. Build ZIP
  const zipBuffer = zip.build();
  mkdirSync(distDir, { recursive: true });
  const zipFileName = `hakim-extension-v${version}.zip`;
  const zipPath = join(distDir, zipFileName);
  writeFileSync(zipPath, zipBuffer);

  // 4. Calculate SHA-256 Checksum
  const sha256 = createHash("sha256").update(zipBuffer).digest("hex");
  const sha256Path = join(distDir, "SHA256SUMS.txt");
  writeFileSync(sha256Path, `${sha256}  ${zipFileName}\n`);

  console.log(`✅ Package built: ${zipPath}`);
  console.log(`🔒 SHA-256: ${sha256}`);

  return { zipPath, sha256, manifestVersion: version };
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    packageExtension();
  } catch (e) {
    console.error("Packaging failed:", e);
    process.exit(1);
  }
}
