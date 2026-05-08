// Sync public/manifest.json version with package.json version.
// Wired into npm's `version` lifecycle (package.json scripts.version), so
// `npm version patch|minor|major` updates both files in one shot.
import { readFileSync, writeFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifestPath = "public/manifest.json";
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.version === pkg.version) {
  process.exit(0);
}

manifest.version = pkg.version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`synced ${manifestPath} → ${pkg.version}`);
