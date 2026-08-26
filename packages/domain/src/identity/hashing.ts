import { normalizeAuthor, normalizeText, normalizeTitle } from "./normalizer.js";

/**
 * Pure, universal SHA-256 implementation (zero native dependencies, browser & node compatible).
 */
function sha256Sync(ascii: string): string {
  let result = "";

  const words: number[] = [];
  const unescaped = encodeURIComponent(ascii).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );

  for (let i = 0; i < unescaped.length; i++) {
    const charCode = unescaped.charCodeAt(i);
    const wordIdx = i >> 2;
    words[wordIdx] = (words[wordIdx] || 0) | (charCode << ((3 - (i % 4)) * 8));
  }

  const bitLength = unescaped.length * 8;
  const wordLengthIdx = unescaped.length >> 2;
  words[wordLengthIdx] = (words[wordLengthIdx] || 0) | (0x80 << ((3 - (unescaped.length % 4)) * 8));
  words[(((unescaped.length + 8) >> 6) << 4) + 15] = bitLength;

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const w: number[] = new Array(64);
  for (let i = 0; i < words.length; i += 16) {
    const oldHash = [...hash];
    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j] || 0;
      } else {
        const w15 = w[j - 15] || 0;
        const w2 = w[j - 2] || 0;
        const w16 = w[j - 16] || 0;
        const w7 = w[j - 7] || 0;

        const gamma0 =
          ((w15 >>> 7) | (w15 << 25)) ^
          ((w15 >>> 18) | (w15 << 14)) ^
          (w15 >>> 3);
        const gamma1 =
          ((w2 >>> 17) | (w2 << 15)) ^
          ((w2 >>> 19) | (w2 << 13)) ^
          (w2 >>> 10);
        w[j] = (w16 + gamma0 + w7 + gamma1) | 0;
      }

      const h0 = hash[0] || 0;
      const h1 = hash[1] || 0;
      const h2 = hash[2] || 0;
      const h3 = hash[3] || 0;
      const h4 = hash[4] || 0;
      const h5 = hash[5] || 0;
      const h6 = hash[6] || 0;
      const h7 = hash[7] || 0;
      const kj = k[j] || 0;
      const wj = w[j] || 0;

      const s1 =
        ((h4 >>> 6) | (h4 << 26)) ^
        ((h4 >>> 11) | (h4 << 21)) ^
        ((h4 >>> 25) | (h4 << 7));
      const ch = (h4 & h5) ^ (~h4 & h6);
      const temp1 = (h7 + s1 + ch + kj + wj) | 0;
      const s0 =
        ((h0 >>> 2) | (h0 << 30)) ^
        ((h0 >>> 13) | (h0 << 19)) ^
        ((h0 >>> 22) | (h0 << 10));
      const maj = (h0 & h1) ^ (h0 & h2) ^ (h1 & h2);
      const temp2 = (s0 + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        h0,
        h1,
        h2,
        (h3 + temp1) | 0,
        h4,
        h5,
        h6,
      ];
    }

    for (let j = 0; j < 8; j++) {
      hash[j] = ((hash[j] || 0) + (oldHash[j] || 0)) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    const val = hash[i] || 0;
    for (let j = 3; j >= 0; j--) {
      const b = (val >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }

  return result;
}

export function computePayloadHash(content: string): string {
  return sha256Sync(content);
}

/**
 * Deterministic UUIDv5-style ID generator using pure SHA-256
 */
function deterministicUUID(namespace: string, key: string): string {
  const hash = sha256Sync(`${namespace}:${key}`);
  
  // Format as standard UUID: 8-4-4-4-12
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "5" + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32),
  ].join("-");
}

/**
 * Generate a stable, immutable Book ID.
 */
export function generateBookId(params: {
  asin?: string;
  sourceBookKey?: string;
  title: string;
  author?: string;
  region?: string;
}): { id: string; stableKey: string } {
  let stableKey: string;

  if (params.asin && params.asin.trim().length > 0) {
    const region = params.region || "com";
    stableKey = `asin:${region}:${params.asin.trim().toUpperCase()}`;
  } else if (params.sourceBookKey && params.sourceBookKey.trim().length > 0) {
    stableKey = `key:${params.sourceBookKey.trim()}`;
  } else {
    const normTitle = normalizeTitle(params.title).toLowerCase();
    const normAuthor = normalizeAuthor(params.author || "").toLowerCase();
    stableKey = `title_author:${normTitle}::${normAuthor}`;
  }

  const id = deterministicUUID("hakim:book", stableKey);
  return { id, stableKey };
}

/**
 * Generate a stable, immutable Annotation ID.
 * INVARIANT: Text alone is NEVER the primary identity.
 */
export function generateAnnotationId(params: {
  bookId: string;
  type?: string;
  sourceAnnotationKey?: string;
  locationStart?: number;
  locationEnd?: number;
  page?: number;
  rawText: string;
}): { id: string; stableKey: string } {
  const normText = normalizeText(params.rawText);
  const textHash = computePayloadHash(normText).substring(0, 16);
  const type = params.type || "highlight";

  let stableKey: string;

  if (params.sourceAnnotationKey && params.sourceAnnotationKey.trim().length > 0) {
    stableKey = `amzn_key:${params.bookId}:${params.sourceAnnotationKey.trim()}`;
  } else if (params.locationStart !== undefined) {
    const locEnd = params.locationEnd !== undefined ? params.locationEnd : params.locationStart;
    stableKey = `loc:${params.bookId}:${type}:${params.locationStart}-${locEnd}:${textHash}`;
  } else if (params.page !== undefined) {
    stableKey = `page:${params.bookId}:${type}:p${params.page}:${textHash}`;
  } else {
    stableKey = `fallback:${params.bookId}:${type}:${textHash}`;
  }

  const id = deterministicUUID("hakim:annotation", stableKey);
  return { id, stableKey };
}
