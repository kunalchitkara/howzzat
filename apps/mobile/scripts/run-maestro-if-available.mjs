import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const maestroDir = join(root, ".maestro");

const which = spawnSync("which", ["maestro"], { encoding: "utf8" });
if (which.status !== 0) {
  console.log("Maestro not installed — skipping UI e2e (see apps/mobile/.maestro/README.md)");
  process.exit(0);
}

const flows = ["demo-no-auth.yaml", "squad-picker.yaml"].filter((f) =>
  existsSync(join(maestroDir, f)),
);

if (flows.length === 0) {
  console.log("No Maestro flows found — skipping");
  process.exit(0);
}

for (const flow of flows) {
  console.log(`\n▶ maestro test ${flow}`);
  const res = spawnSync("maestro", ["test", join(maestroDir, flow)], {
    stdio: "inherit",
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

console.log("\nMaestro flows passed");
