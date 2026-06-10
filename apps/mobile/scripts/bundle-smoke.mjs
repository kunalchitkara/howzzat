#!/usr/bin/env node
/**
 * Smoke test: Expo must export/bundle the mobile app without env module errors.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.join(__dirname, "..");
const outDir = path.join(mobileRoot, ".bundle-smoke");

fs.rmSync(outDir, { recursive: true, force: true });

const apiSrc = fs.readFileSync(path.join(mobileRoot, "lib/api.ts"), "utf8");
const configSrc = fs.readFileSync(path.join(mobileRoot, "lib/config.ts"), "utf8");
function usesVirtualEnv(src) {
  return /process\.env\b/.test(src) || src.includes("expo/virtual/env");
}
if (usesVirtualEnv(apiSrc)) {
  console.error("lib/api.ts must not use process.env / expo/virtual/env");
  process.exit(1);
}
if (usesVirtualEnv(configSrc)) {
  console.error("lib/config.ts must not use process.env / expo/virtual/env");
  process.exit(1);
}

try {
  execSync("pnpm exec expo export --platform ios --output-dir .bundle-smoke --clear", {
    cwd: mobileRoot,
    stdio: "pipe",
    env: { ...process.env, CI: "1" },
  });
} catch (e) {
  const out = [e.stdout?.toString(), e.stderr?.toString(), e.message]
    .filter(Boolean)
    .join("\n");
  console.error("Bundle smoke test failed:\n", out);
  process.exit(1);
}

const hasBundle = fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0;
if (!hasBundle) {
  console.error("Export output missing");
  process.exit(1);
}

console.log("Bundle smoke OK (expo export ios)");
fs.rmSync(outDir, { recursive: true, force: true });
