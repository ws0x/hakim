import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, "../../index.html");
const cssPath = join(__dirname, "../styles/landing.css");

describe("Hakim Landing Page - Structural, UI/UX & Semantic Invariants", () => {
  it("ensures landing page HTML and CSS files exist", () => {
    expect(existsSync(htmlPath)).toBe(true);
    expect(existsSync(cssPath)).toBe(true);
  });

  const html = readFileSync(htmlPath, "utf-8");

  it("contains all critical semantic sections", () => {
    expect(html).toContain('id="features"');
    expect(html).toContain('id="installation"');
    expect(html).toContain('id="comparison"');
    expect(html).toContain('id="simulation"');
  });

  it("includes clear Value Proposition and Version Badge", () => {
    expect(html).toContain("Hakim");
    expect(html).toContain("v1.2.1");
    expect(html).toContain("effortlessly organized in Notion");
  });

  it("provides 3-step installation tabs with zero-CLI guidance", () => {
    expect(html).toContain("Install in 60 Seconds");
    expect(html).toContain("Download Extension Bundle");
    expect(html).toContain("Load Unpacked in Chrome");
    expect(html).toContain("Connect Notion & Sync");
  });

  it("provides accurate Readwise vs Hakim comparison matrix", () => {
    expect(html).toContain("Hakim vs. Readwise");
    expect(html).toContain("100% Free & Open Source");
    expect(html).toContain("Local-first (Direct Browser to Notion)");
    expect(html).toContain("Two-Way Notion Relations");
  });

  it("ensures zero placeholder tokens or dummy text exist", () => {
    expect(html).not.toContain("Lorem ipsum");
    expect(html).not.toContain("TODO");
    expect(html).not.toContain("FIXME");
  });
});
