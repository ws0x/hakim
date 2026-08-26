/**
 * Lightweight, zero-dependency pure TypeScript client-side ZIP archive generator.
 * Produces standard uncompressed (Stored) ZIP files with CRC32 checksums.
 */

export interface ZipFileEntry {
  name: string;
  content: string | Uint8Array;
}

export class ZipBuilder {
  private files: ZipFileEntry[] = [];

  public addFile(name: string, content: string | Uint8Array): this {
    this.files.push({ name: name.replace(/\\/g, "/"), content });
    return this;
  }

  /**
   * Generates a standard binary ZIP archive as a Blob.
   */
  public generateBlob(): Blob {
    const localHeaders: Uint8Array[] = [];
    const centralHeaders: Uint8Array[] = [];
    let offset = 0;

    const encoder = new TextEncoder();

    for (const file of this.files) {
      const fileNameBytes = encoder.encode(file.name);
      const fileData = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
      const crc = ZipBuilder.crc32(fileData);
      const size = fileData.length;

      // 1. Local File Header (30 bytes + name + data)
      const localHeader = new Uint8Array(30 + fileNameBytes.length);
      const localView = new DataView(localHeader.buffer);

      localView.setUint32(0, 0x04034b50, true); // Local file header signature
      localView.setUint16(4, 20, true);         // Version needed to extract (2.0)
      localView.setUint16(6, 0, true);          // General purpose bit flag
      localView.setUint16(8, 0, true);          // Compression method (0 = Stored)
      localView.setUint16(10, 0, true);         // File last mod time
      localView.setUint16(12, 0, true);         // File last mod date
      localView.setUint32(14, crc, true);       // CRC-32
      localView.setUint32(18, size, true);      // Compressed size
      localView.setUint32(22, size, true);      // Uncompressed size
      localView.setUint16(26, fileNameBytes.length, true); // File name length
      localView.setUint16(28, 0, true);         // Extra field length

      localHeader.set(fileNameBytes, 30);
      localHeaders.push(localHeader, fileData);

      // 2. Central Directory File Header (46 bytes + name)
      const centralHeader = new Uint8Array(46 + fileNameBytes.length);
      const centralView = new DataView(centralHeader.buffer);

      centralView.setUint32(0, 0x02014b50, true); // Central dir header signature
      centralView.setUint16(4, 20, true);         // Version made by
      centralView.setUint16(6, 20, true);         // Version needed to extract
      centralView.setUint16(8, 0, true);          // General purpose bit flag
      centralView.setUint16(10, 0, true);         // Compression method (Stored)
      centralView.setUint16(12, 0, true);         // File last mod time
      centralView.setUint16(14, 0, true);         // File last mod date
      centralView.setUint32(16, crc, true);       // CRC-32
      centralView.setUint32(20, size, true);      // Compressed size
      centralView.setUint32(24, size, true);      // Uncompressed size
      centralView.setUint16(28, fileNameBytes.length, true); // File name length
      centralView.setUint16(30, 0, true);         // Extra field length
      centralView.setUint16(32, 0, true);         // File comment length
      centralView.setUint16(34, 0, true);         // Disk number start
      centralView.setUint16(36, 0, true);         // Internal file attributes
      centralView.setUint32(38, 0, true);         // External file attributes
      centralView.setUint32(42, offset, true);    // Relative offset of local header

      centralHeader.set(fileNameBytes, 46);
      centralHeaders.push(centralHeader);

      offset += localHeader.length + fileData.length;
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const h of centralHeaders) centralDirSize += h.length;

    // 3. End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdView.setUint16(4, 0, true);          // Number of this disk
    eocdView.setUint16(6, 0, true);          // Disk with start of central directory
    eocdView.setUint16(8, this.files.length, true);  // Number of central directory records on this disk
    eocdView.setUint16(10, this.files.length, true); // Total number of central directory records
    eocdView.setUint32(12, centralDirSize, true);    // Size of central directory
    eocdView.setUint32(16, centralDirOffset, true);  // Offset of start of central directory
    eocdView.setUint16(20, 0, true);                 // Comment length

    const allParts: (Uint8Array | BlobPart)[] = [...localHeaders, ...centralHeaders, eocd];
    return new Blob(allParts as any, { type: "application/zip" });
  }

  /**
   * Triggers a browser file download for the generated ZIP.
   */
  public downloadZip(filename: string = "hakim-obsidian-vault.zip"): void {
    const blob = this.generateBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Fast CRC32 calculation.
   */
  private static crcTable: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  })();

  private static crc32(bytes: Uint8Array): number {
    let crc = 0 ^ (-1);
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ ZipBuilder.crcTable[(crc ^ bytes[i]!) & 0xFF]!;
    }
    return (crc ^ (-1)) >>> 0;
  }
}
