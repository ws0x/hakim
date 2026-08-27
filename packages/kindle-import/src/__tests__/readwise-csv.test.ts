import { describe, it, expect } from "vitest";
import { ReadwiseCsvParser, parseCsvRows } from "../csv/readwise-csv-parser.js";

describe("Readwise CSV Parser & RFC 4180 Tokenizer", () => {
  it("correctly tokenizes multiline CSV with quotes and escaped characters", () => {
    const csv = `Highlight,Book Title,Book Author,Location\n"Line 1\nLine 2 with ""quotes""","Designing Data-Intensive Applications","Martin Kleppmann","1040"`;
    const rows = parseCsvRows(csv);

    expect(rows.length).toBe(2);
    expect(rows[1]![0]).toBe('Line 1\nLine 2 with "quotes"');
    expect(rows[1]![1]).toBe("Designing Data-Intensive Applications");
    expect(rows[1]![2]).toBe("Martin Kleppmann");
    expect(rows[1]![3]).toBe("1040");
  });

  it("parses full Readwise CSV export into valid Hakim ImportEnvelope", () => {
    const csvData = `"Highlight","Book Title","Book Author","Amazon Book ID","Location","Highlighted at","Annotation","Color","Document Tags"
"Reliability means continuing to work correctly even in the face of adversity.","Designing Data-Intensive Applications","Martin Kleppmann","B0141R4C1E","Location 450","2026-03-15T10:00:00Z","Core principle","yellow","architecture,systems"
"You have power over your mind - not outside events.","The Daily Stoic","Ryan Holiday","B01CO2TN2K","190-192","2026-03-16T14:30:00Z","Stoic control dichotomy","pink","stoicism,mindset"
"","Atomic Habits","James Clear","B07D23CFGR","300","2026-03-17T08:00:00Z","Stand-alone user note without quote","blue","habits"`;

    const envelope = ReadwiseCsvParser.parse(csvData);

    expect(envelope.version).toBe("1.0");
    expect(envelope.books.length).toBe(3);

    // Book 1
    const b1 = envelope.books.find((b) => b.sourceTitle.includes("Designing Data-Intensive"));
    expect(b1).toBeDefined();
    expect(b1?.author).toBe("Martin Kleppmann");
    expect(b1?.asin).toBe("B0141R4C1E");
    expect(b1?.annotations.length).toBe(1);

    // Highlight 1
    const h1 = b1?.annotations[0];
    expect(h1).toBeDefined();
    expect(h1?.rawText).toContain("Reliability means");
    expect(h1?.color).toBe("yellow");
    expect(h1?.sourceNote).toBe("Core principle");
    expect(h1?.locationStart).toBe(450);

    // Book 2 with range location & pink color
    const b2 = envelope.books.find((b) => b.sourceTitle.includes("The Daily Stoic"));
    expect(b2).toBeDefined();
    const h2 = b2?.annotations[0];
    expect(h2?.color).toBe("pink");
    expect(h2?.locationStart).toBe(190);
    expect(h2?.locationEnd).toBe(192);

    // Book 3: Note-only item
    const b3 = envelope.books.find((b) => b.sourceTitle.includes("Atomic Habits"));
    expect(b3).toBeDefined();
    const h3 = b3?.annotations[0];
    expect(h3?.type).toBe("note");
    expect(h3?.rawText).toBe("Stand-alone user note without quote");
    expect(h3?.color).toBe("blue");
  });

  it("handles empty or single-row CSV gracefully", () => {
    const envelope = ReadwiseCsvParser.parse("");
    expect(envelope.books.length).toBe(0);

    const singleRow = ReadwiseCsvParser.parse("Highlight,Book Title,Book Author");
    expect(singleRow.books.length).toBe(0);
  });
});
