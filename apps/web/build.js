import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function build() {
  const distDir = join(__dirname, "dist");
  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  // 1. Bundle TypeScript for Landing Page and Web App
  await esbuild.build({
    entryPoints: [
      join(__dirname, "src/scripts/landing.ts"),
      join(__dirname, "src/scripts/app.ts"),
    ],
    bundle: true,
    minify: true,
    sourcemap: false,
    format: "esm",
    outdir: join(distDir, "src/scripts"),
    target: ["es2022"],
  });

  // 2. Copy static files
  const stylesDir = join(distDir, "src/styles");
  const assetsDir = join(distDir, "src/assets");
  if (!existsSync(stylesDir)) mkdirSync(stylesDir, { recursive: true });
  if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

  copyFileSync(join(__dirname, "index.html"), join(distDir, "index.html"));
  copyFileSync(join(__dirname, "app.html"), join(distDir, "app.html"));
  copyFileSync(join(__dirname, "src/styles/landing.css"), join(stylesDir, "landing.css"));
  copyFileSync(join(__dirname, "src/styles/workspace.css"), join(stylesDir, "workspace.css"));
  copyFileSync(join(__dirname, "src/assets/logo.svg"), join(assetsDir, "logo.svg"));

  console.log("⚡ Hakim Landing Page & Web Client built successfully into apps/web/dist!");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
