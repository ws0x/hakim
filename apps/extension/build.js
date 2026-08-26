import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function buildExtension() {
  // 1. Bundle TypeScript files with esbuild
  await esbuild.build({
    entryPoints: [
      join(__dirname, "src/background/index.ts"),
      join(__dirname, "src/popup/popup.ts"),
    ],
    outdir: join(__dirname, "dist"),
    bundle: true,
    format: "esm",
    target: "es2022",
    sourcemap: true,
  });

  console.log("⚡ Extension scripts bundled successfully with esbuild.");

  // 2. Copy UI Assets
  const filesToCopy = [
    { from: "src/popup/popup.html", to: "dist/popup/popup.html" },
    { from: "src/popup/popup.css", to: "dist/popup/popup.css" },
    { from: "src/assets/logo.svg", to: "dist/assets/logo.svg" },
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

  // 3. Copy Icons Directory
  const iconsSrcDir = join(__dirname, "src/assets/icons");
  const iconsDestDir = join(__dirname, "dist/assets/icons");

  if (existsSync(iconsSrcDir)) {
    mkdirSync(iconsDestDir, { recursive: true });
    const icons = readdirSync(iconsSrcDir);
    for (const icon of icons) {
      copyFileSync(join(iconsSrcDir, icon), join(iconsDestDir, icon));
      console.log(`Copied icon: ${icon}`);
    }
  }
}

buildExtension().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
