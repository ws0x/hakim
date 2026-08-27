import { describe, it, expect } from "vitest";
import { packageExtension } from "../package-extension.js";
import { existsSync, readFileSync } from "node:fs";

describe("Chrome Extension Packaging & Release Distribution", () => {
  it("packages the extension into a valid ZIP archive and calculates SHA-256", () => {
    const result = packageExtension();

    expect(result).toBeDefined();
    expect(result.manifestVersion).toBe("1.3.0");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(existsSync(result.zipPath)).toBe(true);

    const zipData = readFileSync(result.zipPath);
    expect(zipData.length).toBeGreaterThan(1000);
    // ZIP magic bytes: PK\x03\x04
    expect(zipData[0]).toBe(0x50);
    expect(zipData[1]).toBe(0x4b);
    expect(zipData[2]).toBe(0x03);
    expect(zipData[3]).toBe(0x04);
  });
});
