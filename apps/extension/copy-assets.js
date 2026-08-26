import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const filesToCopy = [
  { from: "src/popup/popup.html", to: "dist/popup/popup.html" },
  { from: "src/popup/popup.css", to: "dist/popup/popup.css" },
];

for (const { from, to } of filesToCopy) {
  const srcPath = join(__dirname, from);
  const destPath = join(__dirname, to);

  if (existsSync(srcPath)) {
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
    console.log(`Copied ${from} -> ${to}`);
  }
}
