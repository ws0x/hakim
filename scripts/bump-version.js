import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function parseSemVer(version) {
  const parts = version.trim().split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid SemVer: ${version}`);
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function formatSemVer({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function computeNextVersion(currentVersion, bumpType) {
  const current = parseSemVer(currentVersion);
  switch (bumpType) {
    case "major":
      return formatSemVer({ major: current.major + 1, minor: 0, patch: 0 });
    case "minor":
      return formatSemVer({ major: current.major, minor: current.minor + 1, patch: 0 });
    case "patch":
      return formatSemVer({ major: current.major, minor: current.minor, patch: current.patch + 1 });
    default:
      // Check if user passed explicit version like "1.2.0"
      parseSemVer(bumpType);
      return bumpType;
  }
}

function updateJsonFile(filePath, updater) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf-8");
  const json = JSON.parse(raw);
  updater(json);
  writeFileSync(filePath, JSON.stringify(json, null, 2) + "\n", "utf-8");
  console.log(`Updated ${filePath}`);
}

function main() {
  const arg = process.argv[2] || "patch";
  const rootPkgPath = join(rootDir, "package.json");
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
  const currentVersion = rootPkg.version || "1.0.0";
  const nextVersion = computeNextVersion(currentVersion, arg);

  console.log(`\n===========================================`);
  console.log(`  Hakim Version Bump: ${currentVersion} -> ${nextVersion}`);
  console.log(`===========================================\n`);

  // 1. Update Root package.json
  updateJsonFile(rootPkgPath, (json) => {
    json.version = nextVersion;
  });

  // 2. Update all packages/*/package.json
  const packagesDir = join(rootDir, "packages");
  if (existsSync(packagesDir)) {
    for (const pkgName of readdirSync(packagesDir)) {
      const pkgJsonPath = join(packagesDir, pkgName, "package.json");
      updateJsonFile(pkgJsonPath, (json) => {
        json.version = nextVersion;
      });
    }
  }

  // 3. Update all apps/*/package.json
  const appsDir = join(rootDir, "apps");
  if (existsSync(appsDir)) {
    for (const appName of readdirSync(appsDir)) {
      const appJsonPath = join(appsDir, appName, "package.json");
      updateJsonFile(appJsonPath, (json) => {
        json.version = nextVersion;
      });
    }
  }

  // 4. Update apps/extension/manifest.json
  const manifestPath = join(rootDir, "apps/extension/manifest.json");
  updateJsonFile(manifestPath, (json) => {
    json.version = nextVersion;
  });

  console.log(`\nSuccessfully bumped all packages and extension manifest to v${nextVersion}!\n`);
}

main();
