import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crc]);
}

function generateHighFidelityIcon(size) {
  const width = size;
  const height = size;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8 bits per channel
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const rawData = [];
  const s = size / 128; // scale factor

  for (let y = 0; y < height; y++) {
    rawData.push(0); // None filter
    for (let x = 0; x < width; x++) {
      const nx = x / s; // Normalized to 128x128 space
      const ny = y / s;

      // 1. Base rounded rectangle
      const cornerRadius = 26;
      const inRectX = nx >= cornerRadius && nx <= 128 - cornerRadius;
      const inRectY = ny >= cornerRadius && ny <= 128 - cornerRadius;
      let inBase = inRectX || inRectY;

      if (!inBase) {
        const cx = nx < cornerRadius ? cornerRadius : 128 - cornerRadius;
        const cy = ny < cornerRadius ? cornerRadius : 128 - cornerRadius;
        const dist = Math.hypot(nx - cx, ny - cy);
        inBase = dist <= cornerRadius;
      }

      if (!inBase) {
        rawData.push(0, 0, 0, 0);
        continue;
      }

      // Default Dark Onyx / Indigo Background
      const bgT = (nx + ny) / 256;
      let r = Math.round(30 * (1 - bgT) + 15 * bgT);
      let g = Math.round(27 * (1 - bgT) + 23 * bgT);
      let b = Math.round(75 * (1 - bgT) + 42 * bgT);
      let a = 255;

      // 2. Open Book Pages (Left & Right curves)
      // Left Page: x between 22 and 64, y between 42 and 88
      const inLeftPage =
        nx >= 22 &&
        nx <= 64 &&
        ny >= 40 + Math.sin(((nx - 22) / 42) * Math.PI) * 4 &&
        ny <= 86 + Math.sin(((nx - 22) / 42) * Math.PI) * 4;

      // Right Page: x between 64 and 106, y between 42 and 88
      const inRightPage =
        nx >= 64 &&
        nx <= 106 &&
        ny >= 40 + Math.sin(((106 - nx) / 42) * Math.PI) * 4 &&
        ny <= 86 + Math.sin(((106 - nx) / 42) * Math.PI) * 4;

      if (inLeftPage || inRightPage) {
        // Book Violet/Indigo Gradient
        const pT = nx / 128;
        r = Math.round(99 * (1 - pT) + 168 * pT);
        g = Math.round(102 * (1 - pT) + 85 * pT);
        b = Math.round(241 * (1 - pT) + 247 * pT);
      }

      // 3. Center Spine
      if (Math.abs(nx - 64) <= 1.5 && ny >= 40 && ny <= 88) {
        r = 192;
        g = 132;
        b = 252;
      }

      // 4. Central Glowing Wisdom Spark (Diamond at 64, 34)
      const sparkDx = Math.abs(nx - 64);
      const sparkDy = Math.abs(ny - 34);
      const inSparkDiamond = sparkDx / 10 + sparkDy / 16 <= 1;
      const inCenterDot = Math.hypot(nx - 64, ny - 34) <= 3.5;

      if (inCenterDot) {
        r = 255;
        g = 255;
        b = 255;
      } else if (inSparkDiamond) {
        r = 56;
        g = 189;
        b = 248; // Cyan glow
      }

      rawData.push(r, g, b, a);
    }
  }

  const idatData = deflateSync(Buffer.from(rawData));
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    pngSignature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idatData),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = join(__dirname, "src/assets/icons");
mkdirSync(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const buf = generateHighFidelityIcon(size);
  const path = join(outDir, `icon-${size}.png`);
  writeFileSync(path, buf);
  console.log(`Generated high-fidelity icon: ${path} (${size}x${size})`);
}
