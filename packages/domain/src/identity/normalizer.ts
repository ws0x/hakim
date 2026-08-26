/**
 * Text and metadata normalization functions for Hakim.
 */

export function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  const entityMap: Record<string, string> = {
    "&quot;": '"',
    "&amp;": "&",
    "&apos;": "'",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    "&laquo;": "«",
    "&raquo;": "»",
    "&mdash;": "—",
    "&ndash;": "–",
    "&hellip;": "…",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&lsaquo;": "‹",
    "&rsaquo;": "›",
    "&trade;": "™",
    "&copy;": "©",
    "&reg;": "®",
    "&bull;": "•",
    "&middot;": "·",
    "&prime;": "′",
    "&Prime;": "″",
  };

  return str
    // Named entities
    .replace(/&[a-zA-Z]+;/g, (match) => entityMap[match.toLowerCase()] ?? match)
    // Decimal entities: &#123;
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return _;
      }
    })
    // Hex entities: &#x1f600;
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return _;
      }
    });
}

export function normalizeText(text: string): string {
  if (!text) return "";
  const decoded = decodeHtmlEntities(text);
  return decoded
    .normalize("NFKC")
    // Remove zero-width spaces, soft hyphens, and directional formatting characters
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u200E\u200F]/g, "")
    // Normalize quotes and dashes
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    // Collapse multi-spaces and linebreaks
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(title: string): string {
  if (!title) return "Untitled";
  return normalizeText(title)
    // Remove common Kindle/Amazon subtitle clutter like "(English Edition)" or Kindle edition markers
    .replace(/\s*\((?:Kindle Edition|English Edition|Arabic Edition)\)/gi, "")
    .trim();
}

export function normalizeAuthor(author: string): string {
  if (!author) return "Unknown Author";
  let normalized = normalizeText(author);
  // Handle "Lastname, Firstname" format
  if (normalized.includes(",") && !normalized.includes(";")) {
    const parts = normalized.split(",").map((p) => p.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      normalized = `${parts[1]} ${parts[0]}`;
    }
  }
  return normalized;
}
